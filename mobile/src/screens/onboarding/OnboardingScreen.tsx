import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { usePet } from "../../hooks/usePet";
import { supabase } from "../../lib/supabase";
import GardenStage from "../../components/garden/GardenStage";
import type { PetImageSources } from "../../components/garden/usePetCandidates";
import type { PetReaction } from "../../components/pet/PetPortrait";
import { savePetName, upsertPet, upsertPetResult } from "../../services/petService";
import { saveOriginalPetPhoto, stylizePet } from "../../services/petStylize";
import { patchPetLocally, setPetNameLocally } from "../../services/petStore";
import { getPetImageCache } from "../../utils/petImageCache";
import { completeTaskWithResilience } from "../../services/taskCompletion";
import { celebrationLine } from "../../domain/petMood";
import {
  NAME_SUGGESTIONS,
  OnboardingMode,
  OnboardingStep,
  PET_NAME_MAX,
  firstStepFor,
  nextStep,
  paintingLine,
  previousStep,
  validatePetName,
  visibleSteps,
} from "../../domain/onboarding";
import { playDing } from "../../utils/sfx";

type PickedPhoto = { uri: string; base64: string; mimeType: string };
type PaintingState = { status: "idle" | "running" | "done" | "kept-photo" | "failed"; message?: string };
type SeedTask = { id: number | string; title: string; points?: number | null; category?: string | null; difficulty?: string | number | null };

function safeErrorMessage(error: any) {
  const raw = error?.userMessage || error?.message || "Something went wrong.";
  const text = String(raw).replace(/data:[^ ]+/gi, "").replace(/\s+/g, " ").trim();
  return text.length > 160 ? text.slice(0, 160) : text;
}

function StepDots({ steps, current }: { steps: OnboardingStep[]; current: OnboardingStep }) {
  const index = Math.max(0, steps.indexOf(current));
  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel={`Step ${index + 1} of ${steps.length}`}>
      {steps.map((step, i) => (
        <View key={step} style={[styles.dot, i === index && styles.dotActive, i < index && styles.dotDone]} />
      ))}
    </View>
  );
}

/**
 * First run: welcome -> photo -> name -> painting -> meet -> one small thing. The same screen handles
 * "change pet" (mode "replace") with the extra steps skipped. Nothing here flips the app into the main
 * tabs until the person taps Start, so the flow can never be interrupted by a profile refresh.
 */
