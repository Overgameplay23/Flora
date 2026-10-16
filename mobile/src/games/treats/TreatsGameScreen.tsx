import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { usePet } from "../../hooks/usePet";
import PetPortrait, { type PetReaction } from "../../components/pet/PetPortrait";
import GameField, { useReducedMotionFlag, type FieldSize } from "../GameField";
import GameEndCard from "../GameEndCard";
import { brand } from "../../theme/tokens";
import { playDing } from "../../utils/sfx";
import { selection, tapLight } from "../../utils/haptics";
import {
  CATCH_RADIUS_RATIO,
  TREAT_SIZE,
  type Treat,
  type TreatsRound,
  clampPetX,
  endTreatsRound,
  isCaught,
  isTreatsOver,
  newTreatsRound,
  nextTreatDelayMs,
  recordCatch,
  recordTreatMiss,
  shouldCheerTreats,
  spawnTreat,
  treatsSecondsLeft,
  treatsSummary,
} from "./treatsLogic";

const PET_SIZE = 150;
const SIDE_MARGIN = 44;
/** the pet's feet sit on this share of the field height */
const GROUND_RATIO = 0.8;

type LiveTreat = { treat: Treat; progress: Animated.Value; gone: Animated.Value };

function TreatView({
  live,
  field,
  groundY,
  reducedMotion,
  onLand,
}: {
  live: LiveTreat;
  field: FieldSize;
  groundY: number;
  reducedMotion: boolean;
  onLand: (treat: Treat) => "caught" | "missed";
}) {
  const { treat, progress, gone } = live;
  const landed = useRef(false);
  useEffect(() => {
    const duration = reducedMotion ? Math.round(treat.fallMs * 0.8) : treat.fallMs;
    const fall = Animated.timing(progress, { toValue: 1, duration, easing: Easing.in(Easing.quad), useNativeDriver: true });
    fall.start(({ finished }) => {
      if (!finished || landed.current) return;
      landed.current = true;
      const outcome = onLand(treat);
      // caught: a quick pop; missed: it drifts off the bottom of the lawn
      Animated.timing(gone, { toValue: outcome === "caught" ? 1 : 2, duration: outcome === "caught" ? 220 : 520, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
    return () => fall.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-TREAT_SIZE, groundY - TREAT_SIZE * 0.6] });
  const drift = gone.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0, 70] });
  const scale = gone.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1.5, 0.8] });
  const opacity = gone.interpolate({ inputRange: [0, 0.6, 1, 2], outputRange: [1, 1, 0, 0] });
  const left = treat.xRatio * field.width - TREAT_SIZE / 2;
  const golden = treat.kind === "golden";
  return (
    <Animated.View pointerEvents="none" style={[styles.treat, { left, width: TREAT_SIZE, height: TREAT_SIZE, opacity, transform: [{ translateY: Animated.add(translateY, drift) }, { scale }] }]}>
      <View style={[styles.treatBody, { backgroundColor: golden ? brand.gold : "#C98B5A", borderColor: golden ? "#FFE9A8" : "#F2D9BF" }]}>
        <Ionicons name={golden ? "star" : "ellipse"} size={golden ? 16 : 10} color={golden ? brand.goldStrong : "#8A5A3A"} />
      </View>
    </Animated.View>
  );
}

/**
 * Treat Catch: treats fall from the top of the lawn; drag anywhere to slide the pet along the ground and
 * catch them. Golden ones are worth three. Forty-five seconds, no way to lose: a missed treat floats off.
 */
