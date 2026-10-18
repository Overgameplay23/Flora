import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { usePet } from "../../hooks/usePet";
import PetPortrait, { type PetReaction } from "../../components/pet/PetPortrait";
import PressableScale from "../../components/common/PressableScale";
import GameField, { useReducedMotionFlag } from "../GameField";
import GameEndCard from "../GameEndCard";
import { useTheme } from "../../theme/theme";
import { fonts, radius, type } from "../../theme/tokens";
import { playDing } from "../../utils/sfx";
import { selection, tapLight, tapSoft } from "../../utils/haptics";
import { announce } from "../../utils/a11y";
import {
  BOARD_PAIRS,
  MEMORY_COLUMNS,
  MISMATCH_SHOW_MS,
  NEXT_BOARD_MS,
  type MemoryCard,
  type MemoryLayout,
  type MemoryRound,
  endMemoryRound,
  flipCard,
  hideMismatch,
  isBoardCleared,
  isMemoryComplete,
  flipCue,
  memoryFace,
  memoryLayout,
  memoryScore,
  memorySummary,
  newMemoryRound,
  nextBoard,
} from "./memoryLogic";

const PET_SIZE = 116;
/** under the HUD and the hint pill */
const TOP_RESERVE = 104;
/** the pet and the "Finish here" pill under the cards */
const BOTTOM_RESERVE = PET_SIZE + 84;
const FLIP_MS = 260;

