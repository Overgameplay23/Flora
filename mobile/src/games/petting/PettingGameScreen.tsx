import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { usePet } from "../../hooks/usePet";
import PetPortrait, { type PetReaction } from "../../components/pet/PetPortrait";
import GameField, { useReducedMotionFlag, type FieldSize } from "../GameField";
import GameEndCard from "../GameEndCard";
import { brand, fonts } from "../../theme/tokens";
import { selection, success, tapLight } from "../../utils/haptics";
import { announce } from "../../utils/a11y";
import {
  type PettingRound,
  easeCalm,
  endPettingRound,
  isPettingOver,
  newPettingRound,
  pettingMood,
  pettingScore,
  pettingSecondsLeft,
  pettingSummary,
  recordStroke,
} from "./pettingLogic";

const PET_SIZE = 190;
/** a finger has to travel this far to count as another stroke */
const STROKE_DISTANCE = 22;
/** and strokes are never counted closer together than this */
const STROKE_GAP_MS = 110;
const MAX_HEARTS = 14;

type Heart = { id: number; x: number; y: number; progress: Animated.Value; drift: number; size: number };

function HeartView({ heart, onDone }: { heart: Heart; onDone: (id: number) => void }) {
  useEffect(() => {
    const animation = Animated.timing(heart.progress, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animation.start(({ finished }) => finished && onDone(heart.id));
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const translateY = heart.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -90] });
  const translateX = heart.progress.interpolate({ inputRange: [0, 1], outputRange: [0, heart.drift] });
  const opacity = heart.progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.95, 0.9, 0] });
  const scale = heart.progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 1.1, 1] });
  return (
    <Animated.View pointerEvents="none" style={[styles.heart, { left: heart.x - heart.size / 2, top: heart.y - heart.size / 2, opacity, transform: [{ translateY }, { translateX }, { scale }] }]}>
      <Ionicons name="heart" size={heart.size} color={brand.bloom} />
    </Animated.View>
  );
}

/**
 * Pet the pet: the pet sits in the middle of the lawn; slow strokes (drag, or taps) fill its contentment,
 * hearts float up, and a haptic lands with each stroke. Frantic rubbing barely counts; stopping lets it ease
 * back a little, never below the last quarter. One calm minute, or until the pet is fully content.
 */
