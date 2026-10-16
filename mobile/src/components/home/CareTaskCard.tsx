import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../common/PressableScale";
import { brand, categoryTone, fonts, ink, radius, springs, type, type Surface } from "../../theme/tokens";

export type CareTaskCardProps = {
  title: string;
  category: string;
  /** Ionicons glyph */
  icon: string;
  minutes: number;
  /** why this is on today's list ("For your sleep"); hidden when null */
  reason?: string | null;
  done: boolean;
  saving?: boolean;
  notice?: { type: "error" | "queued"; message: string } | null;
  /** the task opens its own screen (breathing, journal, a game); it is ticked when the person comes back */
  opens?: boolean;
  onComplete: () => void;
  onOpen?: () => void;
  onRetry?: () => void;
  /** press and hold (the person's own tasks: put it away) */
  onLongPress?: () => void;
  surface: Surface;
};

function minutesLabel(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 1) return "under a minute";
  return `${Math.round(minutes)} min`;
}

/**
 * One care task, coloured by its category so the day reads at a glance. The whole card is the target
 * (ticks it, or opens its screen for breathing/journal/play tasks); the round check on the right always
 * ticks it. Done tasks stay visible, quieter, with a filled check.
 */
export default function CareTaskCard({
  title,
  category,
  icon,
  minutes,
  reason,
  done,
  saving = false,
  notice = null,
  opens = false,
  onComplete,
  onOpen,
  onRetry,
  onLongPress,
  surface,
}: CareTaskCardProps) {
  const tone = categoryTone(category);
  const pop = useRef(new Animated.Value(done ? 1 : 0)).current;
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current) {
      pop.setValue(0.4);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...springs.bouncy }).start();
    } else if (!done) {
      pop.setValue(0);
    }
    wasDone.current = done;
  }, [done, pop]);

  const night = surface.isNight;
  const cardBg = night ? surface.paper : tone.tint;
  const accent = night ? tone.mid : tone.strong;
  const meta = [tone.label, minutesLabel(minutes)].filter(Boolean).join(" · ");
  const checkScale = pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0.8, 1] });

  // Two sibling targets (never one inside the other): the card body, and the round check on the right.
  return (
    <View style={styles.outer}>
      <View style={[styles.card, { backgroundColor: cardBg, boxShadow: surface.shadow, opacity: done ? 0.62 : 1 }]}>
        <PressableScale
          onPress={done || saving ? undefined : opens && onOpen ? onOpen : onComplete}
          onLongPress={onLongPress}
          delayLongPress={onLongPress ? 350 : undefined}
          disabled={(done || saving) && !onLongPress}
          accessibilityRole="button"
          accessibilityHint={onLongPress ? "Press and hold to put this away" : undefined}
          accessibilityLabel={`${title}. ${meta}${done ? ". Done" : opens ? ". Opens" : ""}`}
          accessibilityState={{ disabled: done || saving }}
          containerStyle={styles.mainSlot}
          style={styles.main}
        >
          <View style={[styles.tile, { backgroundColor: night ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)" }]}>
            <Ionicons name={icon as any} size={26} color={accent} />
          </View>
          <View style={styles.body}>
            <Text style={[styles.meta, { color: accent }]} numberOfLines={1}>
              {meta}
            </Text>
            <Text style={[type.bodyStrong, styles.title, { color: surface.text }, done && styles.titleDone]} numberOfLines={2}>
              {title}
            </Text>
            {reason && !done ? (
              <Text style={[type.meta, { color: surface.textSecondary }]} numberOfLines={1}>
                {reason}
              </Text>
            ) : null}
          </View>
        </PressableScale>
        <Pressable
          onPress={done || saving ? undefined : opens && onOpen ? onOpen : onComplete}
          hitSlop={8}
          accessibilityRole={opens && !done ? "button" : "checkbox"}
          accessibilityLabel={done ? `${title}, done` : opens ? `Start ${title}` : `Mark ${title} done`}
          accessibilityState={{ checked: done, disabled: done || saving }}
        >
          <Animated.View
            style={[
              styles.check,
              { borderColor: accent, backgroundColor: done ? accent : night ? "transparent" : "rgba(255,255,255,0.85)", transform: [{ scale: checkScale }] },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={accent} />
            ) : done ? (
              <Ionicons name="checkmark" size={22} color={night ? ink.primary : brand.cream} />
            ) : opens ? (
              <Ionicons name="arrow-forward" size={18} color={accent} />
            ) : null}
          </Animated.View>
        </Pressable>
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
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 14,
    borderRadius: radius.row,
    borderCurve: "continuous",
    minHeight: 76,
  },
  mainSlot: {
    flex: 1,
    alignSelf: "stretch",
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingRight: 0,
  },
  tile: {
    width: 52,
    height: 52,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    marginHorizontal: 12,
  },
  meta: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    marginTop: 1,
  },
  titleDone: {
    textDecorationLine: "line-through",
  },
  check: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    marginTop: 4,
    marginLeft: 14,
  },
});
