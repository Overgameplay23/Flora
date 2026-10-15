import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../common/PressableScale";
import { brand, categoryTone, fonts, radius, type, type Surface } from "../../theme/tokens";

type CareTrayHeaderProps = {
  title: string;
  done: number;
  total: number;
  /** e.g. "Sleep · Calm"; null before focus areas were chosen */
  focusLabel: string | null;
  focusCategory?: string | null;
  onOpenFocus: () => void;
  surface: Surface;
};

/** "Today's care", the plan's focus as a tappable chip, and one petal per task that fills as it is done. */
export default function CareTrayHeader({ title, done, total, focusLabel, focusCategory, onOpenFocus, surface }: CareTrayHeaderProps) {
  const tone = categoryTone(focusCategory || "calm");
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[type.h2, styles.title, { color: surface.text }]} accessibilityRole="header">
          {title}
        </Text>
        <PressableScale
          onPress={onOpenFocus}
          pressedScale={0.94}
          containerStyle={styles.focusSlot}
          accessibilityRole="button"
          accessibilityLabel={focusLabel ? `Your focus: ${focusLabel}. Change` : "Choose what you want help with"}
          style={[styles.focusChip, { backgroundColor: surface.isNight ? surface.paper : tone.tint }]}
        >
          <Ionicons name="compass-outline" size={15} color={surface.isNight ? tone.mid : tone.strong} />
          <Text style={[styles.focusText, { color: surface.isNight ? tone.mid : tone.strong }]} numberOfLines={1}>
            {focusLabel || "Choose focus"}
          </Text>
          <Ionicons name="chevron-down" size={14} color={surface.isNight ? tone.mid : tone.strong} />
        </PressableScale>
      </View>
      {total > 0 ? (
        <View style={styles.progressRow} accessible accessibilityLabel={`${done} of ${total} done`}>
          <View style={styles.petals}>
            {Array.from({ length: total }).map((_, index) => (
              <View
                key={index}
                style={[styles.petal, { backgroundColor: index < done ? brand.sprout : surface.track }]}
              />
            ))}
          </View>
          <Text style={[type.meta, { color: surface.textSecondary }]}>
            {done >= total ? "All cared for" : `${done} of ${total} done`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    flexShrink: 1,
  },
  focusSlot: {
    flexShrink: 1,
  },
  focusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: radius.pill,
    maxWidth: 190,
  },
  focusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    flexShrink: 1,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 10,
  },
  petals: {
    flexDirection: "row",
    gap: 5,
  },
  petal: {
    width: 22,
    height: 8,
    borderRadius: 4,
  },
});