export default function PettingGameScreen({ navigation }: any) {
  const { user } = useAuth();
  const { sources, look, displayName } = usePet();
  const reducedMotion = useReducedMotionFlag();

  const [round, setRound] = useState<PettingRound>(() => newPettingRound(Date.now()));
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [now, setNow] = useState(Date.now());
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [over, setOver] = useState(false);
  const roundRef = useRef(round);
  roundRef.current = round;
  const overRef = useRef(false);
  const heartId = useRef(1);
  const lastPoint = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastTick = useRef(Date.now());
  const fieldRef = useRef<FieldSize | null>(null);
  const fillAnim = useRef(new Animated.Value(0)).current;

  // the clock: contentment eases while idle, and the minute runs out
  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setRound((r) => {
        const eased = easeCalm(r, t, lastTick.current);
        return eased;
      });
      lastTick.current = t;
    }, 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Animated.timing(fillAnim, { toValue: round.calm / 100, duration: reducedMotion ? 0 : 220, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [fillAnim, reducedMotion, round.calm]);

  // the end is scheduled once (a ref, not an effect cleanup: the clock re-runs this every tick and would
  // otherwise clear the timer before it fires); at full contentment the last hearts float up first
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (over || endTimer.current || !isPettingOver(round, now)) return;
    overRef.current = true;
    endTimer.current = setTimeout(
      () => {
        endTimer.current = null;
        setOver(true);
        setRound((r) => endPettingRound(r, Date.now()));
      },
      round.calm >= 100 ? 900 : 0
    );
  }, [now, over, round]);
  useEffect(
    () => () => {
      if (endTimer.current) clearTimeout(endTimer.current);
    },
    []
  );

  const addHeart = useCallback(
    (x: number, y: number, big: boolean) => {
      if (reducedMotion) return;
      const heart: Heart = { id: heartId.current++, x, y, progress: new Animated.Value(0), drift: (Math.random() - 0.5) * 50, size: big ? 30 : 16 + Math.round(Math.random() * 8) };
      setHearts((prev) => [...prev.slice(-(MAX_HEARTS - 1)), heart]);
    },
    [reducedMotion]
  );

  const stroke = useCallback(
    (x: number, y: number) => {
      if (overRef.current) return;
      const t = Date.now();
      const result = recordStroke(roundRef.current, t);
      roundRef.current = result.round;
      setRound(result.round);
      addHeart(x, y, result.purr);
      if (result.purr) {
        selection();
        setReaction(result.round.calm >= 100 ? "love" : "cheer");
        if (result.round.calm >= 100) success();
      } else if (result.gain >= 3) {
        tapLight();
      }
    },
    [addHeart]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !overRef.current,
        onMoveShouldSetPanResponder: () => !overRef.current,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          lastPoint.current = { x: locationX, y: locationY, at: Date.now() };
          stroke(locationX, locationY);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const last = lastPoint.current;
          const t = Date.now();
          if (!last) {
            lastPoint.current = { x: locationX, y: locationY, at: t };
            return;
          }
          const moved = Math.hypot(locationX - last.x, locationY - last.y);
          if (moved >= STROKE_DISTANCE && t - last.at >= STROKE_GAP_MS) {
            lastPoint.current = { x: locationX, y: locationY, at: t };
            stroke(locationX, locationY);
          }
        },
        onPanResponderRelease: () => {
          lastPoint.current = null;
        },
        onPanResponderTerminate: () => {
          lastPoint.current = null;
        },
      }),
    [stroke]
  );

  const restart = () => {
    overRef.current = false;
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = null;
    setOver(false);
    setHearts([]);
    lastPoint.current = null;
    lastTick.current = Date.now();
    const fresh = newPettingRound(Date.now());
    roundRef.current = fresh;
    setRound(fresh);
  };

  const calm = Math.round(round.calm);
  const meterWord = calm >= 100 ? "Completely content" : calm >= 75 ? "Nearly melting" : calm >= 50 ? "Leaning in" : calm >= 25 ? "Warming up" : "Say hello";
  // with VoiceOver the meter is the game: say each new stage as it is reached
  const spokenWord = useRef(meterWord);
  useEffect(() => {
    if (meterWord === spokenWord.current) return;
    spokenWord.current = meterWord;
    if (meterWord !== "Say hello") announce(`${displayName}: ${meterWord.toLowerCase()}`);
  }, [displayName, meterWord]);
  const hint = round.strokes === 0 && !over ? `Stroke ${displayName} slowly, like you mean it` : round.flow >= 6 ? "That rhythm. Keep it just like that." : calm >= 100 ? `${displayName} is completely content.` : null;

  return (
    <GameField title="Pet the pet" stat={`${calm}% content`} secondary={`${pettingSecondsLeft(round, now)}s`} onClose={() => navigation.goBack()} hint={hint}>
      {(field) => {
        fieldRef.current = field;
        const petLeft = field.width / 2 - PET_SIZE * 0.6;
        const petTop = Math.max(24, field.height * 0.78 - PET_SIZE);
        return (
          <>
            <View style={[styles.meterWrap, { top: Math.max(96, petTop - 52), left: 40, right: 40 }]} pointerEvents="none" accessible accessibilityLabel={`${calm} percent content`}>
              <View style={styles.meterTrack}>
                <Animated.View style={[styles.meterFill, { width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
              </View>
              <Text style={styles.meterLabel}>{meterWord}</Text>
            </View>
            <View style={[styles.petWrap, { left: petLeft, top: petTop, width: PET_SIZE * 1.2, height: PET_SIZE * 1.25 }]} {...responder.panHandlers}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Stroke ${displayName}`}
              accessibilityHint="Double tap for each stroke. A slow, steady rhythm works best."
              // VoiceOver cannot stroke: each double tap (activate) is one stroke at the pet's back
              accessibilityActions={[{ name: "activate", label: "Stroke" }]}
              onAccessibilityAction={() => stroke(PET_SIZE * 0.6, PET_SIZE * 0.5)}
            >
              <PetPortrait sources={sources} look={look} size={PET_SIZE} mood={pettingMood(round.calm)} reaction={reaction} onReactionEnd={() => setReaction(null)} allowOriginal />
              {hearts.map((heart) => (
                <HeartView key={heart.id} heart={heart} onDone={(id) => setHearts((prev) => prev.filter((h) => h.id !== id))} />
              ))}
            </View>
            {over ? (
              <GameEndCard
                game="petting"
                userId={user?.id}
                petName={displayName}
                score={pettingScore(round)}
                summary={pettingSummary(round, displayName)}
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
  petWrap: { position: "absolute", alignItems: "center", justifyContent: "flex-end" },
  heart: { position: "absolute" },
  meterWrap: { position: "absolute", alignItems: "center" },
  meterTrack: { width: "100%", height: 10, borderRadius: 5, backgroundColor: "rgba(255,251,246,0.55)", overflow: "hidden" },
  meterFill: { height: 10, borderRadius: 5, backgroundColor: brand.bloom },
  meterLabel: { marginTop: 6, color: "#FFF8F0", fontFamily: fonts.bodyBold, fontSize: 13, textShadowColor: "rgba(20,20,30,0.45)", textShadowRadius: 4 },
});
