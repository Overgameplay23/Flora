// "This month": the pet tells the last thirty days back as patterns (product strategy report: shallow insights,
// told by the pet). Observations, not verdicts; nothing here counts a miss. Reads the daily roll-up and the
// battery answers kept on this device; nothing new is sent anywhere.
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import PetMascot from "../components/pet/PetMascot";
import { PetEmptyState, PetLoading } from "../components/pet/PetMoments";
import Screen from "../components/common/Screen";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import IconTile from "../components/common/IconTile";
import StatStrip from "../components/common/StatStrip";
import { Eyebrow } from "../components/common/Headings";
import { useTheme } from "../theme/theme";
import { fonts, radius, type } from "../theme/tokens";
import { fetchLast30DaysMetrics } from "../services/retention";
import { loadEnergyHistory } from "../services/planStore";
import { MONTH_DAYS, buildMonthInsights, type MonthInsights } from "../domain/insights";
import { getLocalDateKey } from "../utils/dateKeys";

/** The month's colour: calm green (the "Our week" story is connection rose). */
const MONTH_CATEGORY = "calm";

function aboutADay(tasksPerDay: number): string {
  const n = Math.round(tasksPerDay);
  if (n === 0) return "a light list";
  return `about ${n} small ${n === 1 ? "thing" : "things"} a day`;
}

