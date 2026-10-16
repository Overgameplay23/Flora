// Every task for today in one list, in the garden's own visual language. The rows are the same
// cards as Home; the copy avoids "improve your mood" bargaining (product strategy report).
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { notify } from "../utils/confirm";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import type { PetReaction } from "../components/pet/PetPortrait";
import PetMascot from "../components/pet/PetMascot";
import { PetEmptyState, PetLoading } from "../components/pet/PetMoments";
import CareToast from "../components/home/CareToast";
import FinchTaskCard from "../components/finchHome/FinchTaskCard";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import { useTheme } from "../theme/theme";
import { categories, type } from "../theme/tokens";
import { playDing } from "../utils/sfx";
import { success, tapSoft, warning } from "../utils/haptics";
import { completeTaskWithResilience, completionDateKey } from "../services/taskCompletion";
import { getTaskPoints } from "../domain/taskPoints";
import { careDoneLine } from "../domain/homeDialogue";
import { catalogById, catalogIdForTitle } from "../domain/plan";
import { isPlayTask } from "../games/playStatsLogic";

type Task = {
  id: number | string;
  title: string;
  done: boolean;
  category?: string | null;
  difficulty?: number | string | null;
  points?: number | null;
};

/** Outline glyphs for tasks that are not in the plan catalog, in turn down the list. */
const ICONS = ["water-outline", "book-outline", "create-outline", "sunny-outline", "leaf-outline", "heart-outline"];

const CARE_CATEGORIES = new Set(Object.keys(categories));

/**
 * How a task row looks: its own care category when it has one, else the plan catalog's (matched by title),
 * else body; the catalog's glyph and minutes when the title is one of its tasks.
 */
function lookFor(task: Task, index: number, petName: string) {
  const catalogId = catalogIdForTitle(task.title, petName);
  const entry = catalogId ? catalogById(catalogId) : undefined;
  const play = isPlayTask(task.title);
  const own = task.category && CARE_CATEGORIES.has(task.category) ? task.category : null;
  return {
    category: own ?? entry?.category ?? (play ? "play" : "body"),
    icon: entry?.icon ?? (play ? "game-controller-outline" : ICONS[index % ICONS.length]),
    minutes: entry?.minutes ?? null,
  };
}

