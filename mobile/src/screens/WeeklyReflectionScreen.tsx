// "Our week": the pet tells the last seven days back (product strategy report: weekly scrapbook).
// Observations, not verdicts; energy over mood; wins kept; heavier days named gently.
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import type { PetMood } from "../components/pet/PetPortrait";
import PetMascot from "../components/pet/PetMascot";
import { PetEmptyState, PetLoading } from "../components/pet/PetMoments";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import StatStrip from "../components/common/StatStrip";
import { Eyebrow } from "../components/common/Headings";
import { useTheme } from "../theme/theme";
import { fonts, radius, type } from "../theme/tokens";
import { fetchWeeklyCheckins, markWeeklyReflectionViewed } from "../services/dailyLoop";
import { fetchLast7DaysMetrics } from "../services/retention";
import { buildWeekStory, type WeekStory } from "../domain/week";
import { getISOWeekKey, getLocalDateKey } from "../utils/dateKeys";

/** The story card's colour (as on the "Our week" row in Profile). */
const WEEK_CATEGORY = "connection";

/** Energy 1-5 as care colours, low to high: the same steps as the check-in picker. */
const ENERGY_CATEGORIES = ["", "rest", "calm", "focus", "energy", "play"];

export default function WeeklyReflectionScreen() {
  const { user, setProfile } = useAuth();
  const navigation = useNavigation<any>();
  const { displayName, memorial } = usePet();
  const theme = useTheme();
  const { surface } = theme;
  const weekTone = theme.tone(WEEK_CATEGORY);
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
      let metricsFailed = false;
      const [checkins, metrics] = await Promise.all([
        fetchWeeklyCheckins(user.id, endDateKey),
        fetchLast7DaysMetrics().catch(() => {
          metricsFailed = true;
          return [];
        }),
      ]);
      const built = buildWeekStory({ endDateKey, checkins, metrics, petName: displayName, memorial: !!memorial });
      if (metricsFailed) {
        // say so, and keep the week already on screen rather than telling an empty one
        setErrorMessage("Couldn't reach the week's small things just now.");
        setStory((prev) => prev ?? built);
      } else {
        setStory(built);
      }
      const viewedWeek = await markWeeklyReflectionViewed(user.id, getISOWeekKey(new Date())).catch(() => null);
      if (viewedWeek) {
        setProfile?.((prev: any) => ({ ...(prev || {}), last_reflection_viewed_week: viewedWeek }));
      }
    } catch (error: any) {
      console.error("WEEKLY_REFLECTION_LOAD_ERROR", error?.message);
      setErrorMessage("Couldn't load the week just now.");
      setStory((prev) => prev ?? buildWeekStory({ endDateKey, checkins: [], metrics: [], petName: displayName, memorial: !!memorial }));
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
      <Screen scroll={false} centered>
        <PetLoading label="Looking back over the week" />
      </Screen>
    );
  }
  if (!story) {
    return (
      <Screen scroll={false} centered>
        <PetEmptyState title="Sign in to see the week." mood="calm" />
      </Screen>
    );
  }

  const maxEnergy = 5;

  return (
    <Screen bottomPad={48}>
      <Text style={[type.meta, styles.range, { color: surface.textSecondary }]}>
        {story.range} · seven days with {displayName}
      </Text>
      {errorMessage ? <Text style={[type.meta, styles.error, { color: theme.alert }]}>{errorMessage}</Text> : null}

      <View style={[styles.petCard, { backgroundColor: weekTone.fill, boxShadow: surface.shadow }]}>
        <View style={styles.petHead}>
          <PetMascot size={92} mood={petMood} showShadow={false} night={theme.night} style={styles.petPortrait} />
          <View style={styles.petHeadText}>
            <Eyebrow color={weekTone.accent}>{memorial ? `Remembering ${displayName}` : `${displayName} noticed`}</Eyebrow>
            <Text style={[type.h2, styles.headline, { color: surface.text }]} accessibilityRole="header">
              {story.headline}
            </Text>
          </View>
        </View>
        {story.noticed.map((line) => (
          <View key={line} style={styles.noticedRow}>
            <View style={[styles.noticedDot, { backgroundColor: weekTone.accent }]} />
            <Text style={[type.callout, styles.noticedText, { color: surface.text }]}>{line}</Text>
          </View>
        ))}
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[type.h3, { color: surface.text }]}>Energy</Text>
          <Text style={[type.meta, { color: surface.textSecondary }]}>
            {story.energyWord ? `Mostly ${story.energyWord.toLowerCase()}` : "No check-ins yet"}
          </Text>
        </View>
        <View
          style={styles.energyRow}
          accessible
          accessibilityLabel={`Energy by day: ${story.days.map((d) => `${d.weekday} ${d.energy == null ? "no check-in" : d.energy} of 5`).join(", ")}`}
        >
          {story.days.map((d) => {
            const filled = d.energy != null;
            const level = filled ? Math.max(1, Math.min(5, Math.round(d.energy as number))) : 0;
            const tone = filled ? theme.tone(ENERGY_CATEGORIES[level]) : null;
            const height = filled ? 18 + (level / maxEnergy) * 46 : 0;
            return (
              <View key={d.dateKey} style={styles.energyColumn}>
                <View style={[styles.energyTrack, { backgroundColor: surface.sunken }]}>
                  {tone ? (
                    <View
                      style={[
                        styles.energyFill,
                        { height, backgroundColor: tone.mid },
                        d.isToday && { borderWidth: 2, borderColor: tone.accent },
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.energyLabel,
                    { color: d.isToday ? surface.text : surface.textTertiary, fontFamily: d.isToday ? fonts.bodyHeavy : fonts.bodyBold },
                  ]}
                >
                  {d.initial}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[type.h3, { color: surface.text }]}>Kept</Text>
          <Text style={[type.meta, { color: surface.textSecondary }]}>
            {story.kept.length === 0 ? "" : `${story.kept.length} ${story.kept.length === 1 ? "win" : "wins"}`}
          </Text>
        </View>
        {story.kept.length === 0 ? (
          <Text style={[type.callout, { color: surface.textSecondary }]}>Nothing written down yet. A win can be tiny.</Text>
        ) : (
          story.kept.map((k, index) => (
            <View key={k.dateKey} style={[styles.keptRow, index > 0 && { borderTopWidth: 1, borderTopColor: surface.hairline }]}>
              <Text style={[type.meta, styles.keptDay, { color: weekTone.accent, fontFamily: fonts.bodyHeavy }]}>{k.weekday.slice(0, 3)}</Text>
              <Text style={[type.callout, styles.keptText, { color: surface.text }]}>{k.text}</Text>
            </View>
          ))
        )}
      </Card>

      <Text style={[type.h3, styles.smallTitle, { color: surface.text }]}>Small things</Text>
      <StatStrip
        items={[
          { value: story.tasks, label: "done", icon: "checkmark-circle-outline", category: "body" },
          { value: story.checkins, label: "check-ins", icon: "sunny-outline", category: "energy" },
          { value: story.activeDays, label: "of 7 days", icon: "calendar-outline", category: "calm" },
        ]}
      />
      {story.points > 0 && !memorial ? (
        <Text style={[type.meta, styles.statsFoot, { color: surface.textSecondary }]}>{story.points} points went into the garden.</Text>
      ) : null}
      <Button
        label="See the whole month"
        icon="calendar-outline"
        variant="secondary"
        size="sm"
        onPress={() => navigation.navigate("Insights")}
        accessibilityLabel="See the whole month"
        containerStyle={styles.monthButton}
      />
      <Button
        label="Open the scrapbook"
        icon="images-outline"
        variant="quiet"
        size="sm"
        onPress={() => navigation.navigate("Scrapbook")}
        accessibilityLabel="Open the scrapbook"
        containerStyle={styles.scrapbookButton}
      />

      <View style={styles.closing}>
        <Text style={[type.petVoice, styles.closingText, { color: surface.textSecondary }]}>{story.closing}</Text>
        {!story.checkedInToday && !memorial ? (
          <Button
            label="Check in for today"
            icon="sunny-outline"
            size="md"
            onPress={() => navigation.navigate("CheckIn")}
            accessibilityLabel="Check in for today"
            containerStyle={styles.closingButton}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  range: { marginBottom: 12, marginLeft: 4 },
  error: { marginBottom: 10, marginLeft: 4 },
  petCard: {
    borderRadius: radius.hero,
    borderCurve: "continuous",
    padding: 16,
    marginBottom: 14,
  },
  petHead: { flexDirection: "row", alignItems: "flex-end" },
  petPortrait: { marginRight: 12 },
  petHeadText: { flex: 1, paddingBottom: 4 },
  headline: { marginTop: 4 },
  noticedRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 10 },
  noticedDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8, marginRight: 10 },
  noticedText: { flex: 1 },
  card: { marginBottom: 14 },
  cardHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  energyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 4 },
  energyColumn: { alignItems: "center", flex: 1 },
  energyTrack: { width: 18, height: 64, borderRadius: 9, justifyContent: "flex-end", overflow: "hidden" },
  energyFill: { width: "100%", borderRadius: 9 },
  energyLabel: { marginTop: 6, fontSize: 12, lineHeight: 16 },
  keptRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8 },
  keptDay: { width: 44, marginTop: 2 },
  keptText: { flex: 1 },
  smallTitle: { marginTop: 8, marginBottom: 10, marginLeft: 4 },
  statsFoot: { marginTop: 10, textAlign: "center" },
  monthButton: { marginTop: 14, alignSelf: "center" },
  scrapbookButton: { marginTop: 6, alignSelf: "center" },
  closing: { alignItems: "center", paddingTop: 22, paddingHorizontal: 10 },
  closingText: { textAlign: "center" },
  closingButton: { marginTop: 14, alignSelf: "center" },
});
