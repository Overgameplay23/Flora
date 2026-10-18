import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { notify } from "../../utils/confirm";
import { type PetPhoto, cameraAvailable, pickPetPhotos } from "../../utils/pickPetPhotos";
import { useAuth } from "../../contexts/AuthContext";
import { usePet } from "../../hooks/usePet";
import { supabase } from "../../lib/supabase";
import Button from "../../components/common/Button";
import OnboardingFrame from "../../components/onboarding/OnboardingFrame";
import { LookStep, MeetStep, NameStep, PaintingStep, PhotoStep, ShelterStep, SpeciesStep, WelcomeStep } from "../../components/onboarding/PetSteps";
import { AreasStep, BatteryStep, CycleStep, HardDayStep, MAX_FOCUS_PICKS, VoiceStep } from "../../components/onboarding/QuizSteps";
import { FirstThingStep, ReminderStep, RevealStep, type FirstThingRow, type PlanPreviewRow } from "../../components/onboarding/FinishSteps";
import type { PetImageSources } from "../../components/garden/usePetCandidates";
import type { PetReaction } from "../../components/pet/PetPortrait";
import { savePetName, upsertPet, upsertPetResult } from "../../services/petService";
import { saveOriginalPetPhoto, stylizePet } from "../../services/petStylize";
import { patchPetLocally, savePetLook, setPetNameLocally } from "../../services/petStore";
import { getPetImageCache } from "../../utils/petImageCache";
import { LOOK_ONLY_SENTINEL } from "../../utils/petImages";
import { completeTaskWithResilience } from "../../services/taskCompletion";
import { ensurePlanTaskRows, savePlanSettings } from "../../services/planStore";
import { saveCarePrefs } from "../../services/carePrefs";
import { setCycleEnabled } from "../../services/cycleStore";
import { celebrationLine } from "../../domain/petMood";
import { buildDailyPlan, dayPartForHour } from "../../domain/plan/select";
import { PLAN_CATALOG, catalogById, renderTitle } from "../../domain/plan/catalog";
import { DEFAULT_PLAN_SETTINGS, FOCUS_AREAS } from "../../domain/plan/focusAreas";
import type { CatalogTask, Energy, FocusArea } from "../../domain/plan/types";
import { type Companion, adoptedLook } from "../../domain/shelter";
import { DEFAULT_REMINDERS, MORNING_TIMES, type ReminderTime, formatTime } from "../../domain/reminders";
import { remindersSupported, requestReminderPermission, saveReminderSettings, syncReminders } from "../../services/reminders";
import { DEFAULT_LOOK, type PetLook, type Species, withSpecies } from "../../domain/petLook";
import { sanctuaryCopy, sanctuaryFor } from "../../domain/sanctuary";
import { applySuggestion, type LookSuggestion } from "../../domain/photoLook";
import { suggestLookFromPhoto } from "../../services/photoLook";
import {
  type HardDayMinutes,
  type OnboardingMode,
  type OnboardingStep,
  type OnboardingTrack,
  type Voice,
  dailyCountFor,
  firstStepFor,
  nameSuggestionsFor,
  nextStep,
  previousStep,
  revealReasons,
  stepProgress,
  validatePetName,
  visibleSteps,
} from "../../domain/onboarding";
import { getLocalDateKey } from "../../utils/dateKeys";
import { playDing } from "../../utils/sfx";
import * as haptics from "../../utils/haptics";
import { canShareAtReveal } from "../../domain/shareCard";

type PaintingState = { status: "idle" | "running" | "done" | "kept-photo" | "failed"; message?: string };

const AREA_LABELS: Record<string, string> = Object.fromEntries(FOCUS_AREAS.map((area) => [area.id, area.label]));
const REMINDER_TIMES: ReminderTime[] = MORNING_TIMES.filter((t) => t.hour >= 7 && t.hour <= 9);

function safeErrorMessage(error: any) {
  const raw = error?.userMessage || error?.message || "Something went wrong.";
  const text = String(raw).replace(/data:[^ ]+/gi, "").replace(/\s+/g, " ").trim();
  return text.length > 160 ? text.slice(0, 160) : text;
}

