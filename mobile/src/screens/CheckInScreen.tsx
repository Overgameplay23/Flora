import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { notify } from "../utils/confirm";
import Slider from "@react-native-community/slider";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import PetPortrait, { type PetMood } from "../components/pet/PetPortrait";
import BreathingModal from "../components/checkin/BreathingModal";
import {
  applyGentleStreakUpdate,
  fetchHabitsWithCompletions,
  fetchTodayCheckIn,
  isDayComplete,
  saveCheckIn,
  syncStatsAndUnlocks,
  todayKey,
} from "../services/dailyLoop";
import { logCheckinSubmitted } from "../services/retention";
import { derivePetState } from "../utils/petState";
import { isProtectedMood } from "../domain/protectedMode";
import { ENERGY_WORDS, reflectionIntro, reflectionPrompt } from "../domain/reflection";
import { memorialPrompt } from "../domain/memorial";

type CheckinCopyOptions = {
  isProtectedMode: boolean;
  hasExistingCheckin: boolean;
};

function getCheckinCopy({ isProtectedMode, hasExistingCheckin }: CheckinCopyOptions) {
  if (isProtectedMode) {
    return {
      title: "Daily check-in",
      subtitle: "No pressure. Keep it simple today.",
      promptLabel: "Something that helped (optional)",
      promptPlaceholder: "A small thing that helped...",
      submitLabel: "That's enough for today",
      breathingLabel: "1-minute breathing",
    };
  }

  return {
    title: "Daily check-in",
    subtitle: "How are you feeling today?",
    promptLabel: "A line for today (optional)",
    promptPlaceholder: "A sentence is plenty.",
    submitLabel: hasExistingCheckin ? "Update today" : "Save check-in",
    breathingLabel: "",
  };
}


/** What the pet "says" for each mood; it mirrors the person without judging the number. */
export function petMoodLine(mood: number, petName: string) {
  const name = petName || "Your pet";
  switch (Math.max(1, Math.min(5, Math.round(mood)))) {
    case 1:
      return `${name} is staying close. You don't have to do anything else.`;
    case 2:
      return `${name} curls up next to you. Slow days count too.`;
    case 3:
      return `${name} is settled. Let's keep it simple.`;
    case 4:
      return `${name} is wagging. Nice to see you doing well.`;
    default:
      return `${name} is bouncing around. What a day!`;
  }
}

export function petMoodForScore(mood: number): PetMood {
  const state = derivePetState(mood);
  if (state === "sad") return "sad";
  if (state === "calm") return "calm";
  if (state === "happy") return "happy";
  return "excited";
}

