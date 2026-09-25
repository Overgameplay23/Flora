import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  AppState,
  Modal,
  TextInput,
  Platform,
  ToastAndroid,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../../src/contexts/AuthContext";
import { fetchGardenItems, getGardenProgress, todayKey } from "../../src/services/dailyLoop";
import { fetchCatalog, fetchUserPlants } from "../../src/services/garden";
// Do not query pet columns directly; use fetchPet for schema compatibility.
import { savePetName } from "../../src/services/petService";
import { setPetNameLocally } from "../../src/services/petStore";
import { usePet } from "../../src/hooks/usePet";
import { useCycle } from "../../src/hooks/useCycle";
import { phaseLabel } from "../../src/domain/cycle";
import { shortDate } from "../../src/domain/calendar";
import { actForTask, celebrationLine, petMoodFromStores } from "../../src/domain/petMood";
import { isPlayTask } from "../../src/games/playStatsLogic";
import { supabase } from "../../src/lib/supabase";
import { isProtectedMood } from "../../src/domain/protectedMode";
import FinchGardenHeader from "../../src/components/finchHome/FinchGardenHeader";
import FinchProgressCard from "../../src/components/finchHome/FinchProgressCard";
import FinchQuickActions from "../../src/components/finchHome/FinchQuickActions";
import FinchSectionTitle from "../../src/components/finchHome/FinchSectionTitle";
import FinchTaskCard from "../../src/components/finchHome/FinchTaskCard";
import BreathingModal from "../../src/components/checkin/BreathingModal";
import EditHabitsModal from "../../src/components/habits/EditHabitsModal";
import PointsDebugPanel from "../../src/components/dev/PointsDebugPanel";
import { playDing } from "../../src/utils/sfx";
import { getTaskPoints } from "../../src/domain/taskPoints";
import { getPointsDebugSnapshot } from "../../src/domain/progressDebug";
import { applyHabitOverrides, getHabitOverrides, setHabitOverrides } from "../../src/services/habitOverrides";
import { completeTaskWithResilience, syncPendingCompletions, completionDateKey } from "../../src/services/taskCompletion";
import { fetchLast7DaysMetrics, recomputePetState } from "../../src/services/retention";
import { diagLog } from "../../src/utils/diagLog";

const TASK_STORAGE_PREFIX = "finch_tasks";
const PET_NAME_MAX_CHARS = 24;
const DEFAULT_TASKS = [
  { id: "local-1", title: "Drink water", icon: "droplet", difficulty: "normal" },
  { id: "local-2", title: "Read 10 pages", icon: "book", difficulty: "hard" },
  { id: "local-3", title: "Tend the garden", icon: "feather", difficulty: "normal" },
];
const TASK_ICON_SET = ["droplet", "book", "feather"];

function toTaskRewardLabel(task) {
  return `${getTaskPoints(task)} pts`;
}

function toHomeMoodScore(moodState) {
  if (moodState === "sad") return 2;
  if (moodState === "neutral") return 3;
  if (moodState === "happy") return 4;
  return null;
}

function toWeekdayFromDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
}

function toMoodLabel(mood) {
  const raw = String(mood || "").trim();
  if (!raw) return "Neutral";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function normalizePetName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasStylizedPetReady(pet) {
  if (!pet) return false;
  if (pet.stylized_url || pet.cutout_url) return true;
  const status = String(pet.processing_status || "").toLowerCase();
  if (status === "ready") return true;
  if (status === "legacy" && (pet.photo_url || pet.original_photo_url)) return true;
  return false;
}

function showSavePetNameError(message) {
  const text = message || "Could not save pet name. Please try again.";
  if (Platform.OS === "android") {
    ToastAndroid.show(text, ToastAndroid.LONG);
    return;
  }
  Alert.alert("Could not save pet name", text);
}

function taskStorageKey(userId, dateKey) {
  return `${TASK_STORAGE_PREFIX}:${userId || "guest"}:${dateKey}`;
}

function hydrateTasks(rawTasks) {
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    return DEFAULT_TASKS.map((task) => ({ ...task, reward: toTaskRewardLabel(task), done: false }));
  }
  return rawTasks.map((task, index) => {
    const fallback = DEFAULT_TASKS[index % DEFAULT_TASKS.length];
    const icon = TASK_ICON_SET.includes(task.icon) || task.icon === "play" ? task.icon : fallback.icon;
    const normalizedTask = {
      id: task.id || fallback.id,
      title: task.title || fallback.title,
      icon,
      difficulty: task.difficulty || fallback.difficulty || "normal",
      points: Number.isFinite(Number(task.points)) ? Number(task.points) : undefined,
      done: !!task.done,
      remoteId: task.remoteId,
    };
    return {
      ...normalizedTask,
      reward: toTaskRewardLabel(normalizedTask),
    };
  });
}

