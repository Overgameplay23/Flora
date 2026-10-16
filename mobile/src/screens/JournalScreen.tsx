// Journal: a few private lines, started by the pet's daily question if the person wants a start.
// Kept on the device and mirrored to the account when the table exists. No AI reads it.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import type { PetReaction } from "../components/pet/PetPortrait";
import PetMascot from "../components/pet/PetMascot";
import { PetLoading, useHasPet } from "../components/pet/PetMoments";
import CareToast from "../components/home/CareToast";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import TextField from "../components/common/TextField";
import IconTile from "../components/common/IconTile";
import { Eyebrow } from "../components/common/Headings";
import { useTheme } from "../theme/theme";
import { type } from "../theme/tokens";
import { tapSoft, warning } from "../utils/haptics";
import { confirmAsync } from "../utils/confirm";
import { deleteJournalEntry, loadJournal, subscribeJournal, writeJournalEntry } from "../services/journalStore";
import { JOURNAL_MAX, groupByDay, journalIntro, journalPrivacyLine, type JournalEntry } from "../domain/journal";
import { reflectionPrompt } from "../domain/reflection";
import { memorialPrompt } from "../domain/memorial";
import { getLocalDateKey } from "../utils/dateKeys";

/** The journal's colour, as on its row in Profile. */
const JOURNAL_CATEGORY = "focus";

