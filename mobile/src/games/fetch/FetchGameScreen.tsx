import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, StyleSheet, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { usePet } from "../../hooks/usePet";
import PetPortrait, { type PetReaction } from "../../components/pet/PetPortrait";
import GameField, { useReducedMotionFlag, type FieldSize } from "../GameField";
import GameEndCard from "../GameEndCard";
import { playDing } from "../../utils/sfx";
import {
  FETCH_MAX_THROWS,
  Field,
  FetchRound,
  Point,
  Throw,
  canThrow,
  computeThrow,
  endRound,
  fetchSummary,
  newRound,
  recordFetch,
  recordThrow,
  runDurationMs,
  secondsLeft,
} from "./fetchLogic";

type Phase = "idle" | "flying" | "running" | "returning" | "over";
const BALL = 34;
const PET_SIZE = 112;

function layoutFor(size: FieldSize): { field: Field; petHome: Point; ballRest: Point } {
  const field: Field = {
    width: size.width,
    height: size.height,
    groundTop: size.height * 0.42,
    groundBottom: size.height * 0.8,
    sideMargin: 36,
  };
  const petHome = { x: Math.max(70, size.width * 0.22), y: size.height * 0.86 };
  const ballRest = { x: petHome.x + 78, y: petHome.y - 14 };
  return { field, petHome, ballRest };
}

/** Points along the arc for Animated's piecewise interpolation. */
function arcSamples(from: Point, to: Point, arcHeight: number, steps = 8) {
  const input: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    input.push(t);
    xs.push(from.x + (to.x - from.x) * t);
    ys.push(from.y + (to.y - from.y) * t - arcHeight * 4 * t * (1 - t));
  }
  return { input, xs, ys };
}

/**
 * Fetch: drag the ball and let go. The ball arcs across the lawn, the pet runs after it, brings it back
 * and drops it at your feet. Eight throws or sixty seconds, whichever comes first.
 */