export default function TreatsGameScreen({ navigation }: any) {
  const { user } = useAuth();
  const { sources, look, displayName } = usePet();
  const reducedMotion = useReducedMotionFlag();

  const [round, setRound] = useState<TreatsRound>(() => newTreatsRound(Date.now()));
  const [treats, setTreats] = useState<LiveTreat[]>([]);
  const [now, setNow] = useState(Date.now());
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [over, setOver] = useState(false);
  const [facing, setFacing] = useState<"left" | "right">("right");
  const roundRef = useRef(round);
  roundRef.current = round;
  const overRef = useRef(false);
  const idRef = useRef(1);
  const fieldRef = useRef<FieldSize | null>(null);
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // where the pet stands (its centre), as an animated value for the layout and a ref for catch checks
  const petX = useRef(new Animated.Value(0)).current;
  const petXRef = useRef(0);
  const placed = useRef(false);

  const movePet = useCallback(
    (x: number, animate: boolean) => {
      const field = fieldRef.current;
      if (!field) return;
      const next = clampPetX(x, field.width, SIDE_MARGIN);
      if (next > petXRef.current + 2) setFacing("right");
      else if (next < petXRef.current - 2) setFacing("left");
      petXRef.current = next;
      if (animate && !reducedMotion) Animated.spring(petX, { toValue: next, useNativeDriver: true, damping: 22, stiffness: 320, mass: 0.8 }).start();
      else petX.setValue(next);
    },
    [petX, reducedMotion]
  );

  const scheduleSpawn = useCallback(() => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    const elapsed = Date.now() - roundRef.current.startedAt;
    spawnTimer.current = setTimeout(() => {
      if (overRef.current) return;
      const t = Date.now();
      const treat = spawnTreat(idRef.current++, Math.random(), t - roundRef.current.startedAt, t);
      setTreats((prev) => [...prev, { treat, progress: new Animated.Value(0), gone: new Animated.Value(0) }]);
      scheduleSpawn();
    }, nextTreatDelayMs(elapsed));
  }, []);

  useEffect(() => {
    scheduleSpawn();
    return () => {
      if (spawnTimer.current) clearTimeout(spawnTimer.current);
    };
  }, [scheduleSpawn]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  // the end is scheduled once (a ref, not an effect cleanup: the clock re-runs this every tick)
  useEffect(() => {
    if (over || endTimer.current || !isTreatsOver(round, now)) return;
    overRef.current = true;
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    endTimer.current = setTimeout(() => {
      endTimer.current = null;
      setOver(true);
      setRound((r) => endTreatsRound(r, Date.now()));
    }, 0);
  }, [now, over, round]);
  useEffect(
    () => () => {
      if (endTimer.current) clearTimeout(endTimer.current);
    },
    []
  );

  const remove = useCallback((id: number) => {
    // after the pop or the drift, drop the treat from the list
    setTimeout(() => setTreats((prev) => prev.filter((item) => item.treat.id !== id)), 600);
  }, []);

  const handleLand = useCallback(
    (treat: Treat): "caught" | "missed" => {
      const field = fieldRef.current;
      remove(treat.id);
      if (overRef.current || !field) return "missed";
      const treatX = treat.xRatio * field.width;
      const caught = isCaught(treatX, petXRef.current, PET_SIZE * 1.2 * CATCH_RADIUS_RATIO);
      if (caught) {
        const next = recordCatch(roundRef.current, treat);
        roundRef.current = next;
        setRound(next);
        playDing();
        if (treat.kind === "golden") selection();
        else tapLight();
        if (shouldCheerTreats(next.streak) || treat.kind === "golden") setReaction("cheer");
        return "caught";
      }
      const next = recordTreatMiss(roundRef.current);
      roundRef.current = next;
      setRound(next);
      return "missed";
    },
    [remove]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !overRef.current,
        onMoveShouldSetPanResponder: () => !overRef.current,
        onPanResponderGrant: (event) => movePet(event.nativeEvent.locationX, true),
        onPanResponderMove: (event) => movePet(event.nativeEvent.locationX, false),
      }),
    [movePet]
  );

  const restart = () => {
    overRef.current = false;
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = null;
    setOver(false);
    setTreats([]);
    const fresh = newTreatsRound(Date.now());
    roundRef.current = fresh;
    setRound(fresh);
    scheduleSpawn();
  };

  const hint = round.caught === 0 && round.missed === 0 && !over ? `Drag to slide ${displayName} under the treats` : round.streak >= 5 ? `${round.streak} in a row!` : null;

  return (
    <GameField title="Treat Catch" stat={`${round.score} pts`} secondary={`${treatsSecondsLeft(round, now)}s`} onClose={() => navigation.goBack()} hint={hint}>
      {(field) => {
        fieldRef.current = field;
        const groundY = field.height * GROUND_RATIO;
        if (!placed.current) {
          placed.current = true;
          petXRef.current = field.width / 2;
          petX.setValue(field.width / 2);
        }
        return (
          <>
            {/* the whole lawn is the slider: drag anywhere to move the pet */}
            <View style={StyleSheet.absoluteFill} {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={`Slide ${displayName} left and right to catch treats`} />
            {treats.map((live) => (
              <TreatView key={live.treat.id} live={live} field={field} groundY={groundY} reducedMotion={reducedMotion} onLand={handleLand} />
            ))}
            <Animated.View
              pointerEvents="none"
              style={[styles.petWrap, { top: groundY - PET_SIZE, width: PET_SIZE * 1.2, transform: [{ translateX: Animated.subtract(petX, new Animated.Value((PET_SIZE * 1.2) / 2)) }] }]}
            >
              <PetPortrait
                sources={sources}
                look={look}
                size={PET_SIZE}
                mood={round.streak >= 5 ? "excited" : "happy"}
                facing={facing}
                reaction={reaction}
                onReactionEnd={() => setReaction(null)}
                allowOriginal
              />
            </Animated.View>
            {over ? (
              <GameEndCard
                game="treats"
                userId={user?.id}
                petName={displayName}
                score={round.score}
                summary={treatsSummary(round, displayName)}
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
  petWrap: { position: "absolute", left: 0, alignItems: "center" },
  treat: { position: "absolute", top: 0, alignItems: "center", justifyContent: "center" },
  treatBody: {
    width: TREAT_SIZE,
    height: TREAT_SIZE * 0.72,
    borderRadius: TREAT_SIZE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3b2a1a",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
