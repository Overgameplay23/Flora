// Talking with the pet. The server function holds the voice and its guardrails; this screen holds
// the conversation for the session only (nothing is stored), opens with the pet's own line, and
// steps out of the way for crisis language.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import { useCycle } from "../hooks/useCycle";
import PetPortrait from "../components/pet/PetPortrait";
import { isAdopted } from "../domain/shelter";
import { TALK_DISCLAIMER, TalkContext, TalkMessage, crisisReply, needsCrisisReply, openingLine } from "../domain/petTalk";
import { PetTalkError, sendPetTalk } from "../services/petTalk";
import { buildWeekStory } from "../domain/week";
import { fetchWeeklyCheckins } from "../services/dailyLoop";
import { fetchLast7DaysMetrics } from "../services/retention";
import { getLocalDateKey } from "../utils/dateKeys";

type Bubble = TalkMessage & { id: string; pending?: boolean };

export default function PetTalkScreen() {
  const { user, profile } = useAuth();
  const { sources, look, displayName, species, memorial } = usePet();
  const cycle = useCycle();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [week, setWeek] = useState<TalkContext["week"]>(null);
  const scrollRef = useRef<ScrollView>(null);

  const context = useMemo<TalkContext>(
    () => ({
      petName: displayName,
      species,
      adopted: isAdopted(look),
      memorial: !!memorial,
      hour: new Date().getHours(),
      week,
      checkedInToday: profile?.last_checkin_date === getLocalDateKey(),
      cycleAware: !!cycle.enabled,
    }),
    [cycle.enabled, displayName, look, memorial, profile?.last_checkin_date, species, week]
  );

  useEffect(() => {
    setBubbles([{ id: "open", role: "assistant", content: openingLine(context) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, memorial]);

  useEffect(() => {
    let alive = true;
    if (!user?.id) return undefined;
    const endDateKey = getLocalDateKey();
    Promise.all([fetchWeeklyCheckins(user.id, endDateKey).catch(() => []), fetchLast7DaysMetrics().catch(() => [])])
      .then(([checkins, metrics]) => {
        if (!alive) return;
        const story = buildWeekStory({ endDateKey, checkins, metrics, petName: displayName, memorial: !!memorial });
        setWeek({ headline: story.headline, noticed: story.noticed, energyWord: story.energyWord, activeDays: story.activeDays, kept: story.kept });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [displayName, memorial, user?.id]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setError("");
    const mine: Bubble = { id: `u-${Date.now()}`, role: "user", content: text };
    const history = [...bubbles, mine];
    setBubbles(history);

    if (needsCrisisReply(text)) {
      setBubbles([...history, { id: `a-${Date.now()}`, role: "assistant", content: crisisReply(displayName) }]);
      return;
    }

    setSending(true);
    setBubbles([...history, { id: "pending", role: "assistant", content: "…", pending: true }]);
    try {
      const result = await sendPetTalk(
        history.map(({ role, content }) => ({ role, content })),
        context
      );
      setBubbles([...history, { id: `a-${Date.now()}`, role: "assistant", content: result.reply }]);
    } catch (e: any) {
      const message = e instanceof PetTalkError ? e.message : "Couldn't reach the pet's voice. Try again in a moment.";
      setError(message);
      setBubbles(history);
    } finally {
      setSending(false);
    }
  }, [bubbles, context, displayName, draft, sending]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [bubbles.length]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <PetPortrait sources={sources} look={look} size={72} mood="calm" resting={!!memorial} allowOriginal emptyLabel="Pet" />
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroLine}>{TALK_DISCLAIMER}</Text>
        </View>
        {bubbles.map((b) => (
          <View key={b.id} style={[styles.bubbleRow, b.role === "user" && styles.bubbleRowMine]}>
            <View style={[styles.bubble, b.role === "user" ? styles.bubbleMine : styles.bubblePet, b.pending && styles.bubblePending]}>
              {b.pending ? <ActivityIndicator color="#86efac" size="small" /> : <Text style={[styles.bubbleText, b.role === "user" && styles.bubbleTextMine]}>{b.content}</Text>}
            </View>
          </View>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.foot}>This conversation isn't saved. {displayName} only knows what Luna already knows.</Text>
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={`Say something to ${displayName}`}
          placeholderTextColor="rgba(148,163,184,0.7)"
          multiline
          maxLength={800}
          accessibilityLabel="Message"
          onSubmitEditing={send}
          blurOnSubmit
        />
        <Pressable style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonOff]} onPress={send} disabled={!draft.trim() || sending} accessibilityRole="button" accessibilityLabel="Send">
          <Feather name="send" size={18} color="#0f172a" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 16 },
  hero: { alignItems: "center", marginBottom: 14 },
  heroName: { marginTop: 6, color: "#f8fafc", fontSize: 18, fontWeight: "800" },
  heroLine: { marginTop: 4, color: "rgba(148,163,184,0.8)", fontSize: 11, textAlign: "center", paddingHorizontal: 20, lineHeight: 15 },
  bubbleRow: { flexDirection: "row", marginBottom: 10 },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "84%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubblePet: { backgroundColor: "rgba(53,208,127,0.12)", borderWidth: 1, borderColor: "rgba(53,208,127,0.25)", borderTopLeftRadius: 6 },
  bubbleMine: { backgroundColor: "#35d07f", borderTopRightRadius: 6 },
  bubblePending: { minWidth: 56, alignItems: "center" },
  bubbleText: { color: "#f8fafc", fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: "#0f172a" },
  error: { color: "#fca5a5", fontSize: 13, textAlign: "center", marginTop: 4, marginBottom: 8 },
  foot: { marginTop: 10, color: "rgba(148,163,184,0.6)", fontSize: 11, textAlign: "center", lineHeight: 15 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.15)",
    backgroundColor: "#0f1420",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    color: "#f8fafc",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#35d07f", alignItems: "center", justifyContent: "center" },
  sendButtonOff: { opacity: 0.45 },
});
