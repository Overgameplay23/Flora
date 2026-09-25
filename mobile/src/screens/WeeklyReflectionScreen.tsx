// "Our week": the pet tells the last seven days back (product strategy report: weekly scrapbook).
// Observations, not verdicts; energy over mood; wins kept; heavier days named gently.
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import PetPortrait, { type PetMood } from "../components/pet/PetPortrait";
import { fetchWeeklyCheckins, markWeeklyReflectionViewed } from "../services/dailyLoop";
import { fetchLast7DaysMetrics } from "../services/retention";
import { buildWeekStory, type WeekStory } from "../domain/week";
import { getISOWeekKey, getLocalDateKey } from "../utils/dateKeys";

const ENERGY_COLORS = ["", "#94a3b8", "#a5b4fc", "#67e8f9", "#86efac", "#fde68a"];

export default function WeeklyReflectionScreen() {
  const { user, setProfile } = useAuth();
  const navigation = useNavigation<any>();
  const { sources, look, displayName, memorial } = usePet();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [story, setStory] = useState<WeekStory | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setStory(null);
      setLoading(false);
      return;
    }
    const endDateKey = getLocalDateKey();
    try {
      setErrorMessage("");
      const [checkins, metrics] = await Promise.all([
        fetchWeeklyCheckins(user.id, endDateKey),
        fetchLast7DaysMetrics().catch(() => []),
      ]);
      setStory(buildWeekStory({ endDateKey, checkins, metrics, petName: displayName, memorial: !!memorial }));
      const viewedWeek = await markWeeklyReflectionViewed(user.id, getISOWeekKey(new Date())).catch(() => null);
      if (viewedWeek) {
        setProfile?.((prev: any) => ({ ...(prev || {}), last_reflection_viewed_week: viewedWeek }));
      }
    } catch (error: any) {
      console.error("WEEKLY_REFLECTION_LOAD_ERROR", error?.message);
      setErrorMessage("Couldn't load the week just now.");
      setStory(buildWeekStory({ endDateKey, checkins: [], metrics: [], petName: displayName, memorial: !!memorial }));
    } finally {
      setLoading(false);
    }
  }, [displayName, memorial, setProfile, user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const petMood: PetMood = useMemo(() => {
    if (memorial) return "calm";
    if (!story || story.energyAverage == null) return "calm";
    if (story.energyAverage >= 4) return "happy";
    return "calm";
  }, [memorial, story]);

  if (loading && !story) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#35d07f" />
      </View>
    );
  }
  if (!story) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Sign in to see the week.</Text>
      </View>
    );
  }

  const maxEnergy = 5;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.range}>
        {story.range} · seven days with {displayName}
      </Text>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.petCard}>
        <PetPortrait sources={sources} look={look} size={104} mood={petMood} resting={!!memorial} allowOriginal emptyLabel="Your pet" style={styles.petPortrait} />
        <View style={styles.petBody}>
          <Text style={styles.noticedBy}>{memorial ? `Remembering ${displayName}` : `${displayName} noticed`}</Text>
          <Text style={styles.headline}>{story.headline}</Text>
          {story.noticed.map((line) => (
            <View key={line} style={styles.noticedRow}>
              <View style={styles.noticedDot} />
              <Text style={styles.noticedText}>{line}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Energy</Text>
          <Text style={styles.cardMeta}>{story.energyWord ? `Mostly ${story.energyWord.toLowerCase()}` : "No check-ins yet"}</Text>
        </View>
        <View
          style={styles.energyRow}
          accessible
          accessibilityLabel={`Energy by day: ${story.days.map((d) => `${d.weekday} ${d.energy == null ? "no check-in" : d.energy} of 5`).join(", ")}`}
        >
          {story.days.map((d) => {
            const filled = d.energy != null;
            const height = filled ? 18 + ((d.energy as number) / maxEnergy) * 46 : 10;
            return (
              <View key={d.dateKey} style={styles.energyColumn}>
                <View style={styles.energyTrack}>
                  <View
                    style={[
                      styles.energyFill,
                      { height, backgroundColor: filled ? ENERGY_COLORS[d.energy as number] : "rgba(148,163,184,0.18)" },
                      d.isToday && styles.energyFillToday,
                    ]}
                  />
                </View>
                <Text style={[styles.energyLabel, d.isToday && styles.energyLabelToday]}>{d.initial}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Kept</Text>
          <Text style={styles.cardMeta}>{story.kept.length === 0 ? "" : `${story.kept.length} ${story.kept.length === 1 ? "win" : "wins"}`}</Text>
        </View>
        {story.kept.length === 0 ? (
          <Text style={styles.emptyLine}>Nothing written down yet. A win can be tiny.</Text>
        ) : (
          story.kept.map((k) => (
            <View key={k.dateKey} style={styles.keptRow}>
              <Text style={styles.keptDay}>{k.weekday.slice(0, 3)}</Text>
              <Text style={styles.keptText}>{k.text}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Small things</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{story.tasks}</Text>
            <Text style={styles.statLabel}>done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{story.checkins}</Text>
            <Text style={styles.statLabel}>check-ins</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{story.activeDays}</Text>
            <Text style={styles.statLabel}>of 7 days</Text>
          </View>
        </View>
        {story.points > 0 && !memorial ? <Text style={styles.statsFoot}>{story.points} points went into the garden.</Text> : null}
      </View>

      <View style={styles.closingCard}>
        <Text style={styles.closingText}>{story.closing}</Text>
        {!story.checkedInToday && !memorial ? (
          <Pressable style={styles.closingButton} onPress={() => navigation.navigate("CheckIn")} accessibilityRole="button" accessibilityLabel="Check in for today">
            <Feather name="sun" size={16} color="#0f172a" />
            <Text style={styles.closingButtonText}>Check in for today</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1420" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f1420" },
  empty: { color: "rgba(148,163,184,0.9)" },
  title: { color: "#f8fafc", fontSize: 26, fontWeight: "800" },
  range: { marginTop: 4, color: "rgba(148,163,184,0.9)", fontSize: 14, marginBottom: 14 },
  error: { color: "#fca5a5", marginBottom: 10 },
  petCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(53,208,127,0.10)",
    borderWidth: 1,
    borderColor: "rgba(53,208,127,0.28)",
    marginBottom: 12,
  },
  petPortrait: { marginRight: 12 },
  petBody: { flex: 1, paddingTop: 2 },
  noticedBy: { color: "#86efac", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  headline: { marginTop: 4, color: "#f8fafc", fontSize: 18, fontWeight: "800", lineHeight: 24 },
  noticedRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 8 },
  noticedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#86efac", marginTop: 7, marginRight: 8 },
  noticedText: { flex: 1, color: "rgba(226,232,240,0.92)", fontSize: 14, lineHeight: 20 },
  card: {
    borderRadius: 18,
    backgroundColor: "rgba(18,24,38,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { color: "#e2e8f0", fontSize: 15, fontWeight: "700" },
  cardMeta: { color: "rgba(148,163,184,0.9)", fontSize: 12 },
  energyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 4 },
  energyColumn: { alignItems: "center", width: 36 },
  energyTrack: { height: 64, justifyContent: "flex-end" },
  energyFill: { width: 18, borderRadius: 9 },
  energyFillToday: { borderWidth: 2, borderColor: "#f8fafc" },
  energyLabel: { marginTop: 6, color: "rgba(148,163,184,0.8)", fontSize: 12, fontWeight: "600" },
  energyLabelToday: { color: "#f8fafc" },
  emptyLine: { color: "rgba(148,163,184,0.9)", fontSize: 14, lineHeight: 20 },
  keptRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "rgba(148,163,184,0.1)" },
  keptDay: { width: 40, color: "#86efac", fontSize: 12, fontWeight: "700", marginTop: 2 },
  keptText: { flex: 1, color: "#e2e8f0", fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: "#f8fafc", fontSize: 24, fontWeight: "800" },
  statLabel: { marginTop: 2, color: "rgba(148,163,184,0.85)", fontSize: 12 },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(148,163,184,0.3)" },
  statsFoot: { marginTop: 12, color: "rgba(148,163,184,0.9)", fontSize: 13, textAlign: "center" },
  closingCard: { alignItems: "center", paddingVertical: 16, paddingHorizontal: 10 },
  closingText: { color: "rgba(226,232,240,0.9)", fontSize: 15, textAlign: "center", lineHeight: 22 },
  closingButton: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#35d07f",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  closingButtonText: { color: "#0f172a", fontWeight: "800", fontSize: 15 },
});
