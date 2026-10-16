import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { notify } from "../utils/confirm";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import type { PetMood, PetReaction } from "../components/pet/PetPortrait";
import PetMascot from "../components/pet/PetMascot";
import SpeechBubble from "../components/pet/SpeechBubble";
import { PetLoading, useHasPet } from "../components/pet/PetMoments";
import BreathingModal from "../components/checkin/BreathingModal";
import CareToast from "../components/home/CareToast";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import TextField from "../components/common/TextField";
import PressableScale from "../components/common/PressableScale";
import { Eyebrow } from "../components/common/Headings";
import { useTheme } from "../theme/theme";
import { fonts, radius, type } from "../theme/tokens";
import { selection, success, tapSoft, warning } from "../utils/haptics";
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

/**
 * The five steps of the check-in, low to high. Same 1-5 scores as before (ENERGY_WORDS); each step carries
 * a care category so the picker reads like the battery check on Home (rest → calm → focus → energy → play).
 */
const MOOD_STEPS: Array<{ score: number; icon: string; category: string }> = [
  { score: 1, icon: "battery-dead-outline", category: "rest" },
  { score: 2, icon: "cloudy-outline", category: "calm" },
  { score: 3, icon: "leaf-outline", category: "focus" },
  { score: 4, icon: "partly-sunny-outline", category: "energy" },
  { score: 5, icon: "sunny-outline", category: "play" },
];

/** How long the pet's "saved" moment stays on screen before going back. */
const SAVED_MOMENT_MS = 1600;

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

type MoodPickerProps = {
  value: number;
  onChange: (score: number) => void;
};

