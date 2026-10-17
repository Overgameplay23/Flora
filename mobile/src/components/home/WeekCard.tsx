import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../common/PressableScale";
import { brand, radius, type, type Surface } from "../../theme/tokens";

export type WeekDay = { day: string; activity_count: number };

type WeekCardProps = {
  petName: string;
  days: WeekDay[];
  loading: boolean;
  daysTogether: number | null;
  onPress: () => void;
  surface: Surface;
  /** a new scrapbook page is waiting (src/domain/scrapbook.ts shouldNudgeHome); the card opens it */
  pageReady?: boolean;
  onOpenPage?: () => void;
};

function weekdayInitials(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(date).slice(0, 2);
}

/**
 * The last seven days as stems that grow with activity. Quiet days are blank paper, never a red mark;
 * the headline is days together, which only ever goes up.
 */
export default function WeekCard({ petName, days, loading, daysTogether, onPress, surface, pageReady = false, onOpenPage }: WeekCardProps) {
  const max = days.reduce((m, row) => Math.max(m, row.activity_count), 0);
  const active = days.filter((row) => row.activity_count > 0).length;
  const sentence =
    active === 0
      ? "A fresh week. One small thing is plenty to start."
      : `${active} ${active === 1 ? "day" : "days"} of care this week.`;
  const page = pageReady && !!onOpenPage;
  const link = page ? `${petName} put together the week's page` : `What ${petName} noticed`;
  return (
    <PressableScale
      onPress={page ? onOpenPage : onPress}
      accessibilityRole="button"
      accessibilityLabel={`This week with ${petName}. ${sentence} ${link}.`}
      style={[styles.card, { backgroundColor: surface.paper, boxShadow: surface.shadow }]}
    >
      <View style={styles.headRow}>
        <Text style={[type.h3, styles.headText, { color: surface.text }]}>This week with {petName}</Text>
        <Ionicons name="chevron-forward" size={18} color={surface.textTertiary} />
      </View>
      {loading && days.length === 0 ? (
        <ActivityIndicator color={brand.sprout} style={styles.loading} />
      ) : (
        <View style={styles.bars}>
          {days.map((row) => {
            const level = max > 0 ? row.activity_count / max : 0;
            const on = row.activity_count > 0;
            return (
              <View key={row.day} style={styles.column}>
                <View style={[styles.track, { backgroundColor: surface.sunken }]}>
                  <View style={[styles.fill, { height: `${on ? Math.max(22, Math.round(level * 100)) : 0}%`, backgroundColor: brand.sprout }]} />
                </View>
                <Text style={[styles.dayLabel, { color: on ? surface.text : surface.textTertiary }]}>{weekdayInitials(row.day)}</Text>
              </View>
            );
          })}
        </View>
      )}
      <Text style={[type.callout, { color: surface.textSecondary }]}>
        {sentence}
        {daysTogether && daysTogether > 0 ? ` ${daysTogether} ${daysTogether === 1 ? "day" : "days"} together so far.` : ""}
      </Text>
      <View style={styles.linkRow}>
        {page ? <Ionicons name="images-outline" size={15} color={surface.isNight ? brand.bloomNight : brand.ember} /> : null}
        <Text style={[type.meta, { color: surface.isNight ? brand.bloomNight : brand.ember }]}>{link}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 16,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headText: {
    flexShrink: 1,
    paddingRight: 8,
  },
  loading: {
    marginVertical: 24,
  },
  bars: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 12,
    height: 76,
  },
  column: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  track: {
    width: 16,
    height: 54,
    borderRadius: 8,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    borderRadius: 8,
  },
  dayLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
});