function CardView({
  card,
  index,
  layout,
  up,
  reducedMotion,
  onPress,
}: {
  card: MemoryCard;
  index: number;
  layout: MemoryLayout;
  up: boolean;
  reducedMotion: boolean;
  onPress: (index: number) => void;
}) {
  const theme = useTheme();
  const { surface } = theme;
  const face = memoryFace(card.face);
  const tone = theme.tone(face.category);
  const back = theme.tone("play");
  // 0 face down, 1 face up; the card narrows to an edge at 0.5 and the other side shows as it widens again
  const flip = useRef(new Animated.Value(up ? 1 : 0)).current;
  const enter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) return undefined;
    const deal = Animated.timing(enter, { toValue: 1, duration: 280, delay: index * 35, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true });
    deal.start();
    return () => deal.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      flip.setValue(up ? 1 : 0);
      return undefined;
    }
    const turn = Animated.timing(flip, { toValue: up ? 1 : 0, duration: FLIP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    turn.start();
    return () => turn.stop();
  }, [flip, reducedMotion, up]);

  const scaleX = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.02, 1] });
  const backOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.51, 1], outputRange: [1, 1, 0, 0] });
  const faceOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.51, 1], outputRange: [0, 0, 1, 1] });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const column = index % MEMORY_COLUMNS;
  const row = Math.floor(index / MEMORY_COLUMNS);
  const left = layout.left + column * (layout.cardWidth + layout.gap);
  const top = layout.top + row * (layout.cardHeight + layout.gap);
  const glyph = Math.round(layout.cardWidth * 0.46);
  const label = card.matched ? `${face.label}, a pair` : up ? face.label : `Card ${index + 1}, face down`;

  return (
    <PressableScale
      onPress={() => onPress(index)}
      disabled={card.matched}
      pressedScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: card.matched }}
      containerStyle={[styles.cardSlot, { left, top, width: layout.cardWidth, height: layout.cardHeight }]}
      style={styles.cardFill}
    >
      <Animated.View style={[styles.cardFill, { opacity: enter, transform: [{ scale: enterScale }, { scaleX }] }]}>
        <Animated.View
          style={[styles.cardFace, { opacity: backOpacity, backgroundColor: surface.paperOverScene, borderColor: back.mid, boxShadow: surface.shadow }]}
        >
          <Ionicons name="paw-outline" size={Math.round(glyph * 0.62)} color={back.accent} />
        </Animated.View>
        <Animated.View
          style={[
            styles.cardFace,
            {
              opacity: faceOpacity,
              backgroundColor: tone.fill,
              borderColor: card.matched ? tone.accent : tone.mid,
              borderWidth: card.matched ? 2.5 : 1.5,
              boxShadow: surface.shadow,
            },
          ]}
        >
          <Ionicons name={face.icon as any} size={glyph} color={tone.accent} />
          {card.matched ? (
            <View style={styles.pairMark}>
              <Ionicons name="checkmark-circle-outline" size={18} color={tone.accent} />
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

/**
 * Memory Match: cards face down on the lawn, each hiding a care glyph. Turn two over; a pair stays, two that
 * differ turn back by themselves. Three boards (four, six, eight pairs), no clock, nothing to lose; finish
 * whenever it feels like enough. The score is the pairs found.
 */
export default function MemoryGameScreen({ navigation }: any) {
  const { user } = useAuth();
  const { sources, look, displayName } = usePet();
  const theme = useTheme();
  const { surface } = theme;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionFlag();

  const [round, setRound] = useState<MemoryRound>(() => newMemoryRound(Date.now(), Math.random));
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [facing, setFacing] = useState<"left" | "right">("right");
  const [over, setOver] = useState(false);
  const roundRef = useRef(round);
  roundRef.current = round;
  const overRef = useRef(false);
  const mismatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    for (const timer of [mismatchTimer, boardTimer, endTimer]) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const commit = useCallback((next: MemoryRound) => {
    roundRef.current = next;
    setRound(next);
  }, []);

  // the end is scheduled once (a ref): after the last board's beat, or straight away from "Finish here"
  const scheduleEnd = useCallback(
    (delay: number) => {
      if (overRef.current || endTimer.current) return;
      overRef.current = true;
      if (mismatchTimer.current) clearTimeout(mismatchTimer.current);
      mismatchTimer.current = null;
      endTimer.current = setTimeout(() => {
        endTimer.current = null;
        commit(endMemoryRound(roundRef.current, Date.now()));
        setOver(true);
      }, delay);
    },
    [commit]
  );

  const handleFlip = useCallback(
    (index: number) => {
      if (overRef.current) return;
      const { round: next, event } = flipCard(roundRef.current, index);
      if (event === "ignored") return;
      if (mismatchTimer.current) clearTimeout(mismatchTimer.current);
      mismatchTimer.current = null;
      commit(next);
      setFacing(index % MEMORY_COLUMNS < MEMORY_COLUMNS / 2 ? "left" : "right");
      const flipped = next.cards[index];
      announce(flipped ? flipCue(event, memoryFace(flipped.face).label) : null);

      if (event === "flipped") {
        selection();
        return;
      }
      if (event === "mismatch") {
        // nothing is counted; the two just turn back after a moment (or as soon as another card is tapped)
        selection();
        mismatchTimer.current = setTimeout(() => {
          mismatchTimer.current = null;
          commit(hideMismatch(roundRef.current));
        }, MISMATCH_SHOW_MS);
        return;
      }
      playDing();
      if (event === "match") {
        tapLight();
        setReaction("cheer");
        return;
      }
      tapSoft();
      setReaction("love");
      if (event === "all-cleared") {
        scheduleEnd(NEXT_BOARD_MS);
        return;
      }
      boardTimer.current = setTimeout(() => {
        boardTimer.current = null;
        if (!overRef.current) commit(nextBoard(roundRef.current, Math.random));
      }, NEXT_BOARD_MS);
    },
    [commit, scheduleEnd]
  );

  const finish = () => {
    if (boardTimer.current) clearTimeout(boardTimer.current);
    boardTimer.current = null;
    scheduleEnd(0);
  };

  const restart = () => {
    clearTimers();
    overRef.current = false;
    setOver(false);
    setReaction(null);
    commit(newMemoryRound(Date.now(), Math.random));
  };

  const cleared = isBoardCleared(round);
  const complete = isMemoryComplete(round);
  const boardNumber = round.board + 1;
  const hint = over
    ? null
    : complete
      ? "Every board cleared"
      : cleared
        ? `Board ${boardNumber} cleared. Here comes the next one`
        : round.board === 0 && round.cards.every((card) => !card.seen)
          ? "Tap two cards to turn them over"
          : null;
  const pairsLabel = `${round.pairs} ${round.pairs === 1 ? "pair" : "pairs"}`;

  return (
    <GameField title="Memory Match" stat={pairsLabel} secondary={`Board ${boardNumber}/${BOARD_PAIRS.length}`} onClose={() => navigation.goBack()} hint={hint}>
      {(field) => {
        const layout = memoryLayout(round.cards.length, field.width, field.height, insets.top + TOP_RESERVE, insets.bottom + BOTTOM_RESERVE);
        const gridBottom = layout.top + layout.rows * layout.cardHeight + (layout.rows - 1) * layout.gap;
        const petTop = Math.min(field.height - insets.bottom - BOTTOM_RESERVE + 8, gridBottom + 16);
        return (
          <>
            {round.cards.map((card, index) => (
              <CardView
                key={card.key}
                card={card}
                index={index}
                layout={layout}
                up={card.matched || round.open.includes(index)}
                reducedMotion={reducedMotion}
                onPress={handleFlip}
              />
            ))}
            <View pointerEvents="none" style={[styles.petWrap, { top: petTop, left: (field.width - PET_SIZE * 1.2) / 2, width: PET_SIZE * 1.2 }]}>
              <PetPortrait
                sources={sources}
                look={look}
                size={PET_SIZE}
                mood={cleared ? "excited" : "happy"}
                facing={facing}
                reaction={reaction}
                onReactionEnd={() => setReaction(null)}
                allowOriginal
              />
            </View>
            {round.pairs > 0 && !over && !complete ? (
              <View style={[styles.finishWrap, { bottom: insets.bottom + 18 }]} pointerEvents="box-none">
                <PressableScale
                  onPress={finish}
                  pressedScale={0.95}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Finish here with ${pairsLabel}`}
                  style={[styles.finish, { backgroundColor: surface.paperOverScene, boxShadow: surface.shadow }]}
                >
                  <Ionicons name="flag-outline" size={16} color={surface.text} />
                  <Text style={[type.callout, styles.finishText, { color: surface.text }]}>Finish here</Text>
                </PressableScale>
              </View>
            ) : null}
            {over ? (
              <GameEndCard
                game="memory"
                userId={user?.id}
                petName={displayName}
                score={memoryScore(round)}
                summary={memorySummary(round, displayName)}
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
  cardSlot: { position: "absolute" },
  cardFill: { flex: 1, alignSelf: "stretch" },
  cardFace: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  pairMark: { position: "absolute", top: 5, right: 5 },
  petWrap: { position: "absolute", alignItems: "center" },
  finishWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  finish: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
  },
  finishText: { fontFamily: fonts.bodyBold },
});