/** Five tappable tiles (no faces, no slider): an icon and a word per step, coloured by its care category. */
function MoodPicker({ value, onChange }: MoodPickerProps) {
  const theme = useTheme();
  const { surface } = theme;
  return (
    <View style={styles.pickerRow} accessibilityRole="radiogroup" accessibilityLabel="Mood">
      {MOOD_STEPS.map((step) => {
        const tone = theme.tone(step.category);
        const selected = step.score === value;
        const word = ENERGY_WORDS[step.score];
        return (
          <PressableScale
            key={step.score}
            pressedScale={0.94}
            onPress={() => {
              if (step.score === value) return;
              selection();
              onChange(step.score);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${word}, ${step.score} of 5`}
            containerStyle={styles.pickerSlot}
            style={[
              styles.pickerTile,
              {
                backgroundColor: selected ? tone.fill : surface.sunken,
                borderColor: selected ? tone.accent : "transparent",
              },
            ]}
          >
            <View style={[styles.pickerIcon, { backgroundColor: selected ? tone.tileOnFill : "transparent" }]}>
              <Ionicons name={step.icon as any} size={22} color={tone.accent} />
            </View>
            <Text
              style={[styles.pickerLabel, { color: selected ? tone.accent : surface.textSecondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {word}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export default function CheckInScreen() {
  const { user, profile, setProfile, setUserStats, setPetEmotionState } = useAuth();
  const { sources: petSources, look: petLook, name: petName, memorial } = usePet();
  const hasPet = useHasPet();
  const theme = useTheme();
  const { surface } = theme;
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const [mood, setMood] = useState<number>(3);
  const [win, setWin] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [checkinId, setCheckinId] = useState<number | null>(null);
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [savedLine, setSavedLine] = useState<string | null>(null);
  const [petReaction, setPetReaction] = useState<PetReaction | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refreshed on focus instead of frozen at mount, so a screen left open past midnight saves to the right day (R-33).
  const [dateKey, setDateKey] = useState(() => todayKey());
  useFocusEffect(
    useCallback(() => {
      setDateKey(todayKey());
    }, [])
  );

  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    []
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

  const changeMood = (score: number) => {
    setSavedLine(null);
    setMood(score);
  };

  async function handleSubmit() {
    if (!user?.id || saving || leaving) return;
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
      const line = hasCompletedDay ? `Day complete. ${name} is happier for it.` : `Check-in saved. ${name} is glad you stopped by.`;
      // The pet answers in place of a system alert: its bubble, a little reaction and the floating toast
      // (seen wherever the page is scrolled), then back to where the person came from.
      if (hasCompletedDay) success();
      else tapSoft();
      setSavedLine(line);
      if (!memorial) {
        setPetReaction(hasCompletedDay ? "love" : "cheer");
        setToast({ id: Date.now(), text: line });
      }
      setLeaving(true);
      leaveTimer.current = setTimeout(() => nav.goBack(), SAVED_MOMENT_MS);
    } catch (error: any) {
      console.error("CHECKIN_SAVE_ERROR", error);
      warning();
      setErrorMessage("Failed to save. Please try again.");
      notify("Error", "Failed to save your check-in. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen scroll={false} centered>
        <PetLoading />
      </Screen>
    );
  }

  const petLine = savedLine ?? (memorial ? "No pressure today. How are you, really?" : petMoodLine(mood, petName));
  const moodWord = ENERGY_WORDS[Math.max(1, Math.min(5, mood))];
  const checkinTone = theme.tone("energy");

  return (
    <View style={styles.fill}>
      <Screen keyboard bottomPad={56}>
        {/* checkinCopy.title ("Daily check-in") is the native header's title, so the page leads with the question */}
        <Text style={[type.title, styles.question, { color: surface.text }]} accessibilityRole="header">
          {checkinCopy.subtitle}
        </Text>

        <View style={styles.petStage}>
          {hasPet ? (
            <PetMascot
              size={132}
              mood={petMood}
              say={petLine}
              reaction={petReaction}
              onReactionEnd={() => setPetReaction(null)}
              night={theme.night}
            />
          ) : (
            <SpeechBubble text={petLine} tail="none" night={theme.night} maxWidth={320} style={styles.loneBubble} />
          )}
        </View>

        <Card style={styles.pickerCard}>
          <MoodPicker value={mood} onChange={changeMood} />
          <Text style={[type.callout, styles.moodLabel, { color: surface.text }]}>
            <Text style={{ fontFamily: fonts.bodyHeavy }}>{moodWord}</Text>
            <Text style={{ color: surface.textSecondary }}>{`  ${mood}/5`}</Text>
          </Text>
        </Card>

        {!isProtectedMode ? (
          <Card tone="energy" style={styles.promptCard}>
            <Eyebrow color={checkinTone.accent}>{reflectionIntro(petName)}</Eyebrow>
            <Text style={[type.h3, styles.promptText, { color: surface.text }]}>
              {memorial ? memorialPrompt(petName) : reflectionPrompt(dateKey, petName)}
            </Text>
          </Card>
        ) : null}

        <TextField
          label={checkinCopy.promptLabel}
          placeholder={checkinCopy.promptPlaceholder}
          value={win}
          onChangeText={setWin}
          multiline
          accessibilityLabel={checkinCopy.promptLabel}
          containerStyle={styles.field}
        />

        {status ? <Text style={[type.meta, styles.message, { color: surface.textSecondary }]}>{status}</Text> : null}
        {errorMessage ? <Text style={[type.meta, styles.message, { color: theme.alert }]}>{errorMessage}</Text> : null}

        <Button
          label={checkinCopy.submitLabel}
          onPress={handleSubmit}
          loading={saving}
          disabled={leaving}
          containerStyle={styles.submit}
        />

        {isProtectedMode ? (
          <Button
            label={checkinCopy.breathingLabel}
            icon="cloud-outline"
            variant="secondary"
            onPress={() => setBreathingOpen(true)}
            containerStyle={styles.breathing}
          />
        ) : null}

        <BreathingModal visible={breathingOpen} onClose={() => setBreathingOpen(false)} />
      </Screen>
      <CareToast toast={toast} bottom={insets.bottom + 16} petSources={petSources} petLook={petLook} night={theme.night} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  question: { marginTop: 4, textAlign: "center" },
  petStage: { alignItems: "center", marginTop: 14, marginBottom: 16, minHeight: 40 },
  loneBubble: { alignSelf: "center" },
  pickerCard: { marginBottom: 12 },
  pickerRow: { flexDirection: "row", gap: 4 },
  pickerSlot: { flex: 1 },
  pickerTile: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 9,
    paddingHorizontal: 0,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    borderWidth: 2,
  },
  pickerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerLabel: { marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 15, letterSpacing: -0.2 },
  moodLabel: { marginTop: 12, textAlign: "center" },
  promptCard: { marginBottom: 14 },
  promptText: { marginTop: 4 },
  field: { marginBottom: 12 },
  message: { marginBottom: 10, marginLeft: 4 },
  submit: { marginTop: 4 },
  breathing: { marginTop: 10 },
});
