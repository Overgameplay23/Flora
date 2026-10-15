import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, ToastAndroid, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setStatusBarStyle } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import HomeView from "../../src/components/home/HomeView";
import FocusPickerSheet from "../../src/components/home/FocusPickerSheet";
import PressableScale from "../../src/components/common/PressableScale";
import BreathingModal from "../../src/components/checkin/BreathingModal";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePet } from "../../src/hooks/usePet";
import { useCycle } from "../../src/hooks/useCycle";
import { useReminderTaps } from "../../src/hooks/useReminderTaps";
import { useTodayPlan } from "../../src/hooks/useTodayPlan";
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
import { notify } from "../../src/utils/confirm";
import * as haptics from "../../src/utils/haptics";
import { brand, fonts, ink, radius, skyFor, surfaces, type } from "../../src/theme/tokens";

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

  const [energy, setEnergy] = useState(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [savingFocus, setSavingFocus] = useState(false);
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
  const [readyFallback, setReadyFallback] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReadyFallback(true), 2500);
    return () => clearTimeout(id);
  }, []);
  const planReady =
    !user?.id ||
    readyFallback ||
    (energyLoadedFor === `${user.id}:${homeDateKey}` && returnChecked && !cycle.loading && petStatus !== "loading" && petStatus !== "idle");

  const plan = useTodayPlan({
    userId: user?.id ?? null,
    petName: petDisplayName,
    dateKey: homeDateKey,
    energy,
    returning,
    memorial: inMemorial,
    cyclePhase,
    ready: planReady,
  });

  // ---- the battery check, kept per day on the device --------------------------------------------------
  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setEnergy(null);
      return undefined;
    }
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
    (item, points) => {
      playDing();
      haptics.tapSoft();
      setPetReaction("cheer");
      setPetAct(item.planned.task.act || actForTask(item.title));
      setSprouts((prev) => (typeof prev === "number" ? prev + Math.max(0, points) : prev));
      setToast({ id: Date.now(), text: careDoneLine(petDisplayName, points, item.title.length + Date.now() / 1000) });
    },
    [petDisplayName]
  );

  const completeItem = useCallback(
    async (item, options = {}) => {
      const key = item.planned.task.id;
      if (item.done || completing[key]) return;
      if (!user?.id) {
        // signed out (nothing to sync against): tick it here so the moment still lands
        completedThisSession.current = true;
        plan.markDone(key);
        celebrate(item, 0);
        return;
      }
      setCompleting((prev) => ({ ...prev, [key]: true }));
      setNoticeByTask((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        // the batch row lookup can miss a task on a flaky network; never fake a tick that was not saved
        const taskId = item.taskId ?? (await plan.ensureRow(item.planned.task));
        if (taskId == null) throw new Error("No task row for this care task yet");
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
          celebrate(item, 0);
          return;
        }
        plan.markDone(key);
        if (mutation.result.inserted) {
          celebrate(item, mutation.result.points_awarded);
        } else if (!options.silent) {
          setToast({ id: Date.now(), text: `${petDisplayName} already counted that one today.` });
        }
        void loadSideData();
      } catch (error) {
        haptics.warning();
        setNoticeByTask((prev) => ({ ...prev, [key]: { type: "error", message: "Couldn't save that. Tap to try again." } }));
        console.error("TASK_COMPLETE_ERROR", error);
      } finally {
        setCompleting((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [celebrate, completing, loadSideData, petDisplayName, plan, user?.id]
  );

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
  // the status bar follows the sky while Home is in front, and goes back to the default (stack screens have
  // light headers) when leaving; kept apart so an hour change does not re-run the refresh above
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(sky.statusBar);
      return () => setStatusBarStyle("auto");
    }, [sky.statusBar])
  );

  // ---- Graceful Hibernation: after days away, a warm welcome once per visit, no backlog ---------------
  useEffect(() => {
    if (!user?.id || lastSeenChecked.current === user.id) return;
    lastSeenChecked.current = user.id;
    const key = `floura:last-seen:${user.id}`;
    (async () => {
      try {
        const previous = await AsyncStorage.getItem(key);
        const status = returnStatus(previous, todayKey());
        if (status.kind === "hibernation" || (status.kind === "back" && status.daysAway >= 2)) {
          setReturnNote(status);
          setPetReaction("love");
        }
        await AsyncStorage.setItem(key, nextLastSeen(previous, todayKey()));
      } catch (_error) {
      } finally {
        setReturnChecked(true);
      }
    })();
  }, [user?.id]);

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
  });
  const petMood = energyOption(energy)?.petMood ?? petMoodFromStores({ liveState: petEmotionState, dailyMood: moodState, hour });

  const tasks = useMemo(
    () =>
      plan.items.map((item) => ({
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
    [completing, noticeByTask, plan.items]
  );
  const itemByKey = useCallback((key) => plan.items.find((item) => item.planned.task.id === key), [plan.items]);

  const more = useMemo(() => {
    const items = [
      { key: "play", title: `Play with ${petDisplayName}`, subtitle: "Fetch, bubbles and more", icon: "tennisball-outline", category: "play", onPress: () => navigation.navigate("Play") },
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
  }, [cycle.enabled, cycle.status?.cycleDay, cycle.status?.phase, gentle, hasExistingCheckin, navigation, petDisplayName, theme]);

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
        tasks={tasks}
        loadingTasks={plan.loading}
        tasksError={plan.error}
        onRetryTasks={() => void plan.reload()}
        onCompleteTask={(key, options) => {
          const item = itemByKey(key);
          if (item) void completeItem(item, options);
        }}
        onOpenTask={(key) => {
          const item = itemByKey(key);
          if (item) openItem(item);
        }}
        more={more}
        week={weekMetrics}
        loadingWeek={loadingWeek}
        onOpenWeek={() => navigation.navigate("WeeklyReflection")}
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