export default function OnboardingScreen({ route, navigation }: any) {
  const mode: OnboardingMode = route?.params?.mode === "replace" ? "replace" : "first";
  const { user, setProfile } = useAuth();
  const { sources: petSources, name: existingName, refresh: refreshPet } = usePet();
  const { width, height } = useWindowDimensions();

  const [step, setStep] = useState<OnboardingStep>(firstStepFor(mode));
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [picking, setPicking] = useState(false);
  const [nameDraft, setNameDraft] = useState(existingName || "");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [painting, setPainting] = useState<PaintingState>({ status: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [tasks, setTasks] = useState<SeedTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [doneTask, setDoneTask] = useState<{ id: string; line: string } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const paintingStarted = useRef(false);

  const petName = useMemo(() => {
    const valid = validatePetName(nameDraft);
    return valid.ok ? valid.name : existingName || "your pet";
  }, [nameDraft, existingName]);
  const steps = useMemo(() => visibleSteps(mode), [mode]);
  const sceneHeight = Math.round(Math.min(340, Math.max(220, height * 0.36)));

  const goNext = useCallback(() => {
    const next = nextStep(step, mode, { hasName: !!existingName });
    if (next) setStep(next);
  }, [existingName, mode, step]);

  const goBack = useCallback(() => {
    const prev = previousStep(step, mode);
    if (prev) setStep(prev);
    else if (mode === "replace" && navigation?.canGoBack?.()) navigation.goBack();
  }, [mode, navigation, step]);

  // ---- photo ------------------------------------------------------------------------------------------
  const pick = useCallback(async (source: "camera" | "library") => {
    if (picking) return;
    setPicking(true);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          source === "camera" ? "Allow camera access to take a photo of your pet." : "Allow photo access to choose a picture of your pet."
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      };
      const result =
        source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri || !asset?.base64) {
        Alert.alert("Couldn't read that photo", "Please try another picture.");
        return;
      }
      setPhoto({
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType || (asset.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"),
      });
    } catch (error) {
      console.error("ONBOARDING_PICK_ERROR", { message: (error as any)?.message });
      Alert.alert("Couldn't open the picker", "Please try again.");
    } finally {
      setPicking(false);
    }
  }, [picking]);

  // ---- name -------------------------------------------------------------------------------------------
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
      goNext();
    } catch (error) {
      setNameError(safeErrorMessage(error));
    } finally {
      setSavingName(false);
    }
  }, [goNext, nameDraft, user?.id]);

  // ---- painting ---------------------------------------------------------------------------------------
  useEffect(() => {
    if (step !== "painting" || paintingStarted.current || !user?.id || !photo) return;
    paintingStarted.current = true;
    let alive = true;
    const startedAt = Date.now();
    const timer = setInterval(() => alive && setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    setPainting({ status: "running" });

    (async () => {
      patchPetLocally(user.id, { processing_status: "processing", processing_error: null });
      await upsertPet(user.id, { processing_status: "processing", processing_error: null }).catch(() => {});
      try {
        const result = await stylizePet({ userId: user.id, imageBase64: photo.base64, imageUrl: undefined, mimeType: photo.mimeType, style: "cute_max" });
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
        // stylizePet saves the original first; if that part failed too we have nothing to keep.
        const cache = getPetImageCache() as any;
        let keptPhoto = !!(cache && cache.userId === user.id && cache.original);
        if (!keptPhoto) {
          try {
            await saveOriginalPetPhoto({ userId: user.id, imageBase64: photo.base64, mimeType: photo.mimeType });
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
  }, [photo, refreshPet, step, user?.id]);

  useEffect(() => {
    if (step === "painting" && (painting.status === "done" || painting.status === "kept-photo")) {
      const id = setTimeout(() => {
        setStep("meet");
        setReaction("cheer");
      }, 900);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [painting.status, step]);

  const retryPainting = () => {
    paintingStarted.current = false;
    setElapsed(0);
    setPainting({ status: "idle" });
    setStep("painting");
  };

  // ---- first small thing --------------------------------------------------------------------------------
  useEffect(() => {
    if (step !== "firstStep" || !user?.id) return;
    let alive = true;
    setLoadingTasks(true);
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.warn("ONBOARDING_TASKS_LOAD_ERROR", error.message);
        setTasks(
          (data || []).slice(0, 4).map((row: any) => ({
            id: row.id,
            title: row.title,
            points: Number.isFinite(Number(row.points)) ? Number(row.points) : null,
            category: row.category ?? row.type ?? null,
            difficulty: row.difficulty ?? null,
          }))
        );
        setLoadingTasks(false);
      });
    return () => {
      alive = false;
    };
  }, [step, user?.id]);

  const completeFirstTask = async (task: SeedTask) => {
    if (completingId || doneTask) return;
    setCompletingId(String(task.id));
    try {
      const mutation = await completeTaskWithResilience({
        taskId: task.id,
        eventMeta: { category: task.category ?? null, difficulty: task.difficulty ?? null, points: task.points ?? null },
      });
      const points = mutation.state === "success" ? mutation.result.points_awarded : task.points ?? 0;
      setDoneTask({ id: String(task.id), line: celebrationLine(petName, points, task.title.length) });
      setReaction("love");
      playDing();
    } catch (error) {
      console.error("ONBOARDING_FIRST_TASK_ERROR", { message: (error as any)?.message });
      Alert.alert("Couldn't save that yet", "No problem, you can do it from Home in a moment.");
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
        const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
        if (error) console.warn("ONBOARDING_PROFILE_REFRESH_ERROR", error.message);
        const cache = getPetImageCache() as any;
        const fallbackUrl = cache && cache.userId === user.id ? cache.original : null;
        if (data) {
          setProfile?.(data.pet_photo_url || !fallbackUrl ? data : { ...data, pet_photo_url: fallbackUrl });
        } else if (fallbackUrl) {
          setProfile?.((prev: any) => ({ ...(prev || {}), user_id: user.id, pet_photo_url: fallbackUrl }));
        }
      }
      if (mode === "replace" && navigation?.canGoBack?.()) navigation.goBack();
    } finally {
      setFinishing(false);
    }
  };

  const previewSources: PetImageSources | null = photo ? { original: photo.uri, allowOriginal: true } : null;
  const canGoBack = previousStep(step, mode) !== null || (mode === "replace" && step === "photo");
  const showCamera = Platform.OS !== "web";

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          {canGoBack ? (
            <Pressable onPress={goBack} hitSlop={10} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
              <Feather name="arrow-left" size={20} color="#e2e8f0" />
            </Pressable>
          ) : (
            <View style={styles.backButton} />
          )}
          <StepDots steps={steps} current={step} />
          <View style={styles.backButton} />
        </View>

        {step === "welcome" ? (
          <View>
            <View style={styles.sceneCard}>
              <GardenStage height={sceneHeight} variant="welcome" hidePet accessibilityLabel="An empty garden with a patch of soil, waiting" />
            </View>
            <Text style={styles.title}>A garden that grows with you</Text>
            <Text style={styles.body}>
              Floura turns a photo of your pet into a little companion who lives here. Each small act of care for yourself,
              a glass of water, a walk, a check-in, helps their garden grow.
            </Text>
            <Pressable style={styles.primaryButton} onPress={goNext} accessibilityRole="button">
              <Text style={styles.primaryButtonText}>Let's meet them</Text>
            </Pressable>
          </View>
        ) : null}

        {step === "photo" ? (
          <View>
            <Text style={styles.title}>{mode === "replace" ? "A new photo" : "Show us your pet"}</Text>
            <Text style={styles.body}>
              One clear photo is all it takes. Good light and the whole body help the portrait come out best.
            </Text>
            <View style={styles.photoStage}>
              {photo ? (
                <View style={styles.photoFrame}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" accessibilityLabel="Your chosen photo" />
                </View>
              ) : (
                <View style={[styles.photoFrame, styles.photoEmpty]}>
                  <Feather name="camera" size={34} color="rgba(226,232,240,0.7)" />
                </View>
              )}
            </View>
            {photo ? (
              <View>
                <Pressable style={styles.primaryButton} onPress={goNext} accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>Use this photo</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => pick("library")} disabled={picking} accessibilityRole="button">
                  <Text style={styles.secondaryButtonText}>Choose another</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                {showCamera ? (
                  <Pressable style={styles.primaryButton} onPress={() => pick("camera")} disabled={picking} accessibilityRole="button">
                    {picking ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.primaryButtonText}>Take a photo</Text>}
                  </Pressable>
                ) : null}
                <Pressable
                  style={showCamera ? styles.secondaryButton : styles.primaryButton}
                  onPress={() => pick("library")}
                  disabled={picking}
                  accessibilityRole="button"
                >
                  {picking && !showCamera ? (
                    <ActivityIndicator color="#0f172a" />
                  ) : (
                    <Text style={showCamera ? styles.secondaryButtonText : styles.primaryButtonText}>Choose from photos</Text>
                  )}
                </Pressable>
              </View>
            )}
            <View style={styles.tips}>
              <Text style={styles.tip}>• Any pet works: dog, cat, rabbit, lizard, a very good plant.</Text>
              <Text style={styles.tip}>• The photo stays private to your account.</Text>
            </View>
          </View>
        ) : null}

        {step === "name" ? (
          <View>
            <View style={styles.photoStage}>
              <View style={styles.photoFrameSmall}>
                {photo ? <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" /> : null}
              </View>
            </View>
            <Text style={styles.title}>What's their name?</Text>
            <Text style={styles.body}>This is how they'll be called all through Floura.</Text>
            <TextInput
              value={nameDraft}
              onChangeText={(text) => {
                setNameDraft(text);
                if (nameError) setNameError("");
              }}
              placeholder="Their name"
              placeholderTextColor="rgba(148,163,184,0.8)"
              autoCapitalize="words"
              maxLength={PET_NAME_MAX}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={submitName}
              accessibilityLabel="Pet name"
            />
            {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
            <View style={styles.chips}>
              {NAME_SUGGESTIONS.map((suggestion) => (
                <Pressable key={suggestion} style={styles.chip} onPress={() => setNameDraft(suggestion)} accessibilityRole="button">
                  <Text style={styles.chipText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.primaryButton, savingName && styles.buttonDisabled]} onPress={submitName} disabled={savingName} accessibilityRole="button">
              {savingName ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.primaryButtonText}>That's the one</Text>}
            </Pressable>
          </View>
        ) : null}

        {step === "painting" ? (
          <View>
            <View style={styles.sceneCard}>
              <GardenStage
                height={sceneHeight}
                variant="welcome"
                petImageSources={previewSources}
                allowOriginal
                petMood="calm"
                accessibilityLabel={`${petName}'s photo waiting in the garden while the portrait is painted`}
              />
            </View>
            {painting.status === "failed" ? (
              <View>
                <Text style={styles.title}>That didn't work</Text>
                <Text style={styles.body}>{painting.message || "We couldn't save the photo."} Check your connection and try again.</Text>
                <Pressable style={styles.primaryButton} onPress={retryPainting} accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>Try again</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => setStep("photo")} accessibilityRole="button">
                  <Text style={styles.secondaryButtonText}>Choose a different photo</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={styles.title}>Painting {petName}…</Text>
                <Text style={styles.body}>{paintingLine(elapsed, petName)}</Text>
                <ActivityIndicator color="#35d07f" style={styles.spinner} />
                <Text style={styles.footnote}>This usually takes under a minute. You can keep the screen open or come back later.</Text>
              </View>
            )}
          </View>
        ) : null}

        {step === "meet" ? (
          <View>
            <View style={styles.sceneCard}>
              <GardenStage
                height={sceneHeight}
                variant="home"
                petImageSources={petSources}
                allowOriginal
                petMood="happy"
                petReaction={reaction}
                onPetReactionEnd={() => setReaction(null)}
                onPetPress={() => setReaction("love")}
                accessibilityLabel={`${petName} sitting in the garden`}
              />
            </View>
            <Text style={styles.title}>{petName} moved in</Text>
            <Text style={styles.body}>
              {painting.status === "kept-photo"
                ? `The painted portrait didn't finish, so ${petName}'s photo is here for now. You can retry from the Pet tab any time.`
                : `Tap ${petName} to say hello. They'll be here on Home, in the garden, and whenever you check in.`}
            </Text>
            <Pressable style={[styles.primaryButton, finishing && styles.buttonDisabled]} onPress={mode === "first" ? goNext : finish} disabled={finishing} accessibilityRole="button">
              {finishing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.primaryButtonText}>{mode === "first" ? "Continue" : "Done"}</Text>}
            </Pressable>
          </View>
        ) : null}

        {step === "firstStep" ? (
          <View>
            <Text style={styles.title}>One small thing for today</Text>
            <Text style={styles.body}>Pick something you can do in the next few minutes. {petName} will notice.</Text>
            {loadingTasks ? (
              <ActivityIndicator color="#35d07f" style={styles.spinner} />
            ) : tasks.length === 0 ? (
              <Text style={styles.footnote}>Your daily tasks will be waiting on Home.</Text>
            ) : (
              <View style={styles.taskList}>
                {tasks.map((task) => {
                  const done = doneTask?.id === String(task.id);
                  const busy = completingId === String(task.id);
                  return (
                    <Pressable
                      key={String(task.id)}
                      style={[styles.taskRow, done && styles.taskRowDone, (!!doneTask || !!completingId) && !done && styles.taskRowMuted]}
                      onPress={() => completeFirstTask(task)}
                      disabled={!!doneTask || !!completingId}
                      accessibilityRole="button"
                      accessibilityState={{ checked: done, disabled: !!doneTask || !!completingId }}
                    >
                      <View style={[styles.taskCheck, done && styles.taskCheckDone]}>
                        {busy ? <ActivityIndicator size="small" color="#35d07f" /> : done ? <Feather name="check" size={14} color="#0f172a" /> : null}
                      </View>
                      <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{task.title}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {doneTask ? <Text style={styles.celebration}>{doneTask.line}</Text> : null}
            <Pressable style={[styles.primaryButton, finishing && styles.buttonDisabled]} onPress={finish} disabled={finishing} accessibilityRole="button">
              {finishing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.primaryButtonText}>{doneTask ? "Into the garden" : "Start"}</Text>}
            </Pressable>
            {!doneTask ? (
              <Pressable style={styles.secondaryButton} onPress={finish} disabled={finishing} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>Maybe later</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={{ height: Math.max(24, width * 0.04) }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, minHeight: 40 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 4, marginHorizontal: 3, backgroundColor: "rgba(148,163,184,0.35)" },
  dotActive: { width: 18, backgroundColor: "#35d07f" },
  dotDone: { backgroundColor: "rgba(53,208,127,0.6)" },
  sceneCard: { borderRadius: 22, overflow: "hidden", marginBottom: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.2)" },
  title: { color: "#f8fafc", fontSize: 26, fontWeight: "800", textAlign: "center" },
  body: { marginTop: 10, color: "rgba(203,213,225,0.92)", fontSize: 15, lineHeight: 22, textAlign: "center" },
  footnote: { marginTop: 14, color: "rgba(148,163,184,0.85)", fontSize: 12, lineHeight: 17, textAlign: "center" },
  spinner: { marginTop: 18 },
  primaryButton: {
    marginTop: 22,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#35d07f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  primaryButtonText: { color: "#0f172a", fontSize: 16, fontWeight: "800" },
  secondaryButton: { marginTop: 10, minHeight: 46, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "rgba(203,213,225,0.95)", fontSize: 14, fontWeight: "700" },
  buttonDisabled: { opacity: 0.7 },
  photoStage: { alignItems: "center", marginTop: 20, marginBottom: 6 },
  photoFrame: {
    width: 196,
    height: 196,
    borderRadius: 98,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  photoFrameSmall: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(15,23,42,0.6)",
    marginBottom: 12,
  },
  photoEmpty: { alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderColor: "rgba(148,163,184,0.6)" },
  photoImage: { width: "100%", height: "100%" },
  tips: { marginTop: 22 },
  tip: { color: "rgba(148,163,184,0.9)", fontSize: 13, lineHeight: 20 },
  input: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
    backgroundColor: "rgba(15,23,42,0.6)",
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 14,
  },
  error: { marginTop: 8, color: "#fca5a5", fontSize: 13, textAlign: "center", fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(18,24,38,0.95)",
    margin: 4,
  },
  chipText: { color: "#e2e8f0", fontSize: 13, fontWeight: "600" },
  taskList: { marginTop: 18 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(18,24,38,0.95)",
    marginBottom: 10,
  },
  taskRowDone: { borderColor: "#35d07f" },
  taskRowMuted: { opacity: 0.55 },
  taskCheck: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(53,208,127,0.6)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  taskCheckDone: { backgroundColor: "#35d07f", borderColor: "#35d07f" },
  taskTitle: { flex: 1, color: "#e2e8f0", fontSize: 15, fontWeight: "600" },
  taskTitleDone: { color: "rgba(226,232,240,0.75)" },
  celebration: { marginTop: 8, color: "#fde68a", fontSize: 14, fontWeight: "700", textAlign: "center" },
});
