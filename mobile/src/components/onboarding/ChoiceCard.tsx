import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../common/PressableScale";
import { useTheme } from "../../theme/theme";
import { brand, fonts, ink, radius, type } from "../../theme/tokens";
import { selection } from "../../utils/haptics";

type ChoiceCardProps = {
  label: string;
  blurb?: string | null;
  /** Ionicons glyph */
  icon?: string;
  /** care category whose colours the card borrows */
  category?: string | null;
  selected: boolean;
  /** 1-based pick order for multi-select questions; shown in the badge */
  rank?: number | null;
  onPress: () => void;
  accessibilityLabel?: string;
  /** anything under the text (a sample line in the pet's voice) */
  children?: React.ReactNode;
};

/**
 * One answer in the onboarding quiz: an icon tile, a label and a blurb on a card that fills with its
 * category's tint when picked. Multi-select questions show the pick order; single ones a check.
 */
export default function ChoiceCard({ label, blurb, icon, category = "body", selected, rank = null, onPress, accessibilityLabel, children }: ChoiceCardProps) {
  const theme = useTheme();
  const { surface, night } = theme;
  const tone = theme.tone(category);
  const multi = rank !== null && rank !== undefined;
  return (
    <PressableScale
      onPress={() => {
        selection();
        onPress();
      }}
      pressedScale={0.97}
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={accessibilityLabel ?? (blurb ? `${label}. ${blurb}` : label)}
      style={[
        styles.card,
        {
          backgroundColor: selected ? tone.fill : surface.paper,
          borderColor: selected ? tone.accent : surface.hairline,
          boxShadow: selected ? "none" : surface.shadow,
        },
      ]}
    >
      <View style={styles.row}>
        {icon ? (
          <View style={[styles.tile, { backgroundColor: selected ? tone.tileOnFill : night ? surface.sunken : tone.tint }]}>
            <Ionicons name={icon as any} size={22} color={tone.accent} />
          </View>
        ) : null}
        <View style={styles.body}>
          <Text style={[type.bodyStrong, { color: surface.text }]}>{label}</Text>
          {blurb ? (
            <Text style={[type.meta, { color: surface.textSecondary }]} numberOfLines={3}>
              {blurb}
            </Text>
          ) : null}
        </View>
        <View style={[styles.badge, { borderColor: selected ? tone.accent : surface.track, backgroundColor: selected ? tone.accent : "transparent" }]}>
          {selected ? multi ? <Text style={styles.badgeText}>{rank! > 0 ? rank : "✓"}</Text> : <Ionicons name="checkmark" size={16} color={night ? ink.primary : brand.cream} /> : null}
        </View>
      </View>
      {children ? <View style={styles.extra}>{children}</View> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: radius.row,
    borderCurve: "continuous",
    borderWidth: 1.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.tile - 2,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    marginHorizontal: 12,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: brand.cream,
    fontFamily: fonts.bodyHeavy,
    fontSize: 13,
  },
  extra: {
    marginTop: 10,
    marginLeft: 56,
  },
});