export default function DailyTasksScreen() {
  const { user } = useAuth();
  const { sources, look, displayName, memorial } = usePet();
  const theme = useTheme();
  const { surface } = theme;
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTaskIds, setCompletingTaskIds] = useState<Record<string, boolean>>({});
  const [completingAll, setCompletingAll] = useState(false);
  const [taskMutationNoticeById, setTaskMutationNoticeById] = useState<Record<string, { type: "error" | "queued"; message: string }>>({});
  const [petReaction, setPetReaction] = useState<PetReaction | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const completedThisSession = useRef(false);
  const celebratedAllDone = useRef(false);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const { data: rows, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order")
      .order("created_at");
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    const { data: completionRows, error: completionError } = await supabase
      .from("task_completions")
      .select("task_id")
      .eq("user_id", user.id)
      .eq("completed_date", completionDateKey());
    if (completionError) {
      console.error(completionError);
    }
    const completedIds = new Set((completionRows || []).map((row) => String(row.task_id)));
    const merged = (rows || []).map((task) => ({
      id: task.id,
      title: task.title,
      done: completedIds.has(String(task.id)),
      category: task.category ?? task.type ?? null,
      difficulty: task.difficulty ?? null,
      points: Number.isFinite(Number(task.points)) ? Number(task.points) : null,
    }));
    setTasks(merged);
    setTaskMutationNoticeById((prev) => {
      const next = { ...prev };
      merged.forEach((task) => {
        if (task.done) delete next[String(task.id)];
      });
      return next;
    });
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks])
  );

  /** A tick landed: a soft tap, and the pet notices (cheer + a line in the toast). */
  const celebrate = useCallback(
    (points: number = 0) => {
      completedThisSession.current = true;
      tapSoft();
      if (memorial) return;
      setPetReaction("cheer");
      // the same line Home uses, Sprouts included, so a tick reads the same wherever it lands
      setToast({ id: Date.now(), text: careDoneLine(displayName, Math.max(0, Number(points) || 0), Date.now() / 1000) });
    },
    [displayName, memorial]
  );

  const toggleTask = async (id: number | string, options?: { retry?: boolean }) => {
    const retry = !!options?.retry;
    const task = tasks.find((t) => t.id === id);
    if (!task || !user?.id) return;
    if (task.done) {
      notify("Already done today", "That one is already in the garden.");
      return;
    }
    const key = String(id);
    if (completingTaskIds[key] || completingAll) return;

    setCompletingTaskIds((prev) => ({ ...prev, [key]: true }));
    setTaskMutationNoticeById((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      const mutation = await completeTaskWithResilience({
        taskId: id,
        retry,
        eventMeta: { category: task.category ?? null, difficulty: task.difficulty ?? null, points: task.points ?? null },
      });
      if (mutation.state === "queued") {
        setTaskMutationNoticeById((prev) => ({ ...prev, [key]: { type: "queued", message: "Queued. Will sync when online." } }));
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
      if (mutation.result.inserted) {
        playDing();
        celebrate(mutation.result.points_awarded);
      } else notify("Already done today", "That one is already in the garden.");
    } catch (error) {
      warning();
      setTaskMutationNoticeById((prev) => ({ ...prev, [key]: { type: "error", message: "Couldn't save. Tap to retry." } }));
      console.error("TASK_COMPLETE_ERROR", error);
    } finally {
      setCompletingTaskIds((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const completeAll = async () => {
    if (!user?.id || completingAll) return;
    const incomplete = tasks.filter((task) => !task.done);
    if (incomplete.length === 0) return;
    setCompletingAll(true);
    let insertedCount = 0;
    try {
      for (const task of incomplete) {
        const taskKey = String(task.id);
        const mutation = await completeTaskWithResilience({
          taskId: task.id,
          eventMeta: { category: task.category ?? null, difficulty: task.difficulty ?? null, points: task.points ?? null },
        });
        if (mutation.state === "queued") {
          setTaskMutationNoticeById((prev) => ({ ...prev, [taskKey]: { type: "queued", message: "Queued. Will sync when online." } }));
          continue;
        }
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: true } : t)));
        if (mutation.result.inserted) insertedCount += 1;
      }
      if (insertedCount > 0) {
        playDing();
        celebrate();
      }
    } catch (error) {
      console.error("TASK_COMPLETE_ALL_ERROR", error);
      warning();
      setTaskMutationNoticeById((prev) => ({ ...prev, __all__: { type: "error", message: "Couldn't save everything. Tap a task to retry." } }));
    } finally {
      setCompletingAll(false);
    }
  };

  const doneCount = tasks.filter((t) => t.done).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const remaining = tasks.length - doneCount;

  // the whole list done in this visit: one bigger moment (success, the pet's love, a warmer line)
  useEffect(() => {
    if (!allDone || celebratedAllDone.current || !completedThisSession.current) return undefined;
    celebratedAllDone.current = true;
    const id = setTimeout(() => {
      success();
      if (memorial) return;
      setPetReaction("love");
      setToast({ id: Date.now(), text: `All done. ${displayName} is so proud of you.` });
    }, 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  if (loading) {
    return (
      <Screen scroll={false} centered>
        <PetLoading />
      </Screen>
    );
  }

  return (
    <View style={styles.fill}>
      <Screen bottomPad={96}>
        {tasks.length === 0 ? (
          <PetEmptyState title="No tasks yet" body="Edit your habits from Home to add some." mood="calm" style={styles.empty} />
        ) : (
          <Card style={styles.hero}>
            <PetMascot
              size={76}
              mood={allDone ? "happy" : "calm"}
              reaction={petReaction}
              onReactionEnd={() => setPetReaction(null)}
              showShadow={false}
              style={styles.heroPet}
            />
            <View style={styles.heroBody}>
              <Text style={[type.h2, { color: surface.text }]} accessibilityRole="header">
                Today with {displayName}
              </Text>
              <Text style={[type.callout, styles.heroLine, { color: surface.textSecondary }]}>
                {allDone ? "All done. Nothing more is expected today." : `${doneCount} of ${tasks.length} done. Do what fits, in any order.`}
              </Text>
            </View>
          </Card>
        )}

        {taskMutationNoticeById.__all__?.type === "error" ? (
          <Text style={[type.meta, styles.allError, { color: theme.alert }]}>{taskMutationNoticeById.__all__.message}</Text>
        ) : null}

        {tasks.map((task, index) => {
          const key = String(task.id);
          const notice = taskMutationNoticeById[key] ?? null;
          const isSaving = !!completingTaskIds[key];
          const care = lookFor(task, index, displayName);
          return (
            <FinchTaskCard
              key={key}
              title={task.title}
              reward={`${getTaskPoints({ title: task.title, category: task.category, points: task.points, difficulty: task.difficulty == null ? null : String(task.difficulty) })} pts`}
              icon={care.icon}
              category={care.category}
              minutes={care.minutes}
              completed={task.done}
              saving={isSaving}
              disabled={task.done || isSaving || completingAll}
              notice={notice}
              onToggle={() => toggleTask(task.id)}
              onRetry={() => toggleTask(task.id, { retry: true })}
            />
          );
        })}

        {remaining > 1 && !memorial ? (
          <Button
            label={`Mark the other ${remaining} done`}
            variant="secondary"
            size="md"
            onPress={completeAll}
            loading={completingAll}
            accessibilityLabel="Mark the rest done"
            containerStyle={styles.allButton}
          />
        ) : null}
      </Screen>
      <CareToast toast={toast} bottom={insets.bottom + 16} petSources={sources} petLook={look} night={theme.night} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hero: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  heroPet: { marginRight: 14 },
  heroBody: { flex: 1 },
  heroLine: { marginTop: 4 },
  allError: { marginBottom: 10, marginLeft: 4 },
  empty: { marginTop: 24 },
  allButton: { marginTop: 14, alignSelf: "center" },
});
