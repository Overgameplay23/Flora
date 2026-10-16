import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../common/PressableScale";
import { brand, categoryTone, fonts, ink, radius, type, type Surface } from "../../theme/tokens";

export type JourneyCardProps = {
  journeyTitle: string;
  /** 0-based */
  dayIndex: number;
  total: number;
  dayTitle: string;
  petLine: string;
  task: { title: string; category: string; icon: string; minutes: number } | null;
  done: boolean;
  nextTitle: string | null;
  saving?: boolean;
  notice?: { type: "error" | "queued"; message: string } | null;
  /** opens the journey screen */
  onOpen: () => void;
  onComplete: () => void;
  onRetry?: () => void;
  surface: Surface;
};

/**
 * Today's step of the active journey, at the top of "Today's care": the arc's name and day, the day's theme,
 * what the pet says about it, and the day's task with its check. Done, it says what tomorrow brings.
 */
export default function JourneyCard({ journeyTitle, dayIndex, total, dayTitle, petLine, task, done, nextTitle, saving = false, notice = null, onOpen, onComplete, onRetry, surface }: JourneyCardProps) {
  const tone = categoryTone(task?.category ?? "calm");
  const night = surface.isNight;
  const accent = night ? tone.mid : tone.strong;
  const cardBg = night ? surface.paper : tone.tint;
  const meta = task ? [tone.label, task.minutes > 0 ? `${task.minutes} min` : null].filter(Boolean).join(" · ") : "";
  return (
    <View style={styles.outer}>
      <View style={[styles.card, { backgroundColor: cardBg, boxShadow: surface.shadowRaised, borderColor: accent }]}>
        <PressableScale onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${journeyTitle}, day ${dayIndex + 1} of ${total}: ${dayTitle}. Open the journey`} pressedScale={0.99} style={styles.head}>
          <View style={styles.headRow}>
            <View style={[styles.flag, { backgroundColor: accent }]}>
              <Ionicons name="map-outline" size={12} color={night ? ink.primary : brand.cream} />
              <Text style={[styles.flagText, { color: night ? ink.primary : brand.cream }]}>
                JOURNEY · DAY {dayIndex + 1} OF {total}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={surface.textTertiary} />
          </View>
          <Text style={[type.micro, styles.journeyName, { color: accent }]}>{journeyTitle.toUpperCase()}</Text>
          <Text style={[type.h3, { color: surface.text }]}>{dayTitle}</Text>
          <Text style={[type.petVoice, styles.petLine, { color: surface.textSecondary }]}>{petLine}</Text>
        </PressableScale>

        {task ? (
          <View style={[styles.taskRow, { backgroundColor: night ? surface.sunken : "rgba(255,255,255,0.55)" }]}>
            <View style={[styles.tile, { backgroundColor: night ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" }]}>
              <Ionicons name={task.icon as any} size={22} color={accent} />
            </View>
            <View style={styles.taskBody}>
              <Text style={[styles.meta, { color: accent }]} numberOfLines={1}>
                {meta}
              </Text>
              <Text style={[type.bodyStrong, { color: surface.text }, done && styles.titleDone]} numberOfLines={2}>
                {task.title}
              </Text>
            </View>
            <Pressable
              onPress={done || saving ? undefined : onComplete}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityLabel={done ? `${task.title}, done` : `Mark ${task.title} done`}
              accessibilityState={{ checked: done, disabled: done || saving }}
            >
              <View style={[styles.check, { borderColor: accent, backgroundColor: done ? accent : "transparent" }]}>
                {saving ? <ActivityIndicator size="small" color={accent} /> : done ? <Ionicons name="checkmark" size={20} color={night ? ink.primary : brand.cream} /> : null}
              </View>
            </Pressable>
          </View>
        ) : null}

        {done ? (
          <Text style={[type.meta, styles.foot, { color: surface.textSecondary }]}>
            {nextTitle ? `Day ${dayIndex + 1} done. Tomorrow: ${nextTitle}.` : `That was the last day. Beautifully done.`}
          </Text>
        ) : null}
      </View>
      {notice ? (
        <Pressable onPress={notice.type === "error" ? onRetry : undefined} disabled={notice.type !== "error"} accessibilityRole={notice.type === "error" ? "button" : "text"}>
          <Text style={[type.meta, styles.notice, { color: notice.type === "error" ? brand.ember : surface.textSecondary }]}>{notice.message}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: 12,
  },
  card: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    borderWidth: 1.5,
    padding: 14,
  },
  head: {
    gap: 4,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  flag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  flagText: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  journeyName: {
    marginTop: 2,
  },
  petLine: {
    marginTop: 2,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 10,
    paddingRight: 12,
    borderRadius: radius.row,
    borderCurve: "continuous",
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.tile - 2,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  taskBody: {
    flex: 1,
    marginHorizontal: 12,
  },
  meta: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  },
  titleDone: {
    textDecorationLine: "line-through",
  },
  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  foot: {
    marginTop: 10,
  },
  notice: {
    marginTop: 4,
    marginLeft: 14,
  },
});