async function loadLocalTasks(userId, dateKey) {
  const key = taskStorageKey(userId, dateKey);
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      try {
        return hydrateTasks(JSON.parse(stored));
      } catch (_e) {
        return hydrateTasks(null);
      }
    }
    const fallback = hydrateTasks(null);
    await AsyncStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  } catch (_e) {
    return hydrateTasks(null);
  }
}

async function persistLocalTasks(userId, dateKey, tasks) {
  const key = taskStorageKey(userId, dateKey);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(tasks));
  } catch (_e) {
    console.warn("TASK_STORAGE_WRITE_FAILED");
  }
}

function completionRowsFromTasks(tasks) {
  return tasks.filter((task) => task.done).map((task) => ({ task_id: task.remoteId ?? task.id, done: true }));
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, profile, userStats, petEmotionState } = useAuth();
  // Re-read on every focus so the key cannot go stale across midnight (R-33).
  const [homeDateKey, setHomeDateKey] = useState(() => todayKey());
  const { pet, sources: petSources, name: petName, look: petLook, refresh: refreshPet } = usePet();
  const cycle = useCycle();
  const moodState = userStats?.pet_mood_state || null;
  const todayMood = toHomeMoodScore(moodState);
  const protectedMode = isProtectedMood(todayMood);
  const hasExistingCheckin = profile?.last_checkin_date === homeDateKey;

  const [tasks, setTasks] = useState([]);
  const [taskCompletionsToday, setTaskCompletionsToday] = useState([]);
  const [earnedPointsTodayServer, setEarnedPointsTodayServer] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [gardenItems, setGardenItems] = useState([]);
  const [gardenUnlockRows, setGardenUnlockRows] = useState([]);
  // Plants the user owns; the header scene roots them in the garden's soil patch.
  const [scenePlants, setScenePlants] = useState([]);
  const [completingTaskIds, setCompletingTaskIds] = useState({});
  const [taskMutationNoticeById, setTaskMutationNoticeById] = useState({});
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [editHabitsOpen, setEditHabitsOpen] = useState(false);
  const [savingHabitEdits, setSavingHabitEdits] = useState(false);
  const [petRetentionState, setPetRetentionState] = useState(null);
  const [retentionMetrics, setRetentionMetrics] = useState([]);
  const [loadingRetention, setLoadingRetention] = useState(false);
  const [petNameInput, setPetNameInput] = useState("");
  const [petNameModalVisible, setPetNameModalVisible] = useState(false);
  const [petNameError, setPetNameError] = useState("");
  const [savingPetName, setSavingPetName] = useState(false);
  // The pet reacts to what happens on this screen: hearts when tapped, a cheer + toast when a task is done.
  const [petReaction, setPetReaction] = useState(null);
  const [petAct, setPetAct] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const { height } = useWindowDimensions();

  // Ask for a name once the pet is painted and still unnamed.
  useEffect(() => {
    if (!user?.id) {
      setPetNameModalVisible(false);
      return;
    }
    setPetNameInput((prev) => (prev ? prev : petName));
    setPetNameModalVisible(hasStylizedPetReady(pet) && !normalizePetName(petName));
  }, [pet, petName, user?.id]);

  useEffect(() => {
    if (!protectedMode && breathingOpen) setBreathingOpen(false);
  }, [protectedMode, breathingOpen]);

  useEffect(() => {
    if (__DEV__) {
      console.info("HOME_PROTECTED_MODE", { protectedMode, hasExistingCheckin });
    }
  }, [protectedMode, hasExistingCheckin]);

  const loadRetentionData = useCallback(async () => {
    if (!user?.id) {
      setPetRetentionState(null);
      setRetentionMetrics([]);
      return;
    }

    setLoadingRetention(true);
    try {
      const [petState, metrics] = await Promise.all([recomputePetState(), fetchLast7DaysMetrics()]);
      setPetRetentionState(petState || null);
      setRetentionMetrics(Array.isArray(metrics) ? metrics : []);
    } catch (error) {
      console.warn("HOME_RETENTION_LOAD_ERROR", error?.message || String(error));
      setPetRetentionState(null);
      setRetentionMetrics([]);
    } finally {
      setLoadingRetention(false);
    }
  }, [user?.id]);

  const loadGardenData = useCallback(async () => {
    if (!user?.id) {
      setGardenUnlockRows([]);
      setGardenItems([]);
      setScenePlants([]);
      return;
    }

    // Owned plants for the header scene. Kept separate so a missing garden-upgrade schema only leaves
    // the patch empty instead of breaking the legacy progress card below.
    Promise.all([fetchUserPlants(), fetchCatalog()])
      .then(([owned, catalog]) => {
        const maxLevelById = new Map((catalog || []).map((plant) => [String(plant.id), plant.max_level]));
        setScenePlants(
          (owned || []).map((row) => ({
            id: String(row.plant_id),
            level: Number(row.level) || 0,
            maxLevel: Number(maxLevelById.get(String(row.plant_id))) || 5,
            purchasedAt: row.purchased_at || null,
          }))
        );
      })
      .catch((error) => {
        console.warn("HOME_SCENE_PLANTS_LOAD_ERROR", error?.message || String(error));
        setScenePlants([]);
      });

    try {
      const [progress, itemsResult] = await Promise.all([getGardenProgress(user.id), fetchGardenItems()]);
      setGardenUnlockRows(progress.rows || []);
      setGardenItems(itemsResult.rows || []);
    } catch (error) {
      console.warn("HOME_GARDEN_DATA_LOAD_ERROR", error?.message || String(error));
      setGardenUnlockRows([]);
      setGardenItems([]);
    }
  }, [user?.id]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    const dateKey = todayKey();
    const todayCompletionKey = completionDateKey();
    const userKey = user?.id || "guest";
    let nextTasks = [];
    let nextCompletions = [];

    if (user?.id) {
      try {
        const [{ data: rows, error }, { data: completionRows, error: completionError }] = await Promise.all([
          supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .eq("active", true)
            .order("sort_order")
            .order("created_at"),
          supabase
            .from("task_completions")
            .select("task_id, points")
            .eq("user_id", user.id)
            .eq("completed_date", todayCompletionKey),
        ]);

        if (error || !rows || rows.length === 0) {
          throw error || new Error("No tasks found");
        }
        if (completionError) {
          console.warn("TASK_COMPLETIONS_LOAD_ERROR", completionError?.message);
        }

        const completedIds = new Set((completionRows || []).map((row) => String(row.task_id)));
        const mapped = rows.map((task, index) => ({
          id: `remote-${task.id}`,
          remoteId: task.id,
          title: task.title,
          done: completedIds.has(String(task.id)),
          icon: isPlayTask(task.title) ? "play" : TASK_ICON_SET[index % TASK_ICON_SET.length],
          type: task.type,
          difficulty: task.difficulty,
          points: Number.isFinite(Number(task.points)) ? Number(task.points) : undefined,
        }));

        const overrides = await getHabitOverrides(userKey);
        nextTasks = applyHabitOverrides(mapped, overrides).map((task) => ({
          ...task,
          reward: toTaskRewardLabel(task),
        }));
        nextCompletions = (completionRows || []).map((row) => ({ task_id: row.task_id, completed: true }));
        setEarnedPointsTodayServer(
          (completionRows || []).reduce((sum, row) => {
            const numericPoints = Number(row?.points);
            if (!Number.isFinite(numericPoints)) return sum;
            return sum + Math.max(0, Math.floor(numericPoints));
          }, 0)
        );
      } catch (_e) {
        const fallbackTasks = await loadLocalTasks(user.id, dateKey);
        const overrides = await getHabitOverrides(userKey);
        nextTasks = applyHabitOverrides(fallbackTasks, overrides).map((task) => ({
          ...task,
          reward: toTaskRewardLabel(task),
        }));
        nextCompletions = completionRowsFromTasks(nextTasks);
        setEarnedPointsTodayServer(null);
      }
    } else {
      const guestTasks = await loadLocalTasks("guest", dateKey);
      const overrides = await getHabitOverrides(userKey);
      nextTasks = applyHabitOverrides(guestTasks, overrides).map((task) => ({
        ...task,
        reward: toTaskRewardLabel(task),
      }));
      nextCompletions = completionRowsFromTasks(nextTasks);
      setEarnedPointsTodayServer(null);
    }

    setTasks(nextTasks);
    setTaskCompletionsToday(nextCompletions);
    setTaskMutationNoticeById((prev) => {
      const next = { ...prev };
      nextTasks.forEach((task) => {
        if (task?.done) {
          delete next[task.id];
        }
      });
      return next;
    });
    setLoadingTasks(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setHomeDateKey(todayKey());
      void refreshPet();
      loadGardenData();
      loadTasks();
      loadRetentionData();
    }, [loadGardenData, refreshPet, loadTasks, loadRetentionData])
  );

  const syncQueuedCompletions = useCallback(
    async (source) => {
      if (!user?.id) return;
      try {
        const result = await syncPendingCompletions({ source });
        if (result.succeeded > 0) {
          await Promise.all([loadTasks(), loadGardenData(), loadRetentionData()]);
          if (Number.isFinite(Number(result.earned_points_today))) {
            setEarnedPointsTodayServer(Math.max(0, Math.floor(Number(result.earned_points_today))));
          }
        }
      } catch (error) {
        console.warn("TASK_QUEUE_SYNC_ERROR", error?.message || String(error));
      }
    },
    [loadGardenData, loadRetentionData, loadTasks, user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;

    void syncQueuedCompletions("startup");

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncQueuedCompletions("foreground");
      }
    });

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state?.isConnected === false || state?.isInternetReachable === false) return;
      void syncQueuedCompletions("connectivity_restored");
    });

    return () => {
      appStateSubscription.remove();
      netInfoUnsubscribe();
    };
  }, [syncQueuedCompletions, user?.id]);

  const pointsSnapshot = useMemo(
    () => {
      const snapshot = getPointsDebugSnapshot({
        tasks,
        completionsToday: taskCompletionsToday,
        gardenItems,
        gardenUnlocks: gardenUnlockRows,
        todayISO: homeDateKey,
      });
      const serverEarned = Number(earnedPointsTodayServer);
      if (!Number.isFinite(serverEarned)) return snapshot;

      const normalizedEarned = Math.max(0, Math.floor(serverEarned));
      const requiredPoints = Number.isFinite(Number(snapshot.requiredPoints))
        ? Math.max(1, Math.floor(Number(snapshot.requiredPoints)))
        : 1;
      const remaining = Math.max(requiredPoints - normalizedEarned, 0);
      return {
        ...snapshot,
        earnedPointsToday: normalizedEarned,
        remaining,
        isReady: normalizedEarned >= requiredPoints,
      };
    },
    [tasks, taskCompletionsToday, gardenItems, gardenUnlockRows, homeDateKey, earnedPointsTodayServer]
  );

  useEffect(() => {
    diagLog("GARDEN_PROGRESS", {
      earnedPointsToday: pointsSnapshot.earnedPointsToday,
      nextUnlock: pointsSnapshot.nextLockedItem?.id ?? null,
      remaining: pointsSnapshot.remaining,
    });
  }, [pointsSnapshot.earnedPointsToday, pointsSnapshot.nextLockedItem?.id, pointsSnapshot.remaining]);

  const completedCount = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  const profileStreak = profile?.current_streak ?? profile?.streak_count;
  const streakText = profileStreak > 0 ? `${profileStreak}-day streak` : "no streak yet";
  const moodText = moodState === "happy" ? "feeling happy" : moodState === "sad" ? "having a quiet day" : moodState === "neutral" ? "doing okay" : "settling in";
  const headerTitle = protectedMode
    ? hasExistingCheckin
      ? "That's enough for today"
      : "Go gently today"
    : "Welcome back";
  const headerSubtitle = protectedMode
    ? hasExistingCheckin
      ? "You already checked in. Keep things light."
      : "No pressure. Keep it simple today."
    : `${normalizePetName(petName) || "Your pet"} is ${moodText} \u00b7 ${streakText}`;
  const quickActionsTitle = protectedMode && !hasExistingCheckin ? "Simple next step" : "Quick Actions";
  const quickCheckInLabel = protectedMode ? "Quick check-in" : "Check-in";
  const secondaryActionLabel = protectedMode && !hasExistingCheckin ? "One minute breathing" : "Habits";
  const secondaryActionIcon = protectedMode && !hasExistingCheckin ? "wind" : "check-square";
  const headerHeight = Math.round(height * 0.4);

  const handleToggleTask = useCallback(
    async (taskId, options = {}) => {
      const retry = !!options.retry;
      const task = tasks.find((row) => row.id === taskId);
      if (!task) return;
      if (task.done) {
        Alert.alert("Already completed today", "This task was already completed today.");
        return;
      }
      if (completingTaskIds[taskId]) return;

      setCompletingTaskIds((prev) => ({ ...prev, [taskId]: true }));
      setTaskMutationNoticeById((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });

      const dateKey = todayKey();
      try {
        const nextTasks = tasks.map((row) => (row.id === taskId ? { ...row, done: true } : row));

        if (!user?.id || !task.remoteId) {
          setTasks(nextTasks);
          setTaskCompletionsToday(completionRowsFromTasks(nextTasks));
          setEarnedPointsTodayServer(null);
          await persistLocalTasks(user?.id || "guest", dateKey, nextTasks);
          playDing();
          setPetReaction("cheer");
          setPetAct(actForTask(task.title));
          setCelebration({ id: Date.now(), text: celebrationLine(normalizePetName(petName) || "Your pet", getTaskPoints(task), task.title.length) });
          return;
        }

        const mutation = await completeTaskWithResilience({
          taskId: task.remoteId,
          retry,
          eventMeta: {
            category: task.type || null,
            difficulty: task.difficulty ?? null,
            points: task.points ?? null,
          },
        });
        if (mutation.state === "queued") {
          setTaskMutationNoticeById((prev) => ({
            ...prev,
            [taskId]: { type: "queued", message: "Queued. Will sync when online." },
          }));
          return;
        }

        const result = mutation.result;
        setTasks(nextTasks);
        setTaskCompletionsToday((prev) => {
          const completionKey = String(task.remoteId);
          const alreadyHasRow = (prev || []).some((row) => String(row?.task_id) === completionKey);
          if (alreadyHasRow) return prev;
          return [...(prev || []), { task_id: task.remoteId, completed: true }];
        });
        setEarnedPointsTodayServer(result.earned_points_today);
        await persistLocalTasks(user.id, dateKey, nextTasks);
        if (result.inserted) {
          playDing();
          setPetReaction("cheer");
          setPetAct(actForTask(task.title));
          setCelebration({
            id: Date.now(),
            text: celebrationLine(normalizePetName(petName) || "Your pet", result.points_awarded, task.title.length + result.earned_points_today),
          });
        } else {
          Alert.alert("Already completed today", "This task was already completed today.");
        }
        await Promise.all([loadGardenData(), loadRetentionData(), syncQueuedCompletions("post_success")]);
      } catch (error) {
        setTaskMutationNoticeById((prev) => ({
          ...prev,
          [taskId]: { type: "error", message: "Couldn't save. Tap to retry." },
        }));
        console.error("TASK_COMPLETE_ERROR", error);
      } finally {
        setCompletingTaskIds((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
    },
    [completingTaskIds, loadGardenData, loadRetentionData, petName, syncQueuedCompletions, tasks, user?.id]
  );

  const retentionMoodLabel = toMoodLabel(petRetentionState?.mood);
  const retentionStreakDays = Number.isFinite(Number(petRetentionState?.streak_days))
    ? Math.max(0, Math.floor(Number(petRetentionState?.streak_days)))
    : 0;
  const weekMaxActivity = retentionMetrics.reduce((max, row) => Math.max(max, row.activity_count), 0);
  const weekActiveDays = retentionMetrics.filter((row) => row.activity_count > 0).length;
  const weekPoints = retentionMetrics.reduce((sum, row) => sum + (row.points_earned || 0), 0);
  const weekSentence =
    weekActiveDays === 0
      ? "Nothing logged yet this week. One small thing is plenty to start."
      : `${weekActiveDays} active ${weekActiveDays === 1 ? "day" : "days"} this week \u00b7 ${weekPoints} pts for the garden`;
  const weekSummaryLabel = `Activity over the last seven days: ${retentionMetrics
    .map((row) => `${toWeekdayFromDateKey(row.day)} ${row.activity_count}`)
    .join(", ")}`;

  const handleSaveHabitEdits = useCallback(
    async (drafts) => {
      if (savingHabitEdits) return;
      setSavingHabitEdits(true);
      try {
        const userKey = user?.id || "guest";
        await setHabitOverrides(
          userKey,
          drafts.map((row) => ({
            taskId: row.taskId,
            patch: { title: row.title, points: row.points },
          }))
        );
        await loadTasks();
        setEditHabitsOpen(false);
      } catch (error) {
        console.error("HOME_HABIT_EDIT_SAVE_ERROR", error);
        Alert.alert("Error", "Could not save habit edits. Please try again.");
      } finally {
        setSavingHabitEdits(false);
      }
    },
    [loadTasks, savingHabitEdits, user?.id]
  );

  const handleSavePetName = useCallback(async () => {
    const normalized = normalizePetName(petNameInput);
    if (!normalized) {
      setPetNameError("Please enter a name.");
      return;
    }
    if (normalized.length > PET_NAME_MAX_CHARS) {
      setPetNameError(`Name must be ${PET_NAME_MAX_CHARS} characters or fewer.`);
      return;
    }
    if (!user?.id) {
      setPetNameError("Sign in required.");
      return;
    }

    setSavingPetName(true);
    setPetNameError("");
    try {
      const savedName = await savePetName(user.id, normalized);
      setPetNameLocally(user.id, savedName);
      setPetNameInput(savedName);
      setPetNameModalVisible(false);
      await refreshPet();
    } catch (error) {
      showSavePetNameError(error?.message || "Could not save pet name.");
    } finally {
      setSavingPetName(false);
    }
  }, [refreshPet, petNameInput, user?.id]);

  const petDisplayName = normalizePetName(petName) || "Your pet";
  const petMood = petMoodFromStores({ liveState: petEmotionState, dailyMood: moodState, hour: new Date().getHours() });

  return (
    <LinearGradient colors={["#0f1420", "#121826"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <FinchGardenHeader
            height={headerHeight}
            streakText={streakText}
            moodText={moodText}
            titleText={headerTitle}
            subtitleText={headerSubtitle}
            petImageSources={petSources}
            petLook={petLook}
            plants={scenePlants}
            petName={normalizePetName(petName) || null}
            petMood={petMood}
            petReaction={petReaction}
            onPetReactionEnd={() => setPetReaction(null)}
            onPetPress={() => setPetReaction("love")}
            petAct={petAct}
            onPetActEnd={() => setPetAct(null)}
            celebration={celebration}
          />
        </View>

        <View style={styles.sectionSpacing} />
        <FinchProgressCard
          current={pointsSnapshot.earnedPointsToday}
          total={pointsSnapshot.requiredPoints}
          remaining={pointsSnapshot.remaining}
        />
        <PointsDebugPanel snapshot={pointsSnapshot} />

        <View style={styles.sectionSpacing} />
        <View style={styles.retentionCard}>
          <View style={styles.weekHeaderRow}>
            <Text style={styles.retentionTitle}>This week with {petDisplayName}</Text>
            <Text style={styles.retentionMeta}>
              {retentionStreakDays > 0 ? `${retentionStreakDays}-day run` : "Fresh start"} · {retentionMoodLabel}
            </Text>
          </View>
          {loadingRetention && retentionMetrics.length === 0 ? (
            <ActivityIndicator color="#35d07f" style={styles.retentionLoading} />
          ) : (
            <View style={styles.weekBars} accessible accessibilityLabel={weekSummaryLabel}>
              {retentionMetrics.map((row) => {
                const level = Math.min(1, row.activity_count / Math.max(1, weekMaxActivity));
                const active = row.activity_count > 0;
                return (
                  <View key={row.day} style={styles.weekBarColumn}>
                    <View style={styles.weekBarTrack}>
                      <View style={[styles.weekBarFill, { height: `${Math.max(active ? 18 : 6, Math.round(level * 100))}%` }, active ? styles.weekBarFillActive : null]} />
                    </View>
                    <Text style={[styles.weekBarLabel, active && styles.weekBarLabelActive]}>{toWeekdayFromDateKey(row.day).slice(0, 2)}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <Text style={styles.retentionRow}>{weekSentence}</Text>
        </View>

        {cycle.enabled ? (
          <Pressable style={styles.cycleCard} onPress={() => navigation.navigate("Cycle")} accessibilityRole="button" accessibilityLabel="Cycle tracking">
            <View style={styles.cycleIcon}>
              <Feather name="calendar" size={16} color="#fbcfe8" />
            </View>
            <View style={styles.cycleBody}>
              <Text style={styles.cycleTitle}>{cycle.status.phase === "unknown" ? "Cycle tracking is on" : phaseLabel(cycle.status.phase)}</Text>
              <Text style={styles.cycleMeta}>
                {cycle.status.phase === "unknown"
                  ? "Log your first period day to get started."
                  : `Day ${cycle.status.cycleDay}${cycle.status.nextPeriodStart ? ` · next period around ${shortDate(cycle.status.nextPeriodStart)}` : ""}`}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="rgba(148,163,184,0.8)" />
          </Pressable>
        ) : null}

        <View style={styles.sectionSpacing} />
        <FinchQuickActions
          title={quickActionsTitle}
          checkInLabel={quickCheckInLabel}
          checkInIcon="sunrise"
          secondaryLabel={secondaryActionLabel}
          secondaryIcon={secondaryActionIcon}
          onSecondaryAction={protectedMode && !hasExistingCheckin ? () => setBreathingOpen(true) : undefined}
          onCheckIn={() => navigation.navigate("CheckIn")}
          onHabits={() => navigation.navigate("Habits")}
        />

        {protectedMode && hasExistingCheckin ? (
          <View style={styles.protectedCard}>
            <Text style={styles.protectedTitle}>That's enough for today.</Text>
            <Text style={styles.protectedSubtitle}>Want one slow minute before moving on?</Text>
            <Pressable style={styles.protectedBreathingButton} onPress={() => setBreathingOpen(true)}>
              <Text style={styles.protectedBreathingButtonText}>One minute breathing</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionSpacing} />
        <View style={styles.sectionHeaderRow}>
          <FinchSectionTitle>Today's Tasks</FinchSectionTitle>
          <View style={styles.sectionHeaderActions}>
            <Pressable style={styles.sectionMiniButton} onPress={() => setEditHabitsOpen(true)}>
              <Text style={styles.sectionMiniButtonText}>Edit habits</Text>
            </Pressable>
            <Pressable style={styles.sectionMiniButton} onPress={() => navigation.navigate("Tasks")}>
              <Text style={styles.sectionMiniButtonText}>See all</Text>
            </Pressable>
          </View>
        </View>
        {loadingTasks ? (
          <ActivityIndicator color="#35d07f" style={{ marginTop: 12 }} />
        ) : tasks.length === 0 ? (
          <Text style={styles.emptyText}>No tasks yet.</Text>
        ) : (
          tasks.map((task) => {
            const notice = taskMutationNoticeById[task.id];
            const isSaving = !!completingTaskIds[task.id];
            return (
              <View key={task.id}>
                <FinchTaskCard
                  title={task.title}
                  reward={task.reward}
                  icon={task.icon}
                  completed={task.done}
                  saving={isSaving}
                  disabled={task.done || isSaving}
                  onToggle={() => handleToggleTask(task.id)}
                />
                {notice?.type === "error" ? (
                  <Pressable onPress={() => handleToggleTask(task.id, { retry: true })}>
                    <Text style={styles.taskErrorText}>{notice.message}</Text>
                  </Pressable>
                ) : null}
                {notice?.type === "queued" ? (
                  <Text style={styles.taskQueuedText}>{notice.message}</Text>
                ) : null}
              </View>
            );
          })
        )}

        {__DEV__ ? (
          <Pressable style={styles.devButton} onPress={() => navigation.navigate("NetworkDebug")}>
            <Text style={styles.devButtonText}>Network debug</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <BreathingModal visible={breathingOpen} onClose={() => setBreathingOpen(false)} />
      <EditHabitsModal
        visible={editHabitsOpen}
        tasks={tasks}
        saving={savingHabitEdits}
        onCancel={() => (savingHabitEdits ? null : setEditHabitsOpen(false))}
        onSave={handleSaveHabitEdits}
      />
      <Modal
        visible={petNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (savingPetName) return;
        }}
      >
        <View style={styles.petNameModalBackdrop}>
          <View style={styles.petNameModalCard}>
            <Text style={styles.petNameModalTitle}>Name your pet</Text>
            <TextInput
              value={petNameInput}
              onChangeText={(text) => {
                setPetNameInput(text);
                if (petNameError) setPetNameError("");
              }}
              placeholder="Enter a name"
              placeholderTextColor="rgba(148,163,184,0.9)"
              autoCapitalize="words"
              maxLength={PET_NAME_MAX_CHARS}
              editable={!savingPetName}
              style={styles.petNameInput}
            />
            {petNameError ? <Text style={styles.petNameErrorText}>{petNameError}</Text> : null}
            <Pressable
              style={[styles.petNameSaveButton, savingPetName ? styles.petNameSaveButtonDisabled : null]}
              onPress={handleSavePetName}
              disabled={savingPetName}
            >
              <Text style={styles.petNameSaveButtonText}>{savingPetName ? "Saving..." : "Save"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  headerWrap: {
    marginHorizontal: -16,
    overflow: "hidden",
    borderRadius: 24,
  },
  sectionSpacing: {
    height: 12,
  },
  protectedCard: {
    marginTop: 12,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    alignItems: "flex-start",
  },
  protectedTitle: {
    color: "#e2e8f0",
    fontSize: 16,
    fontWeight: "700",
  },
  protectedSubtitle: {
    marginTop: 4,
    color: "rgba(203,213,225,0.88)",
    fontSize: 13,
  },
  protectedBreathingButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.55)",
    backgroundColor: "rgba(16,185,129,0.16)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  protectedBreathingButtonText: {
    color: "#a7f3d0",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionMiniButton: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  sectionMiniButtonText: {
    color: "rgba(226,232,240,0.9)",
    fontSize: 11,
    fontWeight: "600",
  },
  emptyText: {
    color: "rgba(148,163,184,0.8)",
    marginTop: 6,
  },
  taskErrorText: {
    color: "#fca5a5",
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 8,
    textDecorationLine: "underline",
  },
  taskQueuedText: {
    color: "#fcd34d",
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 8,
  },
  devButton: {
    alignSelf: "center",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
  },
  devButtonText: {
    color: "rgba(148,163,184,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
  cycleCard: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18,24,38,0.95)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.35)",
  },
  cycleIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(244,114,182,0.18)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  cycleBody: { flex: 1 },
  cycleTitle: { color: "#e2e8f0", fontSize: 15, fontWeight: "700" },
  cycleMeta: { marginTop: 2, color: "rgba(203,213,225,0.9)", fontSize: 12 },
  retentionCard: {
    marginTop: 2,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
  },
  retentionTitle: {
    color: "#e2e8f0",
    fontSize: 16,
    fontWeight: "700",
  },
  retentionMeta: {
    marginTop: 4,
    marginBottom: 6,
    color: "rgba(203,213,225,0.9)",
    fontSize: 12,
  },
  retentionLoading: {
    marginTop: 6,
    alignSelf: "flex-start",
  },
  retentionRow: {
    color: "rgba(226,232,240,0.9)",
    fontSize: 12,
    marginTop: 10,
  },
  weekHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  weekBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    height: 64,
  },
  weekBarColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  weekBarTrack: {
    width: 14,
    height: 44,
    borderRadius: 7,
    backgroundColor: "rgba(148,163,184,0.14)",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  weekBarFill: {
    width: "100%",
    borderRadius: 7,
    backgroundColor: "rgba(148,163,184,0.35)",
  },
  weekBarFillActive: {
    backgroundColor: "#35d07f",
  },
  weekBarLabel: {
    marginTop: 6,
    color: "rgba(148,163,184,0.8)",
    fontSize: 10,
    fontWeight: "700",
  },
  weekBarLabelActive: {
    color: "#e2e8f0",
  },
  petNameModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.78)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  petNameModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "#0f172a",
    padding: 16,
  },
  petNameModalTitle: {
    color: "#e2e8f0",
    fontSize: 20,
    fontWeight: "800",
  },
  petNameInput: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
    backgroundColor: "rgba(15,23,42,0.55)",
    color: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  petNameErrorText: {
    marginTop: 8,
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "600",
  },
  petNameSaveButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16a34a",
  },
  petNameSaveButtonDisabled: {
    opacity: 0.65,
  },
  petNameSaveButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
