import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { createPlayTask, findPlayTask, recordPlaySession, type GameId } from "./playStats";
import { completeTaskWithResilience } from "../services/taskCompletion";
import Button from "../components/common/Button";
import IconTile from "../components/common/IconTile";
import PressableScale from "../components/common/PressableScale";
import PetMascot from "../components/pet/PetMascot";
import type { PetReaction } from "../components/pet/PetPortrait";
import { useTheme } from "../theme/theme";
import { fonts, radius, type } from "../theme/tokens";
import { success, warning } from "../utils/haptics";
import { announce } from "../utils/a11y";

type GameEndCardProps = {
  game: GameId;
  userId: string | null | undefined;
  petName: string;
  score: number;
  summary: string;
  onPlayAgain: () => void;
  onDone: () => void;
};

type Outcome = { bestBeaten: boolean; best: number; taskCompleted: boolean; pointsAwarded: number; hasTask: boolean };

// The same soft plum scrim as the kit's Sheet (src/components/common/Sheet.tsx); there is no token for it yet.
const SCRIM = "rgba(32,24,40,0.42)";

/**
 * The end of a round: records the session once, shows the score against the best, and offers to make
 * playtime a daily task (points for the garden through complete_task) when the person has none. A paper
 * sheet over the lawn with the pet celebrating; the success haptic only when a play task gets completed.
 */
export default function GameEndCard({ game, userId, petName, score, summary, onPlayAgain, onDone }: GameEndCardProps) {
  const theme = useTheme();
  const { surface, night } = theme;
  const tone = theme.tone("play");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [taskMessage, setTaskMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const [reaction, setReaction] = useState<PetReaction | null>("cheer");

  // the round is over: say how it went (Android reads the live region below; iOS needs this)
  useEffect(() => {
    announce(`Good game. Score ${score}. ${summary}`);
  }, [score, summary]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = await recordPlaySession({ userId, game, score, petName });
      let hasTask = result.taskCompleted;
      if (!hasTask && userId) {
        try {
          hasTask = !!(await findPlayTask(userId));
        } catch {}
      }
      if (alive) {
        setOutcome({
          bestBeaten: result.bestBeaten,
          best: result.stats.best[game] ?? score,
          taskCompleted: result.taskCompleted,
          pointsAwarded: result.pointsAwarded,
          hasTask,
        });
        if (result.taskCompleted) {
          success();
          setReaction("love");
        }
      }
    })();
    return () => {
      alive = false;
    };
    // record exactly once per mounted end card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPlayTask = async () => {
    if (!userId || addingTask) return;
    setAddingTask(true);
    try {
      const task = await createPlayTask(userId, petName);
      const mutation = await completeTaskWithResilience({ taskId: task.id, eventMeta: { category: "play", points: null } });
      const completed = mutation.state === "success";
      const points = mutation.state === "success" ? mutation.result.points_awarded : 0;
      setTaskMessage({ text: points > 0 ? `Added. Today's playtime earned +${points} Sprouts for the garden.` : "Added. It will count from tomorrow.", failed: false });
      setOutcome((prev) => (prev ? { ...prev, hasTask: true, taskCompleted: true, pointsAwarded: points } : prev));
      if (completed) {
        success();
        setReaction("love");
      }
    } catch (error) {
      console.warn("PLAY_TASK_CREATE_FAILED", (error as any)?.message || String(error));
      warning();
      setTaskMessage({ text: "Couldn't add the task right now.", failed: true });
    } finally {
      setAddingTask(false);
    }
  };

  return (
    <View style={[styles.backdrop, { backgroundColor: SCRIM }]} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: surface.paper, boxShadow: surface.shadowRaised }]} accessibilityLiveRegion="polite">
        <PetMascot size={92} mood="excited" reaction={reaction} onReactionEnd={() => setReaction(null)} night={night} showShadow={false} />
        <Text style={[type.title, styles.title, { color: surface.text }]} accessibilityRole="header">
          {outcome?.bestBeaten ? "New best!" : "Good game"}
        </Text>
        <Text style={[styles.score, { color: tone.accent }]} accessibilityLabel={`Score ${score}`}>
          {score}
        </Text>
        <Text style={[type.callout, styles.summary, { color: surface.textSecondary }]}>{summary}</Text>
        {outcome ? (
          <Text style={[type.meta, styles.meta, { color: surface.textTertiary }]}>
            Best {outcome.best}
            {outcome.taskCompleted && outcome.pointsAwarded > 0 ? ` · +${outcome.pointsAwarded} Sprouts for the garden` : ""}
          </Text>
        ) : (
          <ActivityIndicator color={tone.accent} style={styles.meta} />
        )}

        {outcome && !outcome.hasTask && userId ? (
          <PressableScale
            onPress={addPlayTask}
            disabled={addingTask}
            pressedScale={0.97}
            accessibilityRole="button"
            accessibilityState={{ disabled: addingTask, busy: addingTask }}
            containerStyle={styles.offerSlot}
            style={[styles.offer, { backgroundColor: theme.night ? surface.sunken : tone.tint }, addingTask && styles.disabled]}
          >
            <IconTile icon="add-circle-outline" category="play" on="fill" size={34} />
            <Text style={[type.callout, styles.offerText, { color: surface.text }]}>{addingTask ? "Adding…" : `Make "Play with ${petName}" a daily task`}</Text>
          </PressableScale>
        ) : null}
        {taskMessage ? (
          <Text style={[type.meta, styles.taskMessage, { color: taskMessage.failed ? theme.alert : surface.textSecondary }]}>{taskMessage.text}</Text>
        ) : null}

        <View style={styles.actions}>
          <Button label="Done" variant="secondary" size="md" block onPress={onDone} containerStyle={styles.action} />
          <Button label="Play again" variant="primary" size="md" block onPress={onPlayAgain} containerStyle={styles.action} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.sheet,
    borderCurve: "continuous",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: "center",
  },
  title: { marginTop: 8, textAlign: "center" },
  score: { fontFamily: fonts.display, fontSize: 52, lineHeight: 60, marginTop: 2 },
  summary: { marginTop: 4, textAlign: "center" },
  meta: { marginTop: 10 },
  offerSlot: { alignSelf: "stretch", marginTop: 16 },
  offer: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.row, borderCurve: "continuous" },
  offerText: { flex: 1, fontFamily: fonts.bodyBold },
  taskMessage: { marginTop: 10, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 20, alignSelf: "stretch" },
  action: { flex: 1 },
  disabled: { opacity: 0.6 },
});
