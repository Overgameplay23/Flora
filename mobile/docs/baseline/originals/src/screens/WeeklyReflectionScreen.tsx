import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { fetchWeeklyReflectionSummary, markWeeklyReflectionViewed, WeeklyReflectionSummary } from "../services/dailyLoop";
import { getISOWeekKey, toHumanWeekday } from "../utils/dateKeys";

export default function WeeklyReflectionScreen() {
  const { user, setProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [summary, setSummary] = useState<WeeklyReflectionSummary | null>(null);
  const weekKey = useMemo(() => getISOWeekKey(new Date()), []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.id) {
        if (mounted) {
          setSummary(null);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");
        const nextSummary = await fetchWeeklyReflectionSummary(user.id);
        if (!mounted) return;
        setSummary(nextSummary);
        const viewedWeek = await markWeeklyReflectionViewed(user.id, weekKey);
        if (viewedWeek) {
          setProfile?.((prev: any) => ({
            ...(prev || {}),
            last_reflection_viewed_week: viewedWeek,
          }));
        }
      } catch (error: any) {
        console.error("WEEKLY_REFLECTION_LOAD_ERROR", error?.message);
        if (mounted) {
          setErrorMessage("Could not load this week's reflection.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [setProfile, user?.id, weekKey]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Weekly reflection</Text>
      <Text style={styles.subtitle}>
        Last 7 days ({summary?.startDateKey ?? "----"} to {summary?.endDateKey ?? "----"})
      </Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Avg Mood</Text>
        <Text style={styles.bigValue}>
          {summary?.averageMood != null ? `${summary.averageMood.toFixed(1)}/5` : "No check-ins yet"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wins</Text>
        {summary?.wins?.length ? (
          summary.wins.map((entry, index) => (
            <Text key={`${entry.date}-${index}`} style={styles.rowText}>
              - {toHumanWeekday(entry.date)}: {entry.text}
            </Text>
          ))
        ) : (
          <Text style={styles.emptyText}>No wins logged this week yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hard Days</Text>
        {summary?.hardDays?.length ? (
          summary.hardDays.map((entry) => (
            <Text key={`${entry.date}-${entry.mood}`} style={styles.rowText}>
              - {toHumanWeekday(entry.date)} (mood {entry.mood}/5)
            </Text>
          ))
        ) : (
          <Text style={styles.emptyText}>No hard days detected this week.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  subtitle: { marginTop: 6, color: "#475569", marginBottom: 14 },
  error: { color: "#be123c", marginBottom: 10 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { color: "#334155", fontSize: 14, fontWeight: "700", marginBottom: 8 },
  bigValue: { color: "#065f46", fontWeight: "700", fontSize: 30 },
  rowText: { color: "#1e293b", marginBottom: 6, lineHeight: 20 },
  emptyText: { color: "#64748b" },
});
