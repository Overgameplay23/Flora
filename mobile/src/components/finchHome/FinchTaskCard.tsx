import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../common/PressableScale";
import { useTheme } from "../../theme/theme";
import { brand, fonts, ink, radius, springs, type } from "../../theme/tokens";

type FinchTaskCardProps = {
  title: string;
  /** what it adds to the garden ("10 pts") */
  reward: string;
  /** Ionicons glyph (outline set) */
  icon: string;
  /** care category that colours the card (default: body) */
  category?: string | null;
  /** shown in the meta line when known */
  minutes?: number | null;
  completed?: boolean;
  saving?: boolean;
  disabled?: boolean;
  /** a line under the card: an error to retry, or a queued note */
  notice?: { type: "error" | "queued"; message: string } | null;
  onToggle: () => void;
  onRetry?: () => void;
};

function minutesLabel(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 1) return "under a minute";
  return `${Math.round(minutes)} min`;
}

/**
 * A task row in the same language as Home's care cards (src/components/home/CareTaskCard.tsx): the card takes
 * its category's tint, the glyph sits in a soft tile, and a round check on the right fills when it is done.
 * The whole card and the check both tick it; done tasks stay, quieter, with a filled check.
 */
function FinchTaskCard({ title, reward, icon, category = "body", minutes = null, completed, saving, disabled, notice = null, onToggle, onRetry }: FinchTaskCardProps) {
  const theme = useTheme();
  const { surface } = theme;
  const tone = theme.tone(category);
  const done = !!completed;
  const off = !!disabled || !!saving || done;

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
  const checkScale = pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0.8, 1] });

  const meta = [tone.label, minutesLabel(minutes), reward].filter(Boolean).join(" · ");
  const checkLabel = completed ? `${title}, completed` : `Complete ${title}`;

  return (
    <View style={styles.outer}>
      <View style={[styles.card, { backgroundColor: tone.fill, boxShadow: surface.shadow, opacity: done ? 0.62 : 1 }]}>
        <PressableScale
          onPress={off ? undefined : onToggle}
          disabled={off}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${meta}${done ? ". Done" : ""}`}
          accessibilityState={{ disabled: off }}
          containerStyle={styles.mainSlot}
          style={styles.main}
        >
          <View style={[styles.tile, { backgroundColor: tone.tileOnFill }]}>
            <Ionicons name={icon as any} size={24} color={tone.accent} />
          </View>
          <View style={styles.body}>
            <Text style={[styles.meta, { color: tone.accent }]} numberOfLines={1}>
              {meta}
            </Text>
            <Text style={[type.bodyStrong, styles.title, { color: surface.text }, done && styles.titleDone]} numberOfLines={2}>
              {title}
            </Text>
          </View>
        </PressableScale>
        <Pressable
          onPress={off ? undefined : onToggle}
          disabled={off}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityLabel={checkLabel}
          accessibilityState={{ disabled: !!disabled, checked: done, busy: !!saving }}
        >
          <Animated.View
            style={[
              styles.check,
              {
                borderColor: tone.accent,
                backgroundColor: done ? tone.accent : theme.night ? "transparent" : tone.tileOnFill,
                transform: [{ scale: checkScale }],
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={tone.accent} />
            ) : done ? (
              <Ionicons name="checkmark" size={22} color={theme.night ? ink.primary : brand.cream} />
            ) : null}
          </Animated.View>
        </Pressable>
      </View>
      {notice ? (
        <Pressable
          onPress={notice.type === "error" ? onRetry : undefined}
          disabled={notice.type !== "error" || !onRetry}
          hitSlop={6}
          accessibilityRole={notice.type === "error" ? "button" : "text"}
        >
          <Text style={[type.meta, styles.notice, notice.type === "error" && styles.noticeLink, { color: notice.type === "error" ? theme.alert : surface.textSecondary }]}>{notice.message}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default React.memo(FinchTaskCard);

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
  noticeLink: {
    textDecorationLine: "underline",
  },
});
