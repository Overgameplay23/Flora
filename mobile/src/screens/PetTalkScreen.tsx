// Talking with the pet. The server function holds the voice and its guardrails; this screen holds
// the conversation for the session only (nothing is stored), opens with the pet's own line, and
// steps out of the way for crisis language. Hidden until the function reports a key (petTalkAvailable).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { useTheme } from "../theme/theme";
import { fonts, ink, radius, type } from "../theme/tokens";

type Bubble = TalkMessage & { id: string; pending?: boolean };

export default function PetTalkScreen() {
  const { user, profile } = useAuth();
  const { sources, look, displayName, species, memorial } = usePet();
  const cycle = useCycle();
  const theme = useTheme();
  const { surface, night } = theme;
  const petTone = theme.tone("connection");
  const insets = useSafeAreaInsets();
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

  const canSend = !!draft.trim() && !sending;

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: surface.canvas }]} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <PetPortrait sources={sources} look={look} size={84} mood="calm" resting={!!memorial} allowOriginal emptyLabel="Pet" />
          <Text style={[type.h2, styles.heroName, { color: surface.text }]}>{displayName}</Text>
          <Text style={[type.meta, styles.heroLine, { color: surface.textTertiary }]}>{TALK_DISCLAIMER}</Text>
        </View>
        {bubbles.map((b) => {
          const mine = b.role === "user";
          return (
            <View key={b.id} style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View
                style={[
                  styles.bubble,
                  mine
                    ? { backgroundColor: theme.bloom, borderTopRightRadius: 6 }
                    : { backgroundColor: night ? surface.paper : petTone.fill, borderTopLeftRadius: 6, boxShadow: surface.shadow },
                  b.pending && styles.bubblePending,
                ]}
                accessibilityRole="text"
                accessibilityLabel={mine ? `You: ${b.content}` : `${displayName}: ${b.content}`}
              >
                {b.pending ? <ActivityIndicator color={petTone.accent} size="small" /> : <Text style={[mine ? type.body : type.petVoice, { color: mine ? ink.primary : surface.text }]}>{b.content}</Text>}
              </View>
            </View>
          );
        })}
        {error ? (
          <Text style={[type.meta, styles.error, { color: theme.alert }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Text style={[type.meta, styles.foot, { color: surface.textTertiary }]}>This conversation isn't saved. {displayName} only knows what the app already knows.</Text>
      </ScrollView>
      <View style={[styles.composer, { backgroundColor: surface.canvas, borderTopColor: surface.hairline, paddingBottom: Math.max(12, insets.bottom) }]}>
        <TextInput
          style={[styles.input, { color: surface.text, backgroundColor: surface.sunken, borderColor: surface.hairline }]}
          value={draft}
          onChangeText={setDraft}
          placeholder={`Say something to ${displayName}`}
          placeholderTextColor={surface.textTertiary}
          multiline
          maxLength={800}
          accessibilityLabel="Message"
          onSubmitEditing={send}
          blurOnSubmit
        />
        <Pressable
          style={[styles.sendButton, { backgroundColor: theme.bloom }, !canSend && styles.sendButtonOff]}
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend }}
        >
          <Ionicons name="arrow-up" size={20} color={ink.primary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 16 },
  hero: { alignItems: "center", marginBottom: 16 },
  heroName: { marginTop: 8 },
  heroLine: { marginTop: 4, textAlign: "center", paddingHorizontal: 20 },
  bubbleRow: { flexDirection: "row", marginBottom: 10 },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "84%", borderRadius: radius.row, borderCurve: "continuous", paddingHorizontal: 14, paddingVertical: 10 },
  bubblePending: { minWidth: 56, alignItems: "center" },
  error: { textAlign: "center", marginTop: 4, marginBottom: 8 },
  foot: { marginTop: 10, textAlign: "center" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 23,
    borderWidth: 1,
  },
  sendButton: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  sendButtonOff: { opacity: 0.45 },
});