export default function JournalScreen() {
  const { user } = useAuth();
  const { sources, look, displayName, memorial } = usePet();
  const hasPet = useHasPet();
  const theme = useTheme();
  const { surface } = theme;
  const tone = theme.tone(JOURNAL_CATEGORY);
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [usePrompt, setUsePrompt] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kept, setKept] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [today, setToday] = useState(getLocalDateKey());
  const [petReaction, setPetReaction] = useState<PetReaction | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const keptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (keptTimer.current) clearTimeout(keptTimer.current);
    },
    []
  );

  const prompt = useMemo(() => (memorial ? memorialPrompt(displayName) : reflectionPrompt(today, displayName)), [displayName, memorial, today]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const next = await loadJournal(user.id);
    setEntries(next);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setToday(getLocalDateKey());
      load();
    }, [load])
  );

  useEffect(() => subscribeJournal(() => load()), [load]);

  const keep = async () => {
    if (!user?.id || saving || !draft.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      const next = await writeJournalEntry(user.id, draft, usePrompt ? prompt : null);
      setEntries(next);
      setDraft("");
      setKept(true);
      // the pet notices, without reading: a soft tap, a little reaction, a line in the toast
      tapSoft();
      if (!memorial) {
        setPetReaction("love");
        setToast({ id: Date.now(), text: `Kept. ${displayName} is glad you wrote that down.` });
      }
      if (keptTimer.current) clearTimeout(keptTimer.current);
      keptTimer.current = setTimeout(() => setKept(false), 2200);
    } catch (error: any) {
      console.error("JOURNAL_SAVE_ERROR", error?.message || String(error));
      warning();
      setSaveError("Couldn't keep that just now. Your words are still here, so try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: JournalEntry) => {
    if (!user?.id) return;
    const ok = await confirmAsync({ title: "Remove this entry?", message: "It goes for good.", confirmText: "Remove", destructive: true });
    if (!ok) return;
    setEntries(await deleteJournalEntry(user.id, entry.id));
  };

  const days = useMemo(() => groupByDay(entries, today), [entries, today]);
  const canKeep = draft.trim().length > 0 && !saving;

  return (
    <View style={styles.fill}>
      <Screen keyboard bottomPad={56}>
        <Card
          tone={JOURNAL_CATEGORY}
          onPress={() => setUsePrompt((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={usePrompt ? "Write freely instead" : "Use today's question"}
          style={styles.promptCard}
        >
          {hasPet ? (
            <PetMascot
              size={68}
              mood="calm"
              reaction={petReaction}
              onReactionEnd={() => setPetReaction(null)}
              showShadow={false}
              style={styles.promptPet}
            />
          ) : (
            <IconTile icon="create-outline" category={JOURNAL_CATEGORY} on="fill" size={52} style={styles.promptPet} />
          )}
          <View style={styles.promptBody}>
            <Eyebrow color={tone.accent}>{journalIntro(displayName)}</Eyebrow>
            <Text
              style={[
                type.h2,
                styles.promptText,
                { color: usePrompt ? surface.text : surface.textTertiary },
                !usePrompt && styles.promptTextOff,
              ]}
            >
              {prompt}
            </Text>
            <Text style={[type.meta, styles.promptToggle, { color: surface.textSecondary }]}>
              {usePrompt ? "Tap to write freely instead" : "Tap to use today's question"}
            </Text>
          </View>
        </Card>

        <Card style={styles.editor}>
          <TextField
            multiline
            value={draft}
            onChangeText={(t) => {
              setDraft(t.slice(0, JOURNAL_MAX));
              if (saveError) setSaveError("");
            }}
            placeholder={usePrompt ? "A few lines is plenty." : "Whatever's on your mind."}
            accessibilityLabel="Journal entry"
            error={!!saveError}
            note={saveError || null}
            style={styles.input}
          />
          <View style={styles.editorFooter}>
            <Text style={[type.meta, styles.privacy, { color: surface.textTertiary }]}>{journalPrivacyLine(displayName)}</Text>
            <Button
              label={kept ? "Kept" : "Keep this"}
              icon={kept ? "checkmark" : "bookmark-outline"}
              size="sm"
              onPress={keep}
              loading={saving}
              disabled={!canKeep && !kept}
              accessibilityLabel="Keep this"
            />
          </View>
        </Card>

        {loading ? (
          <PetLoading size={64} style={styles.loading} />
        ) : days.length === 0 ? (
          // the pet is already on this page, asking the question above, so the empty state stays a quiet note
          <Card variant="sunken" style={styles.empty}>
            <Text style={[type.h3, { color: surface.text }]}>Nothing here yet</Text>
            <Text style={[type.callout, styles.emptyBody, { color: surface.textSecondary }]}>
              Start with today's question, or write whatever's on your mind.
            </Text>
          </Card>
        ) : (
          days.map((day) => (
            <View key={day.date} style={styles.day}>
              <Eyebrow style={styles.dayLabel}>{day.label}</Eyebrow>
              {day.entries.map((entry) => (
                <Card
                  key={entry.id}
                  onLongPress={() => remove(entry)}
                  accessibilityLabel={`Entry: ${entry.text.slice(0, 60)}`}
                  accessibilityHint="Long press to remove"
                  style={styles.entry}
                >
                  {entry.prompt ? <Text style={[type.meta, styles.entryPrompt, { color: tone.accent }]}>{entry.prompt}</Text> : null}
                  <Text style={[type.body, { color: surface.text }]}>{entry.text}</Text>
                </Card>
              ))}
            </View>
          ))
        )}
      </Screen>
      <CareToast toast={toast} bottom={insets.bottom + 16} petSources={sources} petLook={look} night={theme.night} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  promptCard: { flexDirection: "row", alignItems: "center" },
  promptPet: { marginRight: 14 },
  promptBody: { flex: 1 },
  promptText: { marginTop: 4 },
  promptTextOff: { textDecorationLine: "line-through" },
  promptToggle: { marginTop: 8 },
  editor: { marginTop: 12 },
  input: { minHeight: 150 },
  editorFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 12 },
  privacy: { flex: 1 },
  loading: { marginTop: 12 },
  empty: { marginTop: 24, alignItems: "center", paddingVertical: 20 },
  emptyBody: { marginTop: 4, textAlign: "center" },
  day: { marginTop: 24 },
  dayLabel: { marginBottom: 8, marginLeft: 4 },
  entry: { marginBottom: 10 },
  entryPrompt: { marginBottom: 6 },
});