export default function FetchGameScreen({ navigation }: any) {
  const { user } = useAuth();
  const { sources, look, displayName } = usePet();
  const reducedMotion = useReducedMotionFlag();

  const [size, setSize] = useState<FieldSize | null>(null);
  const [round, setRound] = useState<FetchRound>(() => newRound(Date.now()));
  const [phase, setPhase] = useState<Phase>("idle");
  const [now, setNow] = useState(Date.now());
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [ballVisible, setBallVisible] = useState(true);
  const currentThrow = useRef<Throw | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const roundRef = useRef(round);
  roundRef.current = round;
  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const layout = useMemo(() => (size ? layoutFor(size) : null), [size]);

  // animated positions (top-left corners are derived from these centre points)
  const ballDrag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const flight = useRef(new Animated.Value(0)).current;
  const [flightPath, setFlightPath] = useState<{ input: number[]; xs: number[]; ys: number[] } | null>(null);
  const petPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const hop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (layout) petPos.setValue({ x: layout.petHome.x, y: layout.petHome.y });
  }, [layout, petPos]);

  // clock
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  // time's up while the ball is at rest -> end the round
  useEffect(() => {
    if (phase === "idle" && round.endedAt == null && !canThrow(round, now)) {
      setRound((r) => endRound(r, now));
      setPhaseBoth("over");
    }
    if (phase === "idle" && round.endedAt != null) setPhaseBoth("over");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, phase, round]);

  const runHop = useCallback(
    (durationMs: number) => {
      if (reducedMotion) return null;
      const hops = Math.max(2, Math.round(durationMs / 220));
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        { iterations: hops }
      );
      loop.start();
      return loop;
    },
    [hop, reducedMotion]
  );

  const throwBall = useCallback(
    (t: Throw) => {
      if (!layout) return;
      currentThrow.current = t;
      setRound((r) => recordThrow(r, t));
      setPhaseBoth("flying");
      ballDrag.setValue({ x: 0, y: 0 });
      const path = arcSamples(layout.ballRest, t.landing, t.arcHeight);
      setFlightPath(path);
      flight.setValue(0);
      const flightMs = reducedMotion ? Math.round(t.flightMs * 0.5) : t.flightMs;
      Animated.timing(flight, { toValue: 1, duration: flightMs, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        // the pet runs to the ball
        setPhaseBoth("running");
        const dist = Math.hypot(t.landing.x - layout.petHome.x, t.landing.y - layout.petHome.y);
        const runMs = reducedMotion ? Math.round(runDurationMs(dist) * 0.6) : runDurationMs(dist);
        const hopLoop = runHop(runMs);
        Animated.timing(petPos, {
          toValue: { x: t.landing.x, y: Math.min(layout.petHome.y, t.landing.y + 30) },
          duration: runMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished: arrived }) => {
          hopLoop?.stop();
          hop.setValue(0);
          if (!arrived) return;
          // picked up: ball hidden while the pet trots home
          setBallVisible(false);
          setPhaseBoth("returning");
          const backLoop = runHop(runMs);
          Animated.timing(petPos, {
            toValue: { x: layout.petHome.x, y: layout.petHome.y },
            duration: runMs,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }).start(({ finished: home }) => {
            backLoop?.stop();
            hop.setValue(0);
            if (!home) return;
            setFlightPath(null);
            flight.setValue(0);
            setBallVisible(true);
            setReaction("love");
            playDing();
            const next = recordFetch(roundRef.current, t, Date.now());
            setRound(next);
            setPhaseBoth(next.endedAt != null ? "over" : "idle");
          });
        });
      });
    },
    [ballDrag, flight, hop, layout, petPos, reducedMotion, runHop]
  );

  const grantAt = useRef(0);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phaseRef.current === "idle" && canThrow(roundRef.current, Date.now()),
        onMoveShouldSetPanResponder: () => phaseRef.current === "idle" && canThrow(roundRef.current, Date.now()),
        onPanResponderGrant: () => {
          grantAt.current = Date.now();
          ballDrag.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (_event, gesture) => {
          ballDrag.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!layout) return;
          const t = computeThrow(layout.ballRest, gesture.dx, gesture.dy, Date.now() - grantAt.current, layout.field);
          if (!t) {
            Animated.spring(ballDrag, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 6 }).start();
            return;
          }
          throwBall(t);
        },
        onPanResponderTerminate: () => {
          Animated.spring(ballDrag, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 6 }).start();
        },
      }),
    [ballDrag, layout, throwBall]
  );

  const restart = () => {
    if (!layout) return;
    currentThrow.current = null;
    setFlightPath(null);
    flight.setValue(0);
    ballDrag.setValue({ x: 0, y: 0 });
    petPos.setValue({ x: layout.petHome.x, y: layout.petHome.y });
    setBallVisible(true);
    setRound(newRound(Date.now()));
    setPhaseBoth("idle");
  };

  const throwsLeft = FETCH_MAX_THROWS - round.throws;
  const hint =
    phase === "idle" && round.throws === 0
      ? "Drag the ball and let go to throw"
      : phase === "running"
        ? `${displayName} is on it`
        : phase === "returning"
          ? "Bringing it back…"
          : null;

  return (
    <GameField
      title="Fetch"
      stat={`${round.score} pts`}
      secondary={`${throwsLeft} ${throwsLeft === 1 ? "ball" : "balls"} · ${secondsLeft(round, now)}s`}
      onClose={() => navigation.goBack()}
      hint={hint}
    >
      {(fieldSize) => {
        if (!size || Math.abs(size.width - fieldSize.width) > 0.5 || Math.abs(size.height - fieldSize.height) > 0.5) {
          // capture the field size once the layout is known
          setTimeout(() => setSize(fieldSize), 0);
        }
        if (!layout) return null;
        const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
        const ballTransform: any = flightPath
          ? [
              { translateX: flight.interpolate({ inputRange: flightPath.input, outputRange: flightPath.xs.map((x) => x - BALL / 2) }) },
              { translateY: flight.interpolate({ inputRange: flightPath.input, outputRange: flightPath.ys.map((y) => y - BALL / 2) }) },
              { scale: flight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.82, 0.9] }) },
            ]
          : [
              { translateX: Animated.add(ballDrag.x, new Animated.Value(layout.ballRest.x - BALL / 2)) },
              { translateY: Animated.add(ballDrag.y, new Animated.Value(layout.ballRest.y - BALL / 2)) },
            ];
        return (
          <>
            {/* landing spot marker while the ball is in the air */}
            {phase === "flying" && currentThrow.current ? (
              <View
                pointerEvents="none"
                style={[styles.landingMark, { left: currentThrow.current.landing.x - 16, top: currentThrow.current.landing.y - 6 }]}
              />
            ) : null}

            <Animated.View
              pointerEvents="none"
              style={[
                styles.petWrap,
                {
                  width: PET_SIZE * 1.2,
                  transform: [
                    { translateX: Animated.subtract(petPos.x, new Animated.Value((PET_SIZE * 1.2) / 2)) },
                    { translateY: Animated.add(Animated.subtract(petPos.y, new Animated.Value(PET_SIZE)), hopY) },
                  ],
                },
              ]}
            >
              <PetPortrait
                sources={sources}
                look={look}
                size={PET_SIZE}
                mood={phase === "running" || phase === "returning" ? "excited" : "happy"}
                reaction={reaction}
                onReactionEnd={() => setReaction(null)}
                allowOriginal
              />
            </Animated.View>

            {ballVisible ? (
              <Animated.View
                {...panResponder.panHandlers}
                style={[styles.ball, { transform: ballTransform }]}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Ball. Drag and release to throw."
              >
                <View style={styles.ballShine} />
              </Animated.View>
            ) : null}

            {phase === "over" ? (
              <GameEndCard
                game="fetch"
                userId={user?.id}
                petName={displayName}
                score={round.score}
                summary={fetchSummary(round, displayName)}
                onPlayAgain={restart}
                onDone={() => navigation.goBack()}
              />
            ) : null}
          </>
        );
      }}
    </GameField>
  );
}

const styles = StyleSheet.create({
  petWrap: { position: "absolute", left: 0, top: 0, alignItems: "center" },
  ball: {
    position: "absolute",
    left: 0,
    top: 0,
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    backgroundColor: "#f97316",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
  },
  ballShine: {
    position: "absolute",
    left: 7,
    top: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  landingMark: {
    position: "absolute",
    width: 32,
    height: 12,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.22)",
  },
});