export default function InsightsScreen() {
  const { user } = useAuth();
  const { displayName, memorial } = usePet();
  const theme = useTheme();
  const { surface } = theme;
  const tone = theme.tone(MONTH_CATEGORY);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [month, setMonth] = useState<MonthInsights | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setMonth(null);
      setLoading(false);
      return;
    }
    const endDateKey = getLocalDateKey();
    const battery = await loadEnergyHistory(user.id, endDateKey, MONTH_DAYS);
    try {
      setErrorMessage("");
      const metrics = await fetchLast30DaysMetrics();
      setMonth(buildMonthInsights({ endDateKey, metrics, battery, petName: displayName, memorial: !!memorial }));
    } catch (error: any) {
      console.warn("INSIGHTS_LOAD_ERROR", error?.message || String(error));
      // keep the month already on screen, if any; never make a quiet month up out of a failed request
      setErrorMessage("Couldn't reach the month just now.");
    } finally {
      setLoading(false);
    }
  }, [displayName, memorial, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!user?.id) {
    return (
      <Screen scroll={false} centered>
        <PetEmptyState title="Sign in to see the month." mood="calm" />
      </Screen>
    );
  }
  if (loading && !month) {
    return (
      <Screen scroll={false} centered>
        <PetLoading label="Looking back over the month" />
      </Screen>
    );
  }
  if (!month) {
    return (
      <Screen scroll={false} centered>
        <PetEmptyState title="Couldn't reach the month just now." body="Your days are safe. Try again in a moment." mood="calm" />
        <Button
          label="Try again"
          icon="refresh-outline"
          variant="secondary"
          size="md"
          onPress={() => {
            setLoading(true);
            void load();
          }}
          accessibilityLabel="Try loading the month again"
          containerStyle={styles.retry}
        />
      </Screen>
    );
  }

  // the label names only the weekdays with care on them, as the bars do; nothing here counts a miss
  const named = month.weekdays.filter((w) => w.activeDays > 0).map((w) => `${w.weekday} ${w.activeDays} of ${w.occurrences}`);
  const weekdayLabel = named.length ? `Days you come by: ${named.join(", ")}` : "Days you come by: nothing yet this month";

  return (
    <Screen bottomPad={48}>
      <Text style={[type.meta, styles.range, { color: surface.textSecondary }]}>
        {month.range} · thirty days with {displayName}
      </Text>
      {errorMessage ? <Text style={[type.meta, styles.error, { color: theme.alert }]}>{errorMessage}</Text> : null}

      <View style={[styles.petCard, { backgroundColor: tone.fill, boxShadow: surface.shadow }]}>
        <View style={styles.petHead}>
          <PetMascot size={92} mood={memorial ? "calm" : month.activeDays > 0 ? "happy" : "calm"} showShadow={false} night={theme.night} style={styles.petPortrait} />
          <View style={styles.petHeadText}>
            <Eyebrow color={tone.accent}>{memorial ? `Remembering ${displayName}` : `${displayName} noticed`}</Eyebrow>
            <Text style={[type.h2, styles.headline, { color: surface.text }]} accessibilityRole="header">
              {month.headline}
            </Text>
          </View>
        </View>
        {month.noticed.map((line) => (
          <View key={line} style={styles.noticedRow}>
            <View style={[styles.noticedDot, { backgroundColor: tone.accent }]} />
            <Text style={[type.callout, styles.noticedText, { color: surface.text }]}>{line}</Text>
          </View>
        ))}
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[type.h3, { color: surface.text }]}>Days you come by</Text>
          <Text style={[type.meta, { color: surface.textSecondary }]}>
            {month.fullestWeekday ? `Mostly ${month.fullestWeekday.weekday}s` : month.activeDays > 0 ? "No one day leads" : "Nothing yet"}
          </Text>
        </View>
        <View style={styles.barRow} accessible accessibilityLabel={weekdayLabel}>
          {month.weekdays.map((w) => {
            const leads = month.fullestWeekday?.weekday === w.weekday;
            return (
              <View key={w.weekday} style={styles.barColumn}>
                <View style={[styles.barTrack, { backgroundColor: surface.sunken }]}>
                  {w.activeDays > 0 ? (
                    <View style={[styles.barFill, { height: 18 + w.share * 46, backgroundColor: tone.mid }, leads && { borderWidth: 2, borderColor: tone.accent }]} />
                  ) : null}
                </View>
                <Text style={[styles.barLabel, { color: leads ? surface.text : surface.textTertiary, fontFamily: leads ? fonts.bodyHeavy : fonts.bodyBold }]}>{w.initial}</Text>
                <Text style={[type.micro, { color: surface.textTertiary }]}>{w.activeDays > 0 ? `${w.activeDays}/${w.occurrences}` : " "}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {memorial && month.battery.length === 0 ? null : (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[type.h3, { color: surface.text }]}>Battery and small things</Text>
          <Text style={[type.meta, { color: surface.textSecondary }]}>
            {month.batteryDays > 0 ? `${month.batteryDays} ${month.batteryDays === 1 ? "check" : "checks"}` : ""}
          </Text>
        </View>
        {month.battery.length === 0 ? (
          <Text style={[type.callout, { color: surface.textSecondary }]}>No battery checks this month. The battery is on Home, one tap on the days you want it.</Text>
        ) : (
          month.battery.map((b, index) => (
            <View
              key={b.energy}
              style={[styles.batteryRow, index > 0 && { borderTopWidth: 1, borderTopColor: surface.hairline }]}
              accessible
              accessibilityLabel={`${b.label}: ${b.days} ${b.days === 1 ? "day" : "days"}, ${aboutADay(b.tasksPerDay)}`}
            >
              <IconTile icon={b.icon} category={b.category} size={38} />
              <View style={styles.batteryBody}>
                <Text style={[type.bodyStrong, { color: surface.text }]}>{b.label}</Text>
                <Text style={[type.meta, { color: surface.textSecondary }]}>
                  {b.days} {b.days === 1 ? "day" : "days"} · {aboutADay(b.tasksPerDay)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
      )}

      <Text style={[type.h3, styles.smallTitle, { color: surface.text }]}>Small things</Text>
      <StatStrip
        items={[
          { value: month.tasks, label: "done", icon: "checkmark-circle-outline", category: "body" },
          { value: month.checkins, label: "check-ins", icon: "sunny-outline", category: "energy" },
          { value: month.activeDays, label: `of ${MONTH_DAYS} days`, icon: "calendar-outline", category: "calm" },
        ]}
      />
      {month.points > 0 && !memorial ? (
        <Text style={[type.meta, styles.statsFoot, { color: surface.textSecondary }]}>{month.points} points went into the garden.</Text>
      ) : null}

      <View style={styles.closing}>
        <Text style={[type.petVoice, styles.closingText, { color: surface.textSecondary }]}>{month.closing}</Text>
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
  barRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 4 },
  barColumn: { alignItems: "center", flex: 1 },
  barTrack: { width: 18, height: 64, borderRadius: 9, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 9 },
  barLabel: { marginTop: 6, fontSize: 12, lineHeight: 16 },
  batteryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  batteryBody: { flex: 1, marginLeft: 12, gap: 2 },
  smallTitle: { marginTop: 8, marginBottom: 10, marginLeft: 4 },
  statsFoot: { marginTop: 10, textAlign: "center" },
  closing: { alignItems: "center", paddingTop: 22, paddingHorizontal: 10 },
  closingText: { textAlign: "center" },
  retry: { marginTop: 18, alignSelf: "center" },
});
