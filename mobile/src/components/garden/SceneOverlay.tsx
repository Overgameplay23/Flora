import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { SkyTone } from "../../theme/tokens";
import { fonts, radius, surfaces, type } from "../../theme/tokens";

type SceneOverlayProps = {
  sky: SkyTone;
  /** safe-area top inset, for tab screens whose scene runs under the status bar */
  topInset: number;
  title: string;
  subtitle?: string | null;
  /** next to the title (a rename button) */
  titleAccessory?: React.ReactNode;
  /** top-right corner (stat chips) */
  right?: React.ReactNode;
};

/**
 * The header laid over a painted scene, as on Home: a soft veil of the hour's sky from the top edge so the
 * Fraunces title always has contrast, whatever the painting does behind it. Goes inside GardenStage.
 */
export default function SceneOverlay({ sky, topInset, title, subtitle, titleAccessory, right }: SceneOverlayProps) {
  return (
    <>
      <LinearGradient pointerEvents="none" colors={sky.veil} style={[styles.veil, { height: topInset + 140 }]} />
      <View style={[styles.header, { paddingTop: topInset + 12 }]} pointerEvents="box-none">
        <View style={styles.text} pointerEvents="box-none">
          <View style={styles.titleRow} pointerEvents="box-none">
            <Text style={[type.title, styles.title, { color: sky.text }]} accessibilityRole="header" numberOfLines={2}>
              {title}
            </Text>
            {titleAccessory}
          </View>
          {subtitle ? (
            <Text style={[type.meta, { color: sky.textSecondary }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </>
  );
}

/** A small paper chip over the scene: an icon in a tinted disc, a number and a word (Sprouts, days). */
export function SceneChip({ icon, iconColor, iconTint, value, label, night }: { icon: string; iconColor: string; iconTint: string; value: string; label: string; night: boolean }) {
  const surface = night ? surfaces.night : surfaces.light;
  return (
    <View style={[styles.chip, { backgroundColor: surface.paperOverScene, boxShadow: surface.shadow }]} accessible accessibilityLabel={`${value} ${label}`}>
      <View style={[styles.chipIcon, { backgroundColor: iconTint }]}>
        <Ionicons name={icon as any} size={14} color={iconColor} />
      </View>
      <Text style={[styles.chipValue, { color: surface.text }]}>{value}</Text>
      <Text style={[styles.chipLabel, { color: surface.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
  },
  text: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flexShrink: 1,
    marginBottom: 2,
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    minHeight: 32,
    borderRadius: radius.pill,
  },
  chipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  chipValue: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 14,
    marginRight: 4,
  },
  chipLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
  },
});
