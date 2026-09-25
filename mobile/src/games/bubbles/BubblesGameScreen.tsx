import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { usePet } from "../../hooks/usePet";
import PetPortrait, { type PetReaction } from "../../components/pet/PetPortrait";
import GameField, { useReducedMotionFlag, type FieldSize } from "../GameField";
import GameEndCard from "../GameEndCard";
import { playDing } from "../../utils/sfx";
import {
  Bubble,
  BubblesRound,
  bubblesSecondsLeft,
  bubblesSummary,
  endBubblesRound,
  isRoundOver,
  newBubblesRound,
  nextSpawnDelayMs,
  recordMiss,
  recordPop,
  riseDurationMs,
  shouldCheer,
  spawnBubble,
} from "./bubbleLogic";

const PET_SIZE = 108;

type LiveBubble = { bubble: Bubble; progress: Animated.Value; pop: Animated.Value };

function BubbleView({
  live,
  field,
  reducedMotion,
  onPop,
  onEscape,
}: {
  live: LiveBubble;
  field: FieldSize;
  reducedMotion: boolean;
  onPop: (bubble: Bubble) => void;
  onEscape: (bubble: Bubble) => void;
}) {
  const { bubble, progress, pop } = live;
  const popped = useRef(false);
  useEffect(() => {
    const duration = reducedMotion ? Math.round(riseDurationMs(bubble, field.height) * 0.8) : riseDurationMs(bubble, field.height);
    const animation = Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished && !popped.current) onEscape(bubble);
    });
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePop = () => {
    if (popped.current) return;
    popped.current = true;
    progress.stopAnimation();
    Animated.timing(pop, { toValue: 1, duration: reducedMotion ? 60 : 170, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() =>
      onPop(bubble)
    );
  };

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [field.height + bubble.size, -bubble.size * 2] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, bubble.drift] });
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const opacity = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const left = bubble.xRatio * field.width - bubble.size / 2;

  return (
    <Animated.View
      style={[styles.bubbleWrap, { left, width: bubble.size, height: bubble.size, transform: [{ translateY }, { translateX }, { scale }], opacity }]}
    >
      <Pressable
        onPress={handlePop}
        style={[styles.bubble, { width: bubble.size, height: bubble.size, borderRadius: bubble.size / 2 }]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Bubble"
      >
        <View style={[styles.shine, { width: bubble.size * 0.28, height: bubble.size * 0.18, top: bubble.size * 0.16, left: bubble.size * 0.18 }]} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Bubbles: they drift up through the garden, tap them before they float away. Thirty seconds; every
 * fifth pop in a row makes the pet cheer.
 */
export default function BubblesGameScreen({ navigation }: any) {
  const { user } = useAuth();
  const { sources, displayName } = usePet();
  const reducedMotion = useReducedMotionFlag();

  const [round, setRound] = useState<BubblesRound>(() => newBubblesRound(Date.now()));
  const [bubbles, setBubbles] = useState<LiveBubble[]>([]);
  const [now, setNow] = useState(Date.now());
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [over, setOver] = useState(false);
  const roundRef = useRef(round);
  roundRef.current = round;
  const overRef = useRef(false);
  const idRef = useRef(1);
  const fieldRef = useRef<FieldSize | null>(null);
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSpawn = useCallback(() => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    const elapsed = Date.now() - roundRef.current.startedAt;
    spawnTimer.current = setTimeout(() => {
      if (overRef.current) return;
      const bubble = spawnBubble(idRef.current++, Math.random(), Date.now());
      setBubbles((prev) => [...prev, { bubble, progress: new Animated.Value(0), pop: new Animated.Value(0) }]);
      scheduleSpawn();
    }, nextSpawnDelayMs(elapsed));
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

  useEffect(() => {
    if (!over && isRoundOver(round, now)) {
      overRef.current = true;
      setOver(true);
      setRound((r) => endBubblesRound(r, now));
      if (spawnTimer.current) clearTimeout(spawnTimer.current);
    }
  }, [now, over, round]);

  const remove = (id: number) => setBubbles((prev) => prev.filter((item) => item.bubble.id !== id));

  const handlePop = (bubble: Bubble) => {
    if (overRef.current) {
      remove(bubble.id);
      return;
    }
    const next = recordPop(roundRef.current, bubble);
    setRound(next);
    playDing();
    if (shouldCheer(next.streak)) setReaction("cheer");
    remove(bubble.id);
  };

  const handleEscape = (bubble: Bubble) => {
    if (!overRef.current) setRound((r) => recordMiss(r));
    remove(bubble.id);
  };

  const restart = () => {
    overRef.current = false;
    setOver(false);
    setBubbles([]);
    setRound(newBubblesRound(Date.now()));
    scheduleSpawn();
  };

  return (
    <GameField
      title="Bubbles"
      stat={`${round.score} pts`}
      secondary={`${bubblesSecondsLeft(round, now)}s`}
      onClose={() => navigation.goBack()}
      hint={round.popped === 0 && !over ? "Tap the bubbles before they float away" : round.streak >= 5 ? `${round.streak} in a row!` : null}
    >
      {(field) => {
        fieldRef.current = field;
        return (
          <>
            {bubbles.map((live) => (
              <BubbleView key={live.bubble.id} live={live} field={field} reducedMotion={reducedMotion} onPop={handlePop} onEscape={handleEscape} />
            ))}
            <View pointerEvents="none" style={[styles.petWrap, { left: field.width / 2 - PET_SIZE * 0.6, top: field.height * 0.86 - PET_SIZE, width: PET_SIZE * 1.2 }]}>
              <PetPortrait
                sources={sources}
                size={PET_SIZE}
                mood={round.streak >= 5 ? "excited" : "happy"}
                reaction={reaction}
                onReactionEnd={() => setReaction(null)}
                allowOriginal
              />
            </View>
            {over ? (
              <GameEndCard
                game="bubbles"
                userId={user?.id}
                petName={displayName}
                score={round.score}
                summary={bubblesSummary(round, displayName)}
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
  petWrap: { position: "absolute", alignItems: "center" },
  bubbleWrap: { position: "absolute", top: 0 },
  bubble: {
    backgroundColor: "rgba(190,235,255,0.32)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#7dd3fc",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  shine: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
    transform: [{ rotate: "-25deg" }],
  },
});