export default function CheckInScreen() {
  const { user, profile, setProfile, setUserStats, setPetEmotionState } = useAuth();
  const { sources: petSources, look: petLook, name: petName, memorial } = usePet();
  const nav = useNavigation();
  const [mood, setMood] = useState<number>(3);
  const [win, setWin] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [checkinId, setCheckinId] = useState<number | null>(null);
  const [breathingOpen, setBreathingOpen] = useState(false);
  // Refreshed on focus instead of frozen at mount, so a screen left open past midnight saves to the right day (R-33).
  const [dateKey, setDateKey] = useState(() => todayKey());
  useFocusEffect(
    useCallback(() => {
      setDateKey(todayKey());
    }, [])
  );

  const livePetState = useMemo(() => derivePetState(mood), [mood]);
  const petMood = useMemo(() => petMoodForScore(mood), [mood]);
  const isProtectedMode = isProtectedMood(mood);
  const checkinCopy = useMemo(
    () => getCheckinCopy({ isProtectedMode, hasExistingCheckin: Boolean(checkinId) }),
    [isProtectedMode, checkinId],
  );
  const prevPetStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isProtectedMode && breathingOpen) setBreathingOpen(false);
  }, [isProtectedMode, breathingOpen]);

  useEffect(() => {
    const loadCheckIn = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const row = await fetchTodayCheckIn(user.id, dateKey);
        if (row) {
          setMood(row.mood_score ?? 3);
          setWin(row.win_text ?? "");
          setCheckinId(row.id ?? null);
          setStatus("You already checked in today. You can edit it once today.");
        } else {
          setCheckinId(null);
          setStatus("");
        }
      } catch (error) {
        console.error("CHECKIN_LOAD_ERROR", error);
        setErrorMessage("We couldn't load today's check-in. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadCheckIn();
  }, [user?.id, dateKey]);

  useEffect(() => {
    if (prevPetStateRef.current === livePetState) return;
    prevPetStateRef.current = livePetState;
    setPetEmotionState?.(livePetState);
  }, [livePetState, setPetEmotionState]);

  async function handleSubmit() {
    if (!user?.id || saving) return;
    setStatus("");
    setErrorMessage("");
    try {
      setSaving(true);
      const saved = await saveCheckIn(user.id, mood, win, dateKey);
      try {
        await logCheckinSubmitted({
          occurredAt: new Date().toISOString(),
          mood: saved.mood_score ?? mood,
          winText: saved.win_text ?? win,
        });
      } catch (retentionError: any) {
        console.warn("RETENTION_CHECKIN_LOG_FAILED", retentionError?.message || String(retentionError));
      }
      setCheckinId(saved?.id ?? null);
      setStatus("Saved for today.");
      const gentleStreak = await applyGentleStreakUpdate(user.id, dateKey);
      setProfile?.((prev: any) => ({
        ...(prev || profile || {}),
        user_id: user.id,
        current_streak: gentleStreak.current_streak,
        best_streak: gentleStreak.best_streak,
        streak_count: gentleStreak.current_streak,
        last_checkin_date: gentleStreak.last_checkin_date,
      }));
      const mirroredState = derivePetState(saved.mood_score ?? mood);
      setPetEmotionState?.(mirroredState);

      const habits = await fetchHabitsWithCompletions(user.id, dateKey);
      const completed = habits.filter((h) => h.completed).length;
      const completionRate = habits.length === 0 ? 0 : completed / habits.length;
      const hasCompletedDay = isDayComplete(saved, habits);
      const stats = await syncStatsAndUnlocks({
        userId: user.id,
        dateKey,
        hasCompletedDay,
        moodScore: saved.mood_score,
        habitCompletionRate: completionRate,
      });
      setUserStats?.(stats);
      const name = petName || "Your pet";
      notify(
        "Saved",
        hasCompletedDay ? `Day complete. ${name} is happier for it.` : `Check-in saved. ${name} is glad you stopped by.`
      );
      nav.goBack();
    } catch (error: any) {
      console.error("CHECKIN_SAVE_ERROR", error);
      setErrorMessage("Failed to save. Please try again.");
      notify("Error", "Failed to save your check-in. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{checkinCopy.title}</Text>
      <Text style={styles.subtitle}>{checkinCopy.subtitle}</Text>

      <View style={styles.petPreview}>
        <PetPortrait sources={petSources} look={petLook} size={132} mood={petMood} allowOriginal resting={!!memorial} />
        <View style={styles.speechBubble}>
          <Text style={styles.speechText}>{memorial ? "No pressure today. How are you, really?" : petMoodLine(mood, petName)}</Text>
        </View>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={5}
        step={1}
        value={mood}
        minimumTrackTintColor="#34d399"
        maximumTrackTintColor="rgba(148,163,184,0.5)"
        thumbTintColor="#10b981"
        onValueChange={(value) => setMood(Math.round(value))}
        accessibilityLabel="Mood"
      />
      <Text style={styles.moodLabel}>
        {ENERGY_WORDS[Math.max(1, Math.min(5, mood))]} <Text style={styles.moodScore}>{mood}/5</Text>
      </Text>

      {!isProtectedMode ? (
        <View style={styles.promptCard}>
          <Text style={styles.promptIntro}>{reflectionIntro(petName)}</Text>
          <Text style={styles.promptText}>{memorial ? memorialPrompt(petName) : reflectionPrompt(dateKey, petName)}</Text>
        </View>
      ) : null}
      <Text style={styles.fieldLabel}>{checkinCopy.promptLabel}</Text>
      <TextInput
        style={styles.input}
        placeholder={checkinCopy.promptPlaceholder}
        placeholderTextColor="rgba(148,163,184,0.7)"
        value={win}
        onChangeText={setWin}
        multiline
      />

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={saving}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{saving ? "Saving..." : checkinCopy.submitLabel}</Text>
      </Pressable>

      {isProtectedMode ? (
        <Pressable style={styles.breathingButton} onPress={() => setBreathingOpen(true)} accessibilityRole="button">
          <Text style={styles.breathingButtonText}>{checkinCopy.breathingLabel}</Text>
        </Pressable>
      ) : null}

      <BreathingModal visible={breathingOpen} onClose={() => setBreathingOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f172a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" },
  container: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "700", color: "#e2e8f0", textAlign: "center" },
  subtitle: { marginTop: 6, fontSize: 13, color: "rgba(148,163,184,0.9)", textAlign: "center" },
  petPreview: { alignItems: "center", marginTop: 16 },
  speechBubble: {
    marginTop: 10,
    maxWidth: 320,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
  },
  speechText: { color: "#e2e8f0", fontSize: 13, textAlign: "center", lineHeight: 18 },
  slider: { width: "100%", height: 40, marginTop: 16, marginBottom: 6 },
  moodLabel: { fontSize: 16, color: "#e2e8f0", textAlign: "center", marginBottom: 14, fontWeight: "700" },
  moodScore: { color: "rgba(148,163,184,0.9)", fontWeight: "600" },
  promptCard: {
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(53,208,127,0.08)",
    borderWidth: 1,
    borderColor: "rgba(53,208,127,0.3)",
  },
  promptIntro: { color: "#a7f3d0", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  promptText: { marginTop: 4, color: "#f8fafc", fontSize: 15, fontWeight: "600", lineHeight: 21 },
  fieldLabel: { color: "#cbd5e1", fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    marginBottom: 14,
    color: "#e2e8f0",
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  status: { color: "#a7f3d0", fontSize: 12, marginBottom: 8 },
  error: { color: "#fecdd3", fontSize: 12, marginBottom: 8 },
  button: {
    backgroundColor: "#34d399",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginHorizontal: 24,
    marginTop: 6,
    minHeight: 48,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0f172a", fontWeight: "700", fontSize: 16 },
  breathingButton: {
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.6)",
    backgroundColor: "rgba(16,185,129,0.15)",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginHorizontal: 24,
    marginTop: 10,
  },
  breathingButtonText: { color: "#a7f3d0", fontWeight: "700", fontSize: 15 },
});
