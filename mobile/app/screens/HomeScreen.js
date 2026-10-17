import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, ToastAndroid, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setStatusBarStyle } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import HomeView from "../../src/components/home/HomeView";
import FocusPickerSheet from "../../src/components/home/FocusPickerSheet";
import AddTaskSheet from "../../src/components/home/AddTaskSheet";
import MilestoneSheet from "../../src/components/home/MilestoneSheet";
import { createCustomTask, removeCustomTask } from "../../src/services/customTasks";
import { reconcileMilestonesForUser } from "../../src/services/milestoneStore";
import { loadCarePrefs } from "../../src/services/carePrefs";
import { loadScrapbook } from "../../src/services/scrapbookStore";
import { shouldNudgeHome } from "../../src/domain/scrapbook";
import PressableScale from "../../src/components/common/PressableScale";
import BreathingModal from "../../src/components/checkin/BreathingModal";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePet } from "../../src/hooks/usePet";
import { useCycle } from "../../src/hooks/useCycle";
import { useReminderTaps } from "../../src/hooks/useReminderTaps";
import { useTodayPlan } from "../../src/hooks/useTodayPlan";
import { useJourney } from "../../src/hooks/useJourney";
import { journeyLine } from "../../src/domain/journeys";
import { catalogById, renderTitle } from "../../src/domain/plan/catalog";
import { completeJourneyTask } from "../../src/services/journeyActions";
import { todayKey } from "../../src/services/dailyLoop";
import { fetchCatalog, fetchGardenPoints, fetchUserPlants } from "../../src/services/garden";
import { fetchDaysTogether } from "../../src/services/homeStats";
import { fetchLast7DaysMetrics } from "../../src/services/retention";
import { completeTaskWithResilience, syncPendingCompletions } from "../../src/services/taskCompletion";
import { loadTodayEnergy, saveTodayEnergy } from "../../src/services/planStore";
import { syncReminders } from "../../src/services/reminders";
import { savePetName } from "../../src/services/petService";
import { setPetNameLocally } from "../../src/services/petStore";
import { FOCUS_AREAS } from "../../src/domain/plan/focusAreas";
import { energyOption, isGentleEnergy } from "../../src/domain/energy";
import { careDoneLine, homePetLine } from "../../src/domain/homeDialogue";
import { actForTask, petMoodFromStores } from "../../src/domain/petMood";
import { nextLastSeen, returnGreeting, returnStatus } from "../../src/domain/hibernation";
import { dayPhase, phaseGreeting } from "../../src/domain/timeOfDay";
import { memorialGreeting, memorialReflection } from "../../src/domain/memorial";
import { sanctuaryCopy, sanctuaryFor } from "../../src/domain/sanctuary";
import { isProtectedMood } from "../../src/domain/protectedMode";
import { phaseLabel } from "../../src/domain/cycle";
import { playDing } from "../../src/utils/sfx";
import { confirmAsync, notify } from "../../src/utils/confirm";
import * as haptics from "../../src/utils/haptics";
import { brand, fonts, ink, radius, skyFor, surfaces, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/theme";

// Home: the pet's sanctuary and today's care. Layout and look live in src/components/home/HomeView.tsx
// (pure, also rendered by the design preview); this screen owns the data, the plan, completions and the
// pet's reactions. Tasks come from the plan engine (src/domain/plan) via useTodayPlan.

const PET_NAME_MAX_CHARS = 24;
// a task that opens its own screen (breathing, journal, a game) is ticked when the person comes back,
// as long as they stayed at least this long
const OPENED_TASK_MIN_MS = 8000;
const NO_FOCUS = [];

function toHomeMoodScore(moodState) {
  if (moodState === "sad") return 2;
  if (moodState === "neutral") return 3;
  if (moodState === "happy") return 4;
  return null;
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
  notify("Could not save pet name", text);
}

function longDate(date) {
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(date);
  } catch (_error) {
    return "";
  }
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, profile, userStats, petEmotionState } = useAuth();
  // Re-read on every focus so the key (and the light) cannot go stale across midnight (R-33).
  const [homeDateKey, setHomeDateKey] = useState(() => todayKey());
  const [hour, setHour] = useState(() => new Date().getHours());
  const { pet, sources: petSources, name: petName, look: petLook, memorial, status: petStatus, refresh: refreshPet } = usePet();
  const theme = sanctuaryFor(petLook?.species);
  const place = sanctuaryCopy(theme).place;
  const inMemorial = !!memorial;
  const cycle = useCycle();
  const moodState = userStats?.pet_mood_state || null;
  const protectedMode = isProtectedMood(toHomeMoodScore(moodState));
  const hasExistingCheckin = profile?.last_checkin_date === homeDateKey;
  const petDisplayName = normalizePetName(petName) || "Your pet";
  const phase = dayPhase(hour);
  const sky = skyFor(phase);
  const appStatusBar = useTheme().statusBar;

  const [energy, setEnergy] = useState(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [savingFocus, setSavingFocus] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  // how the pet talks (chosen in onboarding) and the Days Together milestone being celebrated, if any
  const [voice, setVoice] = useState("warm");
  const [milestone, setMilestone] = useState(null);
  const milestoneChecked = useRef(null);
  const [completing, setCompleting] = useState({});
  const [noticeByTask, setNoticeByTask] = useState({});
  const [toast, setToast] = useState(null);
  const [petReaction, setPetReaction] = useState(null);
  const [petAct, setPetAct] = useState(null);
  const [sprouts, setSprouts] = useState(null);
  const [daysTogether, setDaysTogether] = useState(null);
  const [scenePlants, setScenePlants] = useState([]);
  const [weekMetrics, setWeekMetrics] = useState([]);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [returnNote, setReturnNote] = useState(null);
  const lastSeenChecked = useRef(null);
  const inFlightTicks = useRef(new Set());
  const openedTask = useRef(null);
  const celebratedAllDone = useRef(null);
  // true once something was ticked in this session, so the all-done moment never fires just for opening the app
  const completedThisSession = useRef(false);
  const firstFocus = useRef(true);

  const [petNameInput, setPetNameInput] = useState("");
  const [petNameModalVisible, setPetNameModalVisible] = useState(false);
  const [petNameError, setPetNameError] = useState("");
  const [savingPetName, setSavingPetName] = useState(false);

  const gentle = protectedMode || isGentleEnergy(energy);
  const returning = !!returnNote;
  const cyclePhase = cycle.enabled ? cycle.status?.phase ?? null : null;

  // The plan waits until its inputs are known (the day's battery answer, the pet, the cycle store and the
  // welcome-back check), so no half-informed plan is built, logged as shown or turned into task rows. A slow
  // network cannot hold it back for more than a moment.
  const [energyLoadedFor, setEnergyLoadedFor] = useState(null);
  const [returnChecked, setReturnChecked] = useState(false);
  // the fallback is per day and user: after midnight the new day's plan waits for the new day's battery answer
  const readyKey = `${user?.id ?? "guest"}:${homeDateKey}`;
  const [readyFallbackFor, setReadyFallbackFor] = useState(null);
  useEffect(() => {
    const id = setTimeout(() => setReadyFallbackFor(readyKey), 2500);
    return () => clearTimeout(id);
  }, [readyKey]);
  const planReady =
    !user?.id ||
    readyFallbackFor === readyKey ||
    (energyLoadedFor === readyKey && returnChecked && !cycle.loading && petStatus !== "loading" && petStatus !== "idle");
  // rows whose title carries the pet's name wait until the name is known (never a stored "Play with Your pet")
  const petNameKnown = petStatus === "ready" && !!normalizePetName(petName);
  const syncQueuedRef = useRef(null);

  const plan = useTodayPlan({
    userId: user?.id ?? null,
    petName: petDisplayName,
    petKnown: petNameKnown,
    dateKey: homeDateKey,
    energy,
    returning,
    memorial: inMemorial,
    cyclePhase,
    ready: planReady,
    // ticks kept on this phone just got their rows: push the queue now rather than at the next foreground
    onPendingQueued: () => void syncQueuedRef.current?.("plan_pending"),
  });

  // ---- the active journey: today's step sits at the top of today's care ------------------------------
  const journeyState = useJourney(user?.id ?? null, homeDateKey);
  const [journeySaving, setJourneySaving] = useState(false);
  const [journeyNotice, setJourneyNotice] = useState(null);
  const journeyTask = journeyState.step ? catalogById(journeyState.step.day.taskId) : null;
  // a step whose task was ticked from the care list (or a game) counts as done in the arc too
  useEffect(() => {
    const step = journeyState.step;
    if (!step || step.done || !journeyTask) return;
    const item = plan.items.find((row) => row.planned.task.id === journeyTask.id);
    if (item?.done) void journeyState.completeToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.items, journeyState.step?.index, journeyState.step?.done, journeyTask?.id]);

  // ---- the battery check, kept per day on the device --------------------------------------------------
  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setEnergy(null);
      return undefined;
    }
    // a new day starts unanswered: yesterday's battery must never shape today's plan
    setEnergy(null);
    loadTodayEnergy(user.id, homeDateKey)
      .then((value) => {
        if (alive) setEnergy(value ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setEnergyLoadedFor(`${user.id}:${homeDateKey}`);
      });
    return () => {
      alive = false;
    };
  }, [homeDateKey, user?.id]);

  const handleEnergy = useCallback(
    (next) => {
      setEnergy(next);
      setPetReaction(next === "energized" ? "cheer" : "love");
      if (user?.id) void saveTodayEnergy(user.id, homeDateKey, next);
    },
    [homeDateKey, user?.id]
  );

  // ---- the pet's voice, from the care preferences ---------------------------------------------------------
  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    loadCarePrefs(user.id)
      .then((prefs) => {
        if (alive) setVoice(prefs.voice);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [homeDateKey, user?.id]);

  // ---- the Sunday scrapbook: on its Sunday and the Monday after, the week card says a page is waiting ---
  const [weekPageReady, setWeekPageReady] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!user?.id || inMemorial) {
        setWeekPageReady(false);
        return undefined;
      }
      let alive = true;
      Promise.all([loadScrapbook(user.id), loadCarePrefs(user.id)])
        .then(([book, prefs]) => {
          if (alive) setWeekPageReady(shouldNudgeHome(book, homeDateKey, prefs.completedAt ? prefs.completedAt.slice(0, 10) : null));
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [homeDateKey, inMemorial, user?.id])
  );

  // ---- Days Together milestones: one moment when a threshold is reached, kept as a keepsake -----------
  useEffect(() => {
    if (!user?.id || inMemorial || typeof daysTogether !== "number") return;
    const key = `${user.id}:${homeDateKey}:${daysTogether}`;
    if (milestoneChecked.current === key) return;
    milestoneChecked.current = key;
    reconcileMilestonesForUser(user.id, daysTogether, homeDateKey)
      .then((reached) => {
        if (reached == null) return;
        setMilestone(reached);
        setPetReaction("love");
        haptics.success();
      })
      .catch(() => {});
  }, [daysTogether, homeDateKey, inMemorial, user?.id]);

  // ---- ask for a name once the pet is painted and still unnamed ---------------------------------------
  useEffect(() => {
    if (!user?.id) {
      setPetNameModalVisible(false);
      return;
    }
    setPetNameInput((prev) => (prev ? prev : petName));
    setPetNameModalVisible(hasStylizedPetReady(pet) && !normalizePetName(petName));
  }, [pet, petName, user?.id]);

  // ---- side data: Sprouts, days together, the week, the plants in the scene ---------------------------
  const loadSideData = useCallback(async () => {
    if (!user?.id) return;
    setLoadingWeek(true);
    await Promise.all([
      fetchGardenPoints()
        .then((summary) => setSprouts(summary.remainingPoints))
        .catch((error) => console.warn("HOME_SPROUTS_LOAD_ERROR", error?.message || String(error))),
      fetchDaysTogether(user.id).then((count) => setDaysTogether(count)),
      fetchLast7DaysMetrics()
        .then((metrics) => setWeekMetrics(Array.isArray(metrics) ? metrics : []))
        .catch((error) => console.warn("HOME_WEEK_LOAD_ERROR", error?.message || String(error))),
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
        .catch((error) => console.warn("HOME_SCENE_PLANTS_LOAD_ERROR", error?.message || String(error))),
    ]);
    setLoadingWeek(false);
  }, [user?.id]);

  // ---- completing a care task ---------------------------------------------------------------------------
  const celebrate = useCallback(
    (title, act, points) => {
      playDing();
      haptics.tapSoft();
      setPetReaction("cheer");
      setPetAct(act || actForTask(title));
      setSprouts((prev) => (typeof prev === "number" ? prev + Math.max(0, points) : prev));
      setToast({ id: Date.now(), text: careDoneLine(petDisplayName, points, title.length + Date.now() / 1000) });
    },
    [petDisplayName]
  );

  const completeItem = useCallback(
    async (item, options = {}) => {
      const key = item.planned.task.id;
      // a ref as well as state: the card has two targets, and two taps can land before the re-render
      if (item.done || completing[key] || inFlightTicks.current.has(key)) return;
      if (!user?.id) {
        // signed out (nothing to sync against): tick it here so the moment still lands
        completedThisSession.current = true;
        plan.markDone(key);
        celebrate(item.title, item.planned.task.act, 0);
        return;
      }
      inFlightTicks.current.add(key);
      setCompleting((prev) => ({ ...prev, [key]: true }));
      setNoticeByTask((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        // the batch row lookup can miss a task on a flaky network; never fake a tick that was not saved
        const taskId = item.taskId ?? (await plan.ensureRow(item.planned.task));
        if (taskId == null) {
          // no row yet (offline before this task ever had one, or the pet still unnamed): the tick stays on
          // this phone, shows as done, and is queued for the server as soon as the row can be made
          await plan.tickPending(key);
          completedThisSession.current = true;
          setNoticeByTask((prev) => ({ ...prev, [key]: { type: "queued", message: "Saved on this phone. It syncs when you're back online." } }));
          celebrate(item.title, item.planned.task.act, 0);
          return;
        }
        const category = item.planned.task.category;
        const mutation = await completeTaskWithResilience({
          taskId,
          retry: !!options.retry,
          // the cycle stays on the device: a cycle-care tick is logged without its category
          eventMeta: { category: category === "cycle" ? null : category, difficulty: item.planned.task.effort, points: null },
        });
        completedThisSession.current = true;
        if (mutation.state === "queued") {
          plan.markDone(key);
          setNoticeByTask((prev) => ({ ...prev, [key]: { type: "queued", message: "Saved on this phone. It syncs when you're back online." } }));
          celebrate(item.title, item.planned.task.act, 0);
          return;
        }
        plan.markDone(key);
        if (mutation.result.inserted) {
          celebrate(item.title, item.planned.task.act, mutation.result.points_awarded);
        } else if (!options.silent) {
          setToast({ id: Date.now(), text: `${petDisplayName} already counted that one today.` });
        }
        void loadSideData();
      } catch (error) {
        haptics.warning();
        setNoticeByTask((prev) => ({ ...prev, [key]: { type: "error", message: "Couldn't save that. Tap to try again." } }));
        console.error("TASK_COMPLETE_ERROR", error);
      } finally {
        inFlightTicks.current.delete(key);
        setCompleting((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [celebrate, completing, loadSideData, petDisplayName, plan, user?.id]
  );

  // ---- the person's own tasks: add, tick, put away ------------------------------------------------------
  const completeCustom = useCallback(
    async (item, options = {}) => {
      const key = `custom:${item.id}`;
      if (item.done || completing[key] || inFlightTicks.current.has(key) || !user?.id) return;
      inFlightTicks.current.add(key);
      setCompleting((prev) => ({ ...prev, [key]: true }));
      setNoticeByTask((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        const mutation = await completeTaskWithResilience({
          taskId: item.id,
          retry: !!options.retry,
          eventMeta: { category: item.category === "cycle" ? null : item.category, difficulty: 1, points: null },
        });
        completedThisSession.current = true;
        plan.markCustomDone(item.id);
        if (mutation.state === "queued") {
          setNoticeByTask((prev) => ({ ...prev, [key]: { type: "queued", message: "Saved on this phone. It syncs when you're back online." } }));
          celebrate(item.title, null, 0);
          return;
        }
        if (mutation.result.inserted) celebrate(item.title, null, mutation.result.points_awarded);
        else setToast({ id: Date.now(), text: `${petDisplayName} already counted that one today.` });
        void loadSideData();
      } catch (error) {
        haptics.warning();
        setNoticeByTask((prev) => ({ ...prev, [key]: { type: "error", message: "Couldn't save that. Tap to try again." } }));
        console.error("CUSTOM_TASK_COMPLETE_ERROR", error);
      } finally {
        inFlightTicks.current.delete(key);
        setCompleting((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [celebrate, completing, loadSideData, petDisplayName, plan, user?.id]
  );

  const handleAddTask = useCallback(
    async (input) => {
      if (!user?.id || savingTask) return;
      setSavingTask(true);
      try {
        await createCustomTask(user.id, input);
        setAddOpen(false);
        setPetReaction("cheer");
        setToast({ id: Date.now(), text: `${petDisplayName} added it to today's care.` });
        await plan.reload();
      } catch (error) {
        console.error("CUSTOM_TASK_CREATE_ERROR", error);
        notify("Couldn't add that", "Check your connection and try again.");
      } finally {
        setSavingTask(false);
      }
    },
    [petDisplayName, plan, savingTask, user?.id]
  );

  const removeCustom = useCallback(
    async (item) => {
      if (!user?.id) return;
      const ok = await confirmAsync({
        title: "Put this task away?",
        message: `"${item.title}" leaves your list. What you already did stays counted.`,
        confirmText: "Put it away",
        cancelText: "Keep it",
      });
      if (!ok) return;
      try {
        await removeCustomTask(user.id, item.id);
        await plan.reload();
      } catch (error) {
        console.error("CUSTOM_TASK_REMOVE_ERROR", error);
        notify("Couldn't do that", "Check your connection and try again.");
      }
    },
    [plan, user?.id]
  );

  const completeJourneyStep = useCallback(async () => {
    const step = journeyState.step;
    if (!step || step.done || !user?.id || journeySaving || !journeyTask) return;
    setJourneySaving(true);
    setJourneyNotice(null);
    try {
      const outcome = await completeJourneyTask(user.id, journeyTask.id, petDisplayName, petNameKnown);
      if (outcome.state === "no_row") {
        // no row yet: keep the tick on this phone the way the care list does; the arc still moves on
        await plan.tickPending(journeyTask.id);
        setJourneyNotice({ type: "queued", message: "Saved on this phone. It syncs when you're back online." });
      } else {
        plan.markDone(journeyTask.id);
        if (outcome.state === "queued") setJourneyNotice({ type: "queued", message: "Saved on this phone. It syncs when you're back online." });
      }
      await journeyState.completeToday();
      completedThisSession.current = true;
      playDing();
      haptics.tapSoft();
      const last = step.index + 1 >= step.total;
      setPetReaction(last ? "love" : "cheer");
      setPetAct(journeyTask.act || actForTask(renderTitle(journeyTask, petDisplayName)));
      const points = outcome.state === "success" ? outcome.points : 0;
      if (points > 0) setSprouts((prev) => (typeof prev === "number" ? prev + points : prev));
      setToast({
        id: Date.now(),
        text: last ? `${journeyState.journey?.title ?? "Your journey"}: done. ${petDisplayName} is so proud of you.` : careDoneLine(petDisplayName, points, Date.now() / 1000),
      });
      void loadSideData();
    } catch (error) {
      haptics.warning();
      setJourneyNotice({ type: "error", message: "Couldn't save that. Tap to try again." });
      console.error("JOURNEY_STEP_ERROR", error);
    } finally {
      setJourneySaving(false);
    }
  }, [journeySaving, journeyState, journeyTask, loadSideData, petDisplayName, petNameKnown, plan, user?.id]);

  // all of today's care done: one bigger moment, once per day
  const doneCount = plan.items.filter((item) => item.done).length;
  const totalCount = plan.items.length;
  useEffect(() => {
    if (totalCount === 0 || doneCount < totalCount) return;
    if (celebratedAllDone.current === homeDateKey) return;
    celebratedAllDone.current = homeDateKey;
    if (!completedThisSession.current) return;
    const id = setTimeout(() => {
      haptics.success();
      setPetReaction("love");
      setToast({ id: Date.now(), text: `We did it together. ${petDisplayName} is so proud of you.` });
    }, 1400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount, totalCount, homeDateKey]);

  const openItem = useCallback(
    (item) => {
      const route = item.planned.task.route;
      if (!route) {
        void completeItem(item);
        return;
      }
      openedTask.current = { key: item.planned.task.id, at: Date.now() };
      navigation.navigate(route);
    },
    [completeItem, navigation]
  );

  // ---- focus: refresh everything, and tick a task whose screen the person just came back from ---------
  // The focus callback is memoised, so it reads the latest plan and actions through refs.
  const latest = useRef({ items: plan.items, reload: plan.reload, completeItem });
  latest.current = { items: plan.items, reload: plan.reload, completeItem };
  useFocusEffect(
    useCallback(() => {
      setHomeDateKey(todayKey());
      setHour(new Date().getHours());
      void refreshPet();
      void loadSideData();
      const opened = openedTask.current;
      openedTask.current = null;
      if (opened && Date.now() - opened.at >= OPENED_TASK_MIN_MS) {
        const item = latest.current.items.find((row) => row.planned.task.id === opened.key);
        if (item && !item.done) void latest.current.completeItem(item, { silent: true });
      } else if (!firstFocus.current) {
        // the plan hook loads on mount; later focuses pick up completions made elsewhere (games, Tasks)
        void latest.current.reload();
      }
      firstFocus.current = false;
    }, [loadSideData, refreshPet])
  );
  // the status bar follows the sky while Home is in front, and goes back to the app-wide one (the paper of
  // the hour, set in RootNavigator) when leaving; kept apart so an hour change does not re-run the refresh above
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(sky.statusBar);
      return () => setStatusBarStyle(appStatusBar);
    }, [sky.statusBar, appStatusBar])
  );

  // ---- Graceful Hibernation: after days away, a warm welcome once per visit, no backlog ---------------
  // The welcome, and the smaller day it brings, holds for the whole day: opening the app again at noon must
  // not swap the gentle plan for a full one.
  useEffect(() => {
    if (!user?.id || lastSeenChecked.current === user.id) return;
    lastSeenChecked.current = user.id;
    const key = `floura:last-seen:${user.id}`;
    const noteKey = `floura:return-note:${user.id}`;
    (async () => {
      try {
        const today = todayKey();
        const previous = await AsyncStorage.getItem(key);
        const status = returnStatus(previous, today);
        let note = null;
        if (status.kind === "hibernation" || (status.kind === "back" && status.daysAway >= 2)) {
          note = status;
        } else if (status.kind === "same-day") {
          const saved = JSON.parse((await AsyncStorage.getItem(noteKey)) || "null");
          if (saved && saved.day === today && saved.status) note = saved.status;
        }
        if (note) {
          setReturnNote({ ...note, day: today });
          setPetReaction("love");
          await AsyncStorage.setItem(noteKey, JSON.stringify({ day: today, status: note }));
        }
        await AsyncStorage.setItem(key, nextLastSeen(previous, today));
      } catch (_error) {
      } finally {
        setReturnChecked(true);
      }
    })();
  }, [user?.id]);
  // the welcome belongs to the day it was shown
  useEffect(() => {
    if (returnNote?.day && returnNote.day !== homeDateKey) setReturnNote(null);
  }, [homeDateKey, returnNote?.day]);

  // ---- reminders in the pet's voice (rate-limited inside; immediate when memorial flips) ---------------
  useReminderTaps();
  const lastMemorialRef = useRef(!!memorial);
  const petKnown = petStatus === "ready" || petStatus === "error";
  useEffect(() => {
    // wait for the pet: the sync is rate-limited, so a first pass as "Your pet" would stick for the week
    if (!user?.id || !petKnown) return;
    const force = lastMemorialRef.current !== !!memorial;
    lastMemorialRef.current = !!memorial;
    void syncReminders(
      user.id,
      { petName: petDisplayName, species: petLook?.species ?? null, memorial: !!memorial, checkedInToday: hasExistingCheckin },
      { force }
    );
  }, [hasExistingCheckin, memorial, petDisplayName, petKnown, petLook?.species, user?.id]);

  // ---- offline completions sync on start, on foreground and when the connection returns ---------------
  const syncQueued = useCallback(
    async (source) => {
      if (!user?.id) return;
      try {
        const result = await syncPendingCompletions({ source });
        if (result.succeeded > 0) {
          // the queued ticks are on the server now: drop their "saved on this phone" notes
          setNoticeByTask((prev) => Object.fromEntries(Object.entries(prev).filter(([, notice]) => notice?.type !== "queued")));
          await Promise.all([latest.current.reload(), loadSideData()]);
        }
      } catch (error) {
        console.warn("TASK_QUEUE_SYNC_ERROR", error?.message || String(error));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadSideData, user?.id]
  );
  syncQueuedRef.current = syncQueued;
  useEffect(() => {
    if (!user?.id) return undefined;
    void syncQueued("startup");
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      // coming back from the background does not fire a navigation focus: roll the day and the light here
      setHomeDateKey(todayKey());
      setHour(new Date().getHours());
      void syncQueued("foreground");
    });
    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state?.isConnected === false || state?.isInternetReachable === false) return;
      void syncQueued("connectivity_restored");
    });
    return () => {
      appStateSubscription.remove();
      netInfoUnsubscribe();
    };
  }, [syncQueued, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const today = todayKey();
    setHour(new Date().getHours());
    if (today !== homeDateKey) {
      // a new day: changing the key reloads the plan with today's inputs
      setHomeDateKey(today);
      await Promise.all([loadSideData(), refreshPet()]).catch(() => {});
    } else {
      await Promise.all([latest.current.reload(), loadSideData(), refreshPet()]).catch(() => {});
    }
    setRefreshing(false);
  }, [homeDateKey, loadSideData, refreshPet]);

  // a notice belongs to an undone task: once it is done (here, in a game or after a sync) the notice goes
  useEffect(() => {
    const doneKeys = new Set(plan.items.filter((item) => item.done).map((item) => item.planned.task.id));
    setNoticeByTask((prev) => {
      const stale = Object.keys(prev).filter((key) => doneKeys.has(key) && prev[key]?.type === "error");
      if (stale.length === 0) return prev;
      const next = { ...prev };
      stale.forEach((key) => delete next[key]);
      return next;
    });
  }, [plan.items]);

  // ---- focus areas --------------------------------------------------------------------------------------
  const focusAreas = (plan.settings?.focusAreas || []).map((id) => FOCUS_AREAS.find((area) => area.id === id)).filter(Boolean);
  const handleSaveFocus = useCallback(
    async (areas) => {
      setSavingFocus(true);
      try {
        await plan.saveSettings({ focusAreas: areas, dailyCount: plan.settings?.dailyCount ?? 4 });
        setFocusOpen(false);
        setPetReaction("cheer");
        setToast({ id: Date.now(), text: `${petDisplayName} rebuilt today around what matters to you.` });
      } catch (error) {
        notify("Couldn't save that", "Please try again in a moment.");
      } finally {
        setSavingFocus(false);
      }
    },
    [petDisplayName, plan]
  );

  // ---- pet name -----------------------------------------------------------------------------------------
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

  // ---- what the screen says -----------------------------------------------------------------------------
  const returnCopy = inMemorial ? memorialGreeting(petDisplayName) : returnNote ? returnGreeting(returnNote, petDisplayName) : null;
  const greeting = returnCopy ? returnCopy.title : gentle ? "Go gently today" : phaseGreeting(phase);
  const subline = returnCopy ? returnCopy.subtitle : longDate(new Date());
  const petLine = homePetLine({
    petName: petDisplayName,
    phase,
    energy,
    done: doneCount,
    total: totalCount,
    returning,
    place,
    focus: focusAreas[0]?.short ?? null,
    seed: homeDateKey,
    voice,
  });
  const petMood = energyOption(energy)?.petMood ?? petMoodFromStores({ liveState: petEmotionState, dailyMood: moodState, hour });

  const tasks = useMemo(
    () => [
      ...plan.items.map((item) => ({
        key: item.planned.task.id,
        title: item.title,
        category: item.planned.task.category,
        icon: item.planned.task.icon,
        minutes: item.planned.task.minutes,
        reason: item.planned.reason || null,
        done: item.done,
        saving: !!completing[item.planned.task.id],
        notice: noticeByTask[item.planned.task.id] || null,
        opens: !!item.planned.task.route,
      })),
      // the person's own tasks, after the plan, every day
      ...plan.custom.map((item) => ({
        key: `custom:${item.id}`,
        title: item.title,
        category: item.category,
        icon: item.icon,
        minutes: item.minutes,
        reason: "Your own",
        done: item.done,
        saving: !!completing[`custom:${item.id}`],
        notice: noticeByTask[`custom:${item.id}`] || null,
        opens: false,
        custom: true,
      })),
    ],
    [completing, noticeByTask, plan.custom, plan.items]
  );
  const itemByKey = useCallback((key) => plan.items.find((item) => item.planned.task.id === key), [plan.items]);
  const customByKey = useCallback((key) => plan.custom.find((item) => `custom:${item.id}` === key), [plan.custom]);

  const more = useMemo(() => {
    const items = [
      { key: "play", title: `Play with ${petDisplayName}`, subtitle: "Fetch, bubbles and more", icon: "tennisball-outline", category: "play", onPress: () => navigation.navigate("Play") },
      {
        key: "journeys",
        title: journeyState.journey ? journeyState.journey.title : "Journeys",
        subtitle: journeyState.journey && journeyState.step ? `Day ${journeyState.step.index + 1} of ${journeyState.step.total}` : "Seven small steps, one a day",
        icon: "map-outline",
        category: "focus",
        onPress: () => navigation.navigate("Journeys"),
      },
      { key: "breathe", title: "Breathe together", subtitle: "One slow minute", icon: "leaf-outline", category: "calm", onPress: () => navigation.navigate("Breathing") },
      { key: "journal", title: `Write to ${petDisplayName}`, subtitle: "Today's question is waiting", icon: "book-outline", category: "connection", onPress: () => navigation.navigate("Journal") },
      {
        key: "checkin",
        title: "Check in",
        subtitle: hasExistingCheckin ? "Done today. Add a little more?" : "How did today really feel?",
        icon: "sunny-outline",
        category: "energy",
        onPress: () => navigation.navigate("CheckIn"),
      },
      {
        key: "cycle",
        title: cycle.enabled && cycle.status?.phase && cycle.status.phase !== "unknown" ? phaseLabel(cycle.status.phase) : "Your rhythm",
        subtitle: cycle.enabled ? (cycle.status?.cycleDay ? `Day ${cycle.status.cycleDay} · private to this phone` : "Log a day to begin") : "Track your cycle privately",
        icon: "flower-outline",
        category: "cycle",
        onPress: () => navigation.navigate("Cycle"),
      },
      { key: "garden", title: theme === "nook" ? "Your nook" : "Your garden", subtitle: "Grow something with your Sprouts", icon: "flower-outline", category: "body", onPress: () => navigation.navigate("Garden") },
    ];
    // on a heavy day, the calmest door comes first
    if (gentle) items.sort((a, b) => (a.key === "breathe" ? -1 : b.key === "breathe" ? 1 : 0));
    return items;
  }, [cycle.enabled, cycle.status?.cycleDay, cycle.status?.phase, gentle, hasExistingCheckin, journeyState.journey, journeyState.step, navigation, petDisplayName, theme]);

  const journeyCard =
    journeyState.step && journeyState.journey && !inMemorial
      ? {
          journeyTitle: journeyState.journey.title,
          dayIndex: journeyState.step.index,
          total: journeyState.step.total,
          dayTitle: journeyState.step.day.title,
          petLine: journeyLine(journeyState.step.day.petLine, petDisplayName),
          task: journeyTask ? { title: renderTitle(journeyTask, petDisplayName), category: journeyTask.category, icon: journeyTask.icon, minutes: journeyTask.minutes } : null,
          done: journeyState.step.done,
          nextTitle: journeyState.step.next?.title ?? null,
          saving: journeySaving,
          notice: journeyNotice,
          onOpen: () => navigation.navigate("Journey", { journeyId: journeyState.journey.id }),
          onComplete: () => void completeJourneyStep(),
          onRetry: () => void completeJourneyStep(),
        }
      : null;

  const footerLinks = [
    { label: "All tasks", onPress: () => navigation.navigate("Tasks") },
    { label: "Habits", onPress: () => navigation.navigate("Habits") },
    ...(__DEV__ ? [{ label: "Network debug", onPress: () => navigation.navigate("NetworkDebug") }] : []),
  ];

  const night = sky.surface === "night";
  const nameSurface = night ? surfaces.night : surfaces.light;

  return (
    <View style={styles.root}>
      <HomeView
        topInset={insets.top}
        phase={phase}
        greeting={greeting}
        subline={subline}
        petLine={petLine}
        daysTogether={daysTogether}
        sprouts={sprouts}
        theme={theme}
        petName={petDisplayName}
        petSources={petSources}
        petLook={petLook}
        plants={scenePlants}
        petMood={petMood}
        petReaction={petReaction}
        onPetReactionEnd={() => setPetReaction(null)}
        onPetPress={() => {
          haptics.tapLight();
          setPetReaction("love");
        }}
        petAct={petAct}
        onPetActEnd={() => setPetAct(null)}
        petResting={inMemorial}
        memorial={
          inMemorial
            ? {
                reflection: memorialReflection(homeDateKey),
                onMemories: () => navigation.navigate("Memorial"),
                onQuiet: () => setBreathingOpen(true),
                onCheckIn: () => navigation.navigate("CheckIn"),
              }
            : null
        }
        energy={energy}
        onEnergy={handleEnergy}
        focusChosen={!!plan.settings?.chosen}
        focusLabel={plan.settings?.chosen && focusAreas.length ? focusAreas.map((area) => area.short).join(" · ") : null}
        focusCategory={focusAreas[0]?.category ?? null}
        onOpenFocus={() => setFocusOpen(true)}
        journey={journeyCard}
        tasks={tasks}
        loadingTasks={plan.loading}
        tasksError={plan.error}
        onRetryTasks={() => void plan.reload()}
        onCompleteTask={(key, options) => {
          if (key.startsWith("custom:")) {
            const own = customByKey(key);
            if (own) void completeCustom(own, options);
            return;
          }
          const item = itemByKey(key);
          if (item) void completeItem(item, options);
        }}
        onOpenTask={(key) => {
          const item = itemByKey(key);
          if (item) openItem(item);
        }}
        onAddTask={user?.id ? () => setAddOpen(true) : undefined}
        onRemoveTask={(key) => {
          const own = customByKey(key);
          if (own) void removeCustom(own);
        }}
        more={more}
        week={weekMetrics}
        loadingWeek={loadingWeek}
        onOpenWeek={() => navigation.navigate("WeeklyReflection")}
        weekPageReady={weekPageReady}
        onOpenWeekPage={() => navigation.navigate("Scrapbook")}
        footerLinks={footerLinks}
        toast={inMemorial ? null : toast}
        toastBottom={16}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      <FocusPickerSheet
        visible={focusOpen}
        initial={plan.settings?.chosen ? plan.settings.focusAreas : NO_FOCUS}
        petName={petDisplayName}
        saving={savingFocus}
        onSave={handleSaveFocus}
        onClose={() => (savingFocus ? null : setFocusOpen(false))}
      />
      <AddTaskSheet visible={addOpen} petName={petDisplayName} saving={savingTask} onSave={(input) => void handleAddTask(input)} onClose={() => (savingTask ? null : setAddOpen(false))} />
      <MilestoneSheet
        days={milestone}
        petName={petDisplayName}
        onClose={() => setMilestone(null)}
        onKeepsakes={() => {
          setMilestone(null);
          navigation.navigate("Keepsakes");
        }}
      />
      <BreathingModal visible={breathingOpen} onClose={() => setBreathingOpen(false)} />

      <Modal visible={petNameModalVisible} transparent animationType="fade" onRequestClose={() => {}}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.nameBackdrop}>
          <View style={[styles.nameCard, { backgroundColor: nameSurface.paper }]}>
            <Text style={[type.title, { color: nameSurface.text }]}>What's your pet called?</Text>
            <Text style={[type.callout, styles.nameLead, { color: nameSurface.textSecondary }]}>Their portrait is ready. Give it a name and they'll move in.</Text>
            <TextInput
              value={petNameInput}
              onChangeText={(text) => {
                setPetNameInput(text);
                if (petNameError) setPetNameError("");
              }}
              placeholder="Their name"
              placeholderTextColor={nameSurface.textTertiary}
              autoCapitalize="words"
              maxLength={PET_NAME_MAX_CHARS}
              editable={!savingPetName}
              returnKeyType="done"
              onSubmitEditing={handleSavePetName}
              style={[styles.nameInput, { color: nameSurface.text, backgroundColor: nameSurface.sunken }]}
            />
            {petNameError ? <Text style={[type.meta, styles.nameError]}>{petNameError}</Text> : null}
            <PressableScale onPress={handleSavePetName} disabled={savingPetName} accessibilityRole="button" style={[styles.nameSave, savingPetName && styles.nameSaveDisabled]}>
              <Text style={styles.nameSaveText}>{savingPetName ? "Saving..." : "Save"}</Text>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nameBackdrop: {
    flex: 1,
    backgroundColor: "rgba(32,24,40,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  nameCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.card,
    padding: 20,
  },
  nameLead: {
    marginTop: 6,
  },
  nameInput: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: radius.chip,
    paddingHorizontal: 14,
    fontFamily: fonts.bodySemibold,
    fontSize: 17,
  },
  nameError: {
    marginTop: 8,
    color: brand.ember,
  },
  nameSave: {
    marginTop: 16,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brand.bloom,
  },
  nameSaveDisabled: {
    opacity: 0.6,
  },
  nameSaveText: {
    color: ink.primary,
    fontFamily: fonts.bodyHeavy,
    fontSize: 16,
  },
});
