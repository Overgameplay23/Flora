// Journal: a few private lines, started by the pet's daily question if the person wants a start.
// Kept on the device and mirrored to the account when the table exists. No AI reads it.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import PetPortrait from "../components/pet/PetPortrait";
import { confirmAsync } from "../utils/confirm";
import { deleteJournalEntry, loadJournal, subscribeJournal, writeJournalEntry } from "../services/journalStore";
import { JOURNAL_MAX, groupByDay, journalIntro, journalPrivacyLine, type JournalEntry } from "../domain/journal";
import { reflectionPrompt } from "../domain/reflection";
import { memorialPrompt } from "../domain/memorial";
import { getLocalDateKey } from "../utils/dateKeys";

export default function JournalScreen() {
  const { user } = useAuth();
  const { sources, look, displayName, memorial } = usePet();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [usePrompt, setUsePrompt] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kept, setKept] = useState(false);
  const [today, setToday] = useState(getLocalDateKey());

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
    try {
      const next = await writeJournalEntry(user.id, draft, usePrompt ? prompt : null);
      setEntries(next);
      setDraft("");
      setKept(true);
      setTimeout(() => setKept(false), 2200);
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Pressable
        style={[styles.promptCard, !usePrompt && styles.promptCardOff]}
        onPress={() => setUsePrompt((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={usePrompt ? "Write freely instead" : "Use today's question"}
      >
        <PetPortrait sources={sources} look={look} size={64} mood="calm" resting={!!memorial} allowOriginal emptyLabel="Pet" style={styles.promptPet} />
        <View style={styles.promptBody}>
          <Text style={styles.promptIntro}>{journalIntro(displayName)}</Text>
          <Text style={[styles.promptText, !usePrompt && styles.promptTextOff]}>{prompt}</Text>
          <Text style={styles.promptToggle}>{usePrompt ? "Tap to write freely instead" : "Tap to use today's question"}</Text>
        </View>
      </Pressable>

      <View style={styles.editor}>
        <TextInput
          style={styles.input}
          multiline
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, JOURNAL_MAX))}
          placeholder={usePrompt ? "A few lines is plenty." : "Whatever's on your mind."}
          placeholderTextColor="rgba(148,163,184,0.7)"
          accessibilityLabel="Journal entry"
          textAlignVertical="top"
        />
        <View style={styles.editorFooter}>
          <Text style={styles.privacy}>{journalPrivacyLine(displayName)}</Text>
          <Pressable style={[styles.keepButton, !canKeep && styles.keepButtonOff]} onPress={keep} disabled={!canKeep} accessibilityRole="button" accessibilityLabel="Keep this">
            {saving ? <ActivityIndicator color="#0f172a" /> : <Feather name={kept ? "check" : "bookmark"} size={16} color="#0f172a" />}
            <Text style={styles.keepText}>{kept ? "Kept" : "Keep this"}</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#35d07f" style={styles.loading} />
      ) : days.length === 0 ? (
        <Text style={styles.empty}>Nothing here yet. Start with today's question, or write whatever's on your mind.</Text>
      ) : (
        days.map((day) => (
          <View key={day.date} style={styles.day}>
            <Text style={styles.dayLabel}>{day.label}</Text>
            {day.entries.map((entry) => (
              <Pressable key={entry.id} style={styles.entry} onLongPress={() => remove(entry)} delayLongPress={450} accessibilityLabel={`Entry: ${entry.text.slice(0, 60)}`} accessibilityHint="Long press to remove">
                {entry.prompt ? <Text style={styles.entryPrompt}>{entry.prompt}</Text> : null}
                <Text style={styles.entryText}>{entry.text}</Text>
              </Pressable>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  content: { padding: 16, paddingBottom: 48 },
  promptCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(53,208,127,0.10)",
    borderWidth: 1,
    borderColor: "rgba(53,208,127,0.28)",
  },
  promptCardOff: { backgroundColor: "rgba(18,24,38,0.95)", borderColor: "rgba(148,163,184,0.22)" },
  promptPet: { marginRight: 12 },
  promptBody: { flex: 1 },
  promptIntro: { color: "#86efac", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  promptText: { marginTop: 4, color: "#f8fafc", fontSize: 17, fontWeight: "700", lineHeight: 23 },
  promptTextOff: { color: "rgba(148,163,184,0.7)", textDecorationLine: "line-through", fontWeight: "600" },
  promptToggle: { marginTop: 6, color: "rgba(148,163,184,0.85)", fontSize: 12 },
  editor: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    padding: 14,
  },
  input: { minHeight: 140, color: "#f8fafc", fontSize: 16, lineHeight: 23, padding: 0 },
  editorFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 12 },
  privacy: { flex: 1, color: "rgba(148,163,184,0.75)", fontSize: 12, lineHeight: 16 },
  keepButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#35d07f", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  keepButtonOff: { opacity: 0.45 },
  keepText: { color: "#0f172a", fontWeight: "800", fontSize: 14 },
  loading: { marginTop: 24 },
  empty: { marginTop: 28, color: "rgba(148,163,184,0.85)", fontSize: 14, lineHeight: 20, textAlign: "center", paddingHorizontal: 12 },
  day: { marginTop: 22 },
  dayLabel: { color: "rgba(148,163,184,0.9)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  entry: {
    borderRadius: 16,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    padding: 14,
    marginBottom: 8,
  },
  entryPrompt: { color: "#86efac", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  entryText: { color: "#e2e8f0", fontSize: 15, lineHeight: 22 },
});
