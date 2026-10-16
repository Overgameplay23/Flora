import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "./PressableScale";
import IconTile from "./IconTile";
import { useTheme } from "../../theme/theme";
import { fonts, ink, radius, type } from "../../theme/tokens";

/** A paper card holding a run of rows (settings, links), separated by hairlines. */
export function ListGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { surface } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, { backgroundColor: surface.paper, boxShadow: surface.shadow }, style]}>
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <View style={[styles.separator, { backgroundColor: surface.hairline }]} /> : null}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}

type ListRowProps = {
  /** Ionicons glyph */
  icon?: string;
  /** care category that colours the icon tile */
  category?: string | null;
  label: string;
  hint?: string | null;
  badge?: string | null;
  onPress?: () => void;
  /** a control on the right (a Switch); replaces the chevron */
  right?: React.ReactNode;
  tone?: "default" | "danger";
  accessibilityLabel?: string;
};

/** One row: icon tile, label and hint, an optional badge, and a chevron when it goes somewhere. */
export function ListRow({ icon, category = "body", label, hint, badge, onPress, right, tone = "default", accessibilityLabel }: ListRowProps) {
  const theme = useTheme();
  const { surface } = theme;
  const danger = tone === "danger";
  const content = (
    <>
      {icon ? (
        danger ? (
          <View style={[styles.dangerTile, { backgroundColor: surface.sunken }]}>
            <Ionicons name={icon as any} size={18} color={theme.alert} />
          </View>
        ) : (
          <IconTile icon={icon} category={category} size={36} />
        )
      ) : null}
      <View style={styles.body}>
        <Text style={[type.callout, { color: danger ? theme.alert : surface.text, fontFamily: fonts.bodyBold }]}>{label}</Text>
        {hint ? (
          <Text style={[type.meta, styles.hint, { color: surface.textSecondary }]} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.bloom }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {right ?? (onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={surface.textTertiary} /> : null)}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} accessible={!right} accessibilityLabel={accessibilityLabel ?? [label, hint].filter(Boolean).join(". ")}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [label, hint, badge].filter(Boolean).join(". ")}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  separator: {
    height: 1,
    marginLeft: 62,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 60,
  },
  dangerTile: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
  },
  hint: {
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: {
    color: ink.primary,
    fontFamily: fonts.bodyHeavy,
    fontSize: 11,
  },
});