function previewRow(task: CatalogTask, reason: string, petName: string): PlanPreviewRow {
  return { id: task.id, title: renderTitle(task, petName), category: task.category, icon: task.icon, minutes: task.minutes, reason };
}

/**
 * First run (docs/ROADMAP.md, "Onboarding v2"): the pet first, the questions second. welcome -> dog or cat
 * -> 1-3 photos (or the shelter, or the look editor) -> name, at which point the portrait starts painting
 * in the background -> four short questions (five with the rhythm area) that set up the plan engine and
 * the care preferences -> the reveal (the pet in its sanctuary, and the plan it made) -> the morning
 * reminder -> one small thing to do right now. "look" mode reuses the species and look steps for "Change
 * look"; "replace" mode is the new-photos flow with an explicit painting wait. The main tabs are entered
 * only when the person taps Start: the auth gate holds the screen while `onboardingActive` is set.
 */
export default function OnboardingScreen({ route, navigation }: any) {
  const mode: OnboardingMode = route?.params?.mode === "replace" ? "replace" : route?.params?.mode === "look" ? "look" : "first";
  const { user, setProfile, setOnboardingActive } = useAuth();
  const { sources: petSources, name: existingName, look: existingLook, refresh: refreshPet } = usePet();
  const { height } = useWindowDimensions();

  const [step, setStep] = useState<OnboardingStep>(firstStepFor(mode));
  const [species, setSpecies] = useState<Species>(existingLook?.species ?? "dog");
  const sanctuary = sanctuaryFor(species);
  const place = sanctuaryCopy(sanctuary).place;
  // "own": bring a real pet to life; "adopt": no pet, pick an illustrated companion from the shelter
  const [track, setTrack] = useState<OnboardingTrack>("own");
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [draftLook, setDraftLook] = useState<PetLook>(existingLook ?? DEFAULT_LOOK.dog);
  const [savingLook, setSavingLook] = useState(false);
  // 1-3 photos of the real pet; the first one is kept as the pet's original photo
  const [photos, setPhotos] = useState<PetPhoto[]>([]);
  const hasPhoto = photos.length > 0;
  const [suggestion, setSuggestion] = useState<LookSuggestion | null>(null);
  const [picking, setPicking] = useState(false);
  const [committingPhotos, setCommittingPhotos] = useState(false);
  const [nameDraft, setNameDraft] = useState(existingName || "");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [painting, setPainting] = useState<PaintingState>({ status: "idle" });
  const [paintRequested, setPaintRequested] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [finishing, setFinishing] = useState(false);
  const paintingStarted = useRef(false);

  // the quiz
  const [areas, setAreas] = useState<FocusArea[]>([]);
  const [areasHint, setAreasHint] = useState<string | null>(null);
  const [battery, setBattery] = useState<Energy | null>(null);
  const [hardDay, setHardDay] = useState<HardDayMinutes | null>(null);
  const [voice, setVoice] = useState<Voice | null>(null);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const pickedCycle = areas.includes("cycle");

  // the reminder (report screen 6: "Would you like [Pet] to greet you tomorrow morning?")
  const [reminderTime, setReminderTime] = useState<ReminderTime>(DEFAULT_REMINDERS.morning.time);
  const [reminderChoice, setReminderChoice] = useState<"idle" | "on" | "declined" | "denied">("idle");
  const [settingReminder, setSettingReminder] = useState(false);

  // one small thing
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [doneTask, setDoneTask] = useState<{ id: string; line: string } | null>(null);

  useEffect(() => {
    // when the store catches up (e.g. "Change look" opened before the pet loaded), adopt what exists
    if (existingLook && step === "species" && mode === "look") {
      setSpecies(existingLook.species);
      setDraftLook(existingLook);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingLook?.species]);

  // the auth gate keeps this screen until Start, even once the pet's photo marks the profile (R-84)
  useEffect(() => {
    if (mode !== "first") return undefined;
    setOnboardingActive?.(true);
    return () => setOnboardingActive?.(false);
  }, [mode, setOnboardingActive]);

  const petName = useMemo(() => {
    const valid = validatePetName(nameDraft);
    return valid.ok ? valid.name : existingName || "your pet";
  }, [nameDraft, existingName]);
  const stepContext = useMemo(
    () => ({ hasName: !!existingName, hasPhoto, track, pickedCycle, remindersSupported }),
    [existingName, hasPhoto, pickedCycle, track]
  );
  const steps = useMemo(() => visibleSteps(mode, track, hasPhoto, { pickedCycle, remindersSupported }), [hasPhoto, mode, pickedCycle, track]);
  const progress = stepProgress(step, steps);
  const sceneHeight = Math.round(Math.min(340, Math.max(220, height * 0.36)));

  const goNext = useCallback(() => {
    const next = nextStep(step, mode, stepContext);
    if (next) setStep(next);
  }, [mode, step, stepContext]);

  const goBack = useCallback(() => {
    const prev = previousStep(step, mode, track, hasPhoto);
    if (prev) setStep(prev);
    else if (mode !== "first" && navigation?.canGoBack?.()) navigation.goBack();
  }, [hasPhoto, mode, navigation, step, track]);

  // ---- adopt a companion -------------------------------------------------------------------------------
  const adopt = async () => {
    if (!user?.id || !companion || adopting) return;
    setAdopting(true);
    try {
      const look = adoptedLook(companion);
      await savePetLook(user.id, look);
      setDraftLook(look);
      if (!nameDraft.trim()) setNameDraft(companion.name);
      goNext();
    } catch (error) {
      notify("Couldn't bring them home yet", safeErrorMessage(error));
    } finally {
      setAdopting(false);
    }
  };

  // ---- species / look --------------------------------------------------------------------------------
  const chooseSpecies = (next: Species) => {
    setSpecies(next);
    setDraftLook((prev) => {
      const base = prev.species === next ? prev : existingLook && existingLook.species === next ? existingLook : withSpecies(prev, next);
      return suggestion ? applySuggestion(base, suggestion) : base;
    });
  };

  const commitLook = async () => {
    if (!user?.id || savingLook) return;
    setSavingLook(true);
    try {
      await savePetLook(user.id, draftLook);
      if (mode === "look") {
        if (navigation?.canGoBack?.()) navigation.goBack();
        return;
      }
      goNext();
    } catch (error) {
      notify("Couldn't save the look", safeErrorMessage(error));
    } finally {
      setSavingLook(false);
    }
  };

  // ---- photos (1-3 of the same pet) ---------------------------------------------------------------------
  const addPhotos = useCallback(
    async (source: "camera" | "library") => {
      if (picking) return;
      const remaining = 3 - photos.length;
      if (remaining <= 0) return;
      setPicking(true);
      try {
        const result = await pickPetPhotos(source, remaining);
        if (result.denied) {
          notify("Permission needed", source === "camera" ? "Allow camera access to take a photo of your pet." : "Allow photo access to choose pictures of your pet.");
          return;
        }
        if (result.canceled) return;
        if (result.photos.length === 0) {
          notify("Couldn't read those photos", "Please try other pictures.");
          return;
        }
        if (result.unreadable > 0) notify("Some photos were skipped", "One or more pictures could not be read.");
        const next = [...photos, ...result.photos].slice(0, 3);
        setPhotos(next);
        // the illustrated pet stands in until the portrait is painted: quietly tint it from the first photo
        if (photos.length === 0) {
          const hint = suggestLookFromPhoto(next[0].base64, species);
          setSuggestion(hint);
          if (hint) setDraftLook((prev) => applySuggestion(prev, hint));
        }
      } catch (error) {
        console.error("ONBOARDING_PICK_ERROR", { message: (error as any)?.message });
        notify("Couldn't open the picker", "Please try again.");
      } finally {
        setPicking(false);
      }
    },
    [photos, picking, species]
  );

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setSuggestion(null);
      return next;
    });
  }, []);

  // "Use these photos": the portrait comes from the photos, nothing is picked by hand. The species and the
  // photo-tinted look are still saved so the stand-in matches while the portrait is painted.
  const commitPhotos = useCallback(async () => {
    if (!user?.id || committingPhotos || photos.length === 0) return;
    setCommittingPhotos(true);
    try {
      if (mode === "first") await savePetLook(user.id, draftLook);
      goNext();
    } catch (error) {
      notify("Couldn't save that yet", safeErrorMessage(error));
    } finally {
      setCommittingPhotos(false);
    }
  }, [committingPhotos, draftLook, goNext, mode, photos.length, user?.id]);

  // ---- name (the painting starts here, in the background) -------------------------------------------
  const submitName = useCallback(async () => {
    const valid = validatePetName(nameDraft);
    if (valid.ok === false) {
      setNameError(valid.error);
      return;
    }
    if (!user?.id) return;
    setSavingName(true);
    setNameError("");
    try {
      const saved = await savePetName(user.id, valid.name);
      setPetNameLocally(user.id, saved);
      setNameDraft(saved);
      if (mode === "first" && hasPhoto) setPaintRequested(true);
      goNext();
    } catch (error) {
      setNameError(safeErrorMessage(error));
    } finally {
      setSavingName(false);
    }
  }, [goNext, hasPhoto, mode, nameDraft, user?.id]);

  // ---- painting (first run: while the quiz runs; "new photos": its own step) -------------------------
  useEffect(() => {
    if (step === "painting") setPaintRequested(true);
  }, [step]);

  useEffect(() => {
    if (!paintRequested || paintingStarted.current || !user?.id || photos.length === 0) return;
    paintingStarted.current = true;
    const primary = photos[0];
    let alive = true;
    const startedAt = Date.now();
    const timer = setInterval(() => alive && setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    setPainting({ status: "running" });

    (async () => {
      patchPetLocally(user.id, { processing_status: "processing", processing_error: null });
      await upsertPet(user.id, { processing_status: "processing", processing_error: null }).catch(() => {});
      try {
        const result = await stylizePet({
          userId: user.id,
          images: photos.map((item) => ({ base64: item.base64, mimeType: item.mimeType })),
          imageUrl: undefined,
          style: "portrait",
        });
        await upsertPetResult(user.id, {
          stylized_url: result.stylizedUrl,
          cutout_url: result.cutoutUrl,
          mask_url: result.maskUrl,
          photo_url: result.renderUrl || result.stylizedUrl || result.cutoutUrl || null,
          original_photo_url: result.originalUrl || null,
          processing_status: "ready",
          processing_error: null,
        });
        if (!alive) return;
        setPainting({ status: "done" });
      } catch (error: any) {
        console.warn("ONBOARDING_STYLIZE_FAILED", { message: error?.message, code: error?.errorCode || error?.code });
        const cache = getPetImageCache() as any;
        let keptPhoto = !!(cache && cache.userId === user.id && cache.original);
        if (!keptPhoto) {
          try {
            await saveOriginalPetPhoto({ userId: user.id, imageBase64: primary.base64, mimeType: primary.mimeType });
            keptPhoto = true;
          } catch (saveError) {
            console.error("ONBOARDING_SAVE_ORIGINAL_FAILED", { message: (saveError as any)?.message });
          }
        }
        const message = safeErrorMessage(error);
        await upsertPet(user.id, { processing_status: "error", processing_error: message }).catch(() => {});
        patchPetLocally(user.id, { processing_status: "error", processing_error: message });
        if (!alive) return;
        setPainting(keptPhoto ? { status: "kept-photo", message } : { status: "failed", message });
      } finally {
        await refreshPet();
      }
    })();

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [paintRequested, photos, refreshPet, user?.id]);

  useEffect(() => {
    if (mode === "replace" && step === "painting" && (painting.status === "done" || painting.status === "kept-photo")) {
      const id = setTimeout(() => {
        setStep("meet");
        setReaction("cheer");
      }, 900);
      return () => clearTimeout(id);
    }
    if (step === "meet" && painting.status === "idle") setReaction("cheer");
    if (step === "reveal") setReaction("cheer");
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painting.status, step]);

  const retryPainting = () => {
    paintingStarted.current = false;
    setElapsed(0);
    setPainting({ status: "idle" });
    setPaintRequested(false);
    setStep("painting");
  };

  // ---- the quiz ---------------------------------------------------------------------------------------
  const toggleArea = (area: FocusArea) => {
    setAreasHint(null);
    setAreas((prev) => {
      if (prev.includes(area)) return prev.filter((id) => id !== area);
      if (prev.length >= MAX_FOCUS_PICKS) {
        setAreasHint("Three is plenty. Unpick one to swap it.");
        return prev;
      }
      return [...prev, area];
    });
  };

  const planSettings = useMemo(
    () => ({ focusAreas: areas.length > 0 ? areas : [...DEFAULT_PLAN_SETTINGS.focusAreas], dailyCount: dailyCountFor(battery, hardDay) }),
    [areas, battery, hardDay]
  );

  /** Saves what the quiz learned: focus areas and daily count for the plan engine, the rest as care preferences. */
  const commitQuiz = useCallback(
    async (options: { keepCycle: boolean; cycleOn: boolean }) => {
      if (!user?.id || savingQuiz) return;
      setSavingQuiz(true);
      try {
        const focusAreas = options.keepCycle ? planSettings.focusAreas : planSettings.focusAreas.filter((area) => area !== "cycle");
        if (!options.keepCycle) setAreas((prev) => prev.filter((area) => area !== "cycle"));
        await savePlanSettings(user.id, { focusAreas: focusAreas.length > 0 ? focusAreas : [...DEFAULT_PLAN_SETTINGS.focusAreas], dailyCount: planSettings.dailyCount });
        await saveCarePrefs(user.id, { usualBattery: battery, hardDayMinutes: hardDay, voice: voice ?? "warm" });
        if (options.cycleOn) await setCycleEnabled(user.id, true);
        haptics.success();
        setStep("reveal");
      } catch (error) {
        notify("Couldn't save that yet", safeErrorMessage(error));
      } finally {
        setSavingQuiz(false);
      }
    },
    [battery, hardDay, planSettings, savingQuiz, user?.id, voice]
  );

  // ---- the reveal: the plan the engine would build today from the answers ---------------------------
  const planPreview = useMemo(() => {
    if (step !== "reveal" && step !== "firstStep") return [] as PlanPreviewRow[];
    const planned = buildDailyPlan({
      settings: planSettings,
      dateKey: getLocalDateKey(),
      hour: new Date().getHours(),
      energy: battery,
      returning: false,
      memorial: false,
      cyclePhase: null,
      history: {},
      seed: user?.id || "guest",
    });
    return planned.map((item) => previewRow(item.task, item.reason, petName));
  }, [battery, petName, planSettings, step, user?.id]);
  const reasons = useMemo(() => revealReasons({ areas: planSettings.focusAreas, areaLabels: AREA_LABELS, battery, hardDay }), [battery, hardDay, planSettings.focusAreas]);
  const paintingNote =
    painting.status === "running"
      ? `Still painting ${petName} from your photos. The portrait appears on Home when it's ready.`
      : painting.status === "kept-photo"
        ? `The portrait didn't finish, so your photo is kept for later. You can retry from the Pet tab any time.`
        : null;

  // ---- the reminder -----------------------------------------------------------------------------------
  const enableMorningReminder = async () => {
    if (!user?.id || settingReminder) return;
    setSettingReminder(true);
    try {
      const permission = await requestReminderPermission();
      if (permission !== "granted") {
        setReminderChoice(permission === "denied" ? "denied" : "declined");
        if (permission !== "denied") goNext();
        return;
      }
      await saveReminderSettings(user.id, {
        ...DEFAULT_REMINDERS,
        enabled: true,
        morning: { enabled: true, time: reminderTime },
        evening: { ...DEFAULT_REMINDERS.evening, enabled: false },
      });
      await syncReminders(user.id, { petName, species }, { force: true });
      setReminderChoice("on");
      goNext();
    } finally {
      setSettingReminder(false);
    }
  };

  // ---- one small thing --------------------------------------------------------------------------------
  const firstThings = useMemo<FirstThingRow[]>(() => {
    if (step !== "firstStep") return [];
    const part = dayPartForHour(new Date().getHours());
    const gentle = (task: CatalogTask) => task.kind === "tap" && task.lowEnergySafe && (task.dayParts === "any" || task.dayParts.includes(part));
    const fromPlan = planPreview.map((row) => catalogById(row.id)).filter((task): task is CatalogTask => !!task && gentle(task));
    const extras = PLAN_CATALOG.filter((task) => gentle(task) && !fromPlan.some((other) => other.id === task.id));
    return [...fromPlan, ...extras].slice(0, 3).map((task) => ({ ...previewRow(task, "A small start", petName), act: task.act ?? null }));
  }, [petName, planPreview, step]);

  const completeFirstTask = async (row: FirstThingRow) => {
    if (completingId || doneTask || !user?.id) return;
    const task = catalogById(row.id);
    if (!task) return;
    setCompletingId(row.id);
    try {
      const ids = await ensurePlanTaskRows(user.id, [task], petName);
      const taskId = ids[task.id];
      if (taskId == null) throw new Error("No task row yet");
      const mutation = await completeTaskWithResilience({
        taskId,
        eventMeta: { category: task.category === "cycle" ? null : task.category, difficulty: task.effort, points: null },
      });
      const points = mutation.state === "success" ? mutation.result.points_awarded : 0;
      setDoneTask({ id: row.id, line: celebrationLine(petName, points, row.title.length) });
      setReaction("love");
      haptics.success();
      playDing();
    } catch (error) {
      console.error("ONBOARDING_FIRST_TASK_ERROR", { message: (error as any)?.message });
      notify("Couldn't save that yet", "No problem, you can do it from Home in a moment.");
    } finally {
      setCompletingId(null);
    }
  };

  // ---- finish -----------------------------------------------------------------------------------------
  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await refreshPet();
      if (user?.id) {
        // The app gate reads profiles.pet_photo_url. Without a photo the chosen look still counts as a
        // pet, marked with a sentinel the image ladder ignores.
        const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
        if (error) console.warn("ONBOARDING_PROFILE_REFRESH_ERROR", error.message);
        const cache = getPetImageCache() as any;
        const fallbackUrl = (cache && cache.userId === user.id ? cache.original : null) || LOOK_ONLY_SENTINEL;
        if (data) {
          if (!data.pet_photo_url) {
            const { error: markError } = await supabase.from("profiles").update({ pet_photo_url: fallbackUrl }).eq("user_id", user.id);
            if (markError) console.warn("ONBOARDING_PROFILE_MARK_ERROR", markError.message);
          }
          setProfile?.(data.pet_photo_url ? data : { ...data, pet_photo_url: fallbackUrl });
        } else {
          setProfile?.((prev: any) => ({ ...(prev || {}), user_id: user.id, pet_photo_url: fallbackUrl }));
        }
        if (mode === "first") await saveCarePrefs(user.id, { completedAt: new Date().toISOString() });
      }
      if (mode === "first") setOnboardingActive?.(false);
      else if (navigation?.canGoBack?.()) navigation.goBack();
    } finally {
      setFinishing(false);
    }
  };

  // ---- render -----------------------------------------------------------------------------------------
  const previewSources: PetImageSources | null = hasPhoto ? { original: photos[0].uri, allowOriginal: true } : null;
  const canGoBack = previousStep(step, mode, track, hasPhoto) !== null || (mode !== "first" && (step === "photo" || step === "species"));
  const sceneLook = mode === "replace" ? existingLook : draftLook;
  const nameSuggestions = nameSuggestionsFor({ hasPhoto });
  const showProgress = step !== "welcome";

  let content: React.ReactNode = null;
  let footer: React.ReactNode = null;

  switch (step) {
    case "welcome":
      content = <WelcomeStep sceneHeight={sceneHeight} />;
      footer = (
        <>
          <Button
            label="Create my pet"
            onPress={() => {
              setTrack("own");
              goNext();
            }}
          />
          <Button
            label="No pet? Adopt a companion"
            variant="quiet"
            onPress={() => {
              setTrack("adopt");
              setStep("species");
            }}
          />
        </>
      );
      break;
    case "species":
      content = (
        <SpeciesStep
          species={species}
          onPick={chooseSpecies}
          existingLook={existingLook}
          title={mode === "look" ? "Dog or cat?" : track === "adopt" ? "Who would you like to adopt?" : "Who's your best friend?"}
          lead={track === "adopt" ? "Dog or cat, whichever feels like company. The shelter has a few of each." : "Pick the one that's yours."}
        />
      );
      footer = <Button label="Continue" onPress={goNext} />;
      break;
    case "shelter":
      content = <ShelterStep species={species} companion={companion} onPick={setCompanion} />;
      footer = <Button label={companion ? `Take ${companion.name} home` : "Pick a companion"} onPress={adopt} disabled={!companion} loading={adopting} />;
      break;
    case "look":
      content = (
        <LookStep
          look={draftLook}
          onChange={setDraftLook}
          photoUri={hasPhoto ? photos[0].uri : null}
          suggestion={suggestion}
          onUsePhotoColours={suggestion ? () => setDraftLook((prev) => applySuggestion(prev, suggestion)) : undefined}
        />
      );
      footer = <Button label={mode === "look" ? "Save look" : "That's them"} onPress={commitLook} loading={savingLook} />;
      break;
    case "photo": {
      const left = 3 - photos.length;
      content = <PhotoStep photos={photos} picking={picking} petName={petName} replace={mode === "replace"} onAdd={addPhotos} onRemove={removePhoto} />;
      footer = hasPhoto ? (
        <>
          <Button label={photos.length === 1 ? "Use this photo" : "Use these photos"} onPress={commitPhotos} loading={committingPhotos} disabled={picking} />
          {left > 0 && cameraAvailable ? <Button label="Take another photo" variant="secondary" onPress={() => addPhotos("camera")} disabled={picking} /> : null}
        </>
      ) : (
        <>
          {cameraAvailable ? <Button label="Take a photo" onPress={() => addPhotos("camera")} disabled={picking} loading={picking} /> : null}
          <Button label="Choose from photos" variant={cameraAvailable ? "secondary" : "primary"} onPress={() => addPhotos("library")} disabled={picking} loading={!cameraAvailable && picking} />
          {mode === "first" ? <Button label="Skip for now" variant="quiet" onPress={goNext} /> : null}
        </>
      );
      break;
    }
    case "name":
      content = (
        <NameStep
          photoUri={hasPhoto ? photos[0].uri : null}
          look={draftLook}
          value={nameDraft}
          onChange={(text) => {
            setNameDraft(text);
            if (nameError) setNameError("");
          }}
          error={nameError}
          onSubmit={submitName}
          suggestions={nameSuggestions}
          lead={track === "adopt" && companion ? `${companion.name} came with that name. Keep it, or give them a new one.` : "This is how they'll be called all through the app."}
        />
      );
      footer = <Button label="That's the one" onPress={submitName} loading={savingName} />;
      break;
    case "painting":
      content = <PaintingStep sceneHeight={sceneHeight} previewSources={previewSources} look={sceneLook} petName={petName} status={painting.status} message={painting.message} elapsed={elapsed} />;
      footer =
        painting.status === "failed" ? (
          <>
            <Button label="Try again" onPress={retryPainting} />
            <Button label="Choose a different photo" variant="secondary" onPress={() => setStep("photo")} />
          </>
        ) : null;
      break;
    case "meet":
      content = (
        <MeetStep
          sceneHeight={sceneHeight}
          petSources={petSources}
          look={sceneLook}
          petName={petName}
          place={place}
          reaction={reaction}
          onReactionEnd={() => setReaction(null)}
          onPetPress={() => setReaction("love")}
          keptPhoto={painting.status === "kept-photo"}
        />
      );
      footer = <Button label={mode === "first" ? "Continue" : "Done"} onPress={mode === "first" ? goNext : finish} loading={finishing} />;
      break;
    case "quizAreas":
      content = <AreasStep picked={areas} onToggle={toggleArea} hint={areasHint} petName={petName} />;
      footer = <Button label={areas.length === 0 ? "Pick at least one" : "Continue"} onPress={goNext} disabled={areas.length === 0} />;
      break;
    case "quizBattery":
      content = <BatteryStep value={battery} onPick={setBattery} />;
      footer = <Button label="Continue" onPress={goNext} disabled={!battery} />;
      break;
    case "quizHardDay":
      content = <HardDayStep value={hardDay} onPick={setHardDay} />;
      footer = <Button label="Continue" onPress={goNext} disabled={!hardDay} />;
      break;
    case "quizVoice":
      content = <VoiceStep value={voice} onPick={setVoice} petName={petName} />;
      footer = <Button label={pickedCycle ? "Continue" : "Build my plan"} onPress={pickedCycle ? goNext : () => void commitQuiz({ keepCycle: false, cycleOn: false })} disabled={!voice} loading={savingQuiz} />;
      break;
    case "quizCycle":
      content = <CycleStep petName={petName} />;
      footer = (
        <>
          <Button label="Yes, on this phone" onPress={() => void commitQuiz({ keepCycle: true, cycleOn: true })} loading={savingQuiz} />
          <Button label="Not now" variant="quiet" onPress={() => void commitQuiz({ keepCycle: false, cycleOn: false })} disabled={savingQuiz} />
        </>
      );
      break;
    case "reveal":
      content = (
        <RevealStep
          sceneHeight={sceneHeight}
          petSources={petSources}
          look={sceneLook}
          petName={petName}
          theme={sanctuary}
          place={place}
          reasons={reasons}
          plan={planPreview}
          paintingNote={paintingNote}
          reaction={reaction}
          onReactionEnd={() => setReaction(null)}
          onPetPress={() => setReaction("love")}
        />
      );
      footer = (
        <>
          <Button label="Looks good" onPress={goNext} />
          {/* the first painting is the moment people post: offer the card once it is really painted */}
          {canShareAtReveal(petSources, track === "adopt", painting.status === "done") ? (
            <Button label={`Share ${petName || "your pet"}'s card`} icon="share-outline" variant="quiet" onPress={() => navigation.navigate("ShareCard")} />
          ) : null}
        </>
      );
      break;
    case "reminder":
      content = <ReminderStep petName={petName} times={REMINDER_TIMES} time={reminderTime} onPickTime={setReminderTime} denied={reminderChoice === "denied"} />;
      footer =
        reminderChoice === "denied" ? (
          <Button label="Continue" onPress={goNext} />
        ) : (
          <>
            <Button label={`Yes, at ${formatTime(reminderTime)}`} onPress={enableMorningReminder} loading={settingReminder} />
            <Button
              label="Not now"
              variant="quiet"
              onPress={() => {
                setReminderChoice("declined");
                goNext();
              }}
              disabled={settingReminder}
            />
          </>
        );
      break;
    case "firstStep":
      content = (
        <FirstThingStep
          petName={petName}
          place={place}
          tasks={firstThings}
          doneId={doneTask?.id ?? null}
          busyId={completingId}
          onPick={(row) => void completeFirstTask(row)}
          celebration={doneTask?.line ?? null}
          reaction={reaction}
          onReactionEnd={() => setReaction(null)}
        />
      );
      footer = (
        <>
          <Button label={doneTask ? `Into the ${place}` : "Start"} onPress={finish} loading={finishing} />
          {!doneTask ? <Button label="Maybe later" variant="quiet" onPress={finish} disabled={finishing} /> : null}
        </>
      );
      break;
    default:
      content = null;
  }

  return (
    <OnboardingFrame progress={showProgress ? progress : null} onBack={canGoBack ? goBack : null} footer={footer} keyboard={step === "name"}>
      {content}
    </OnboardingFrame>
  );
}
