import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../common/PressableScale";
import { ENERGY_OPTIONS, energyOption } from "../../domain/energy";
import type { Energy } from "../../domain/plan/types";
import { categoryTone, fonts, radius, type, type Surface } from "../../theme/tokens";
import { selection } from "../../utils/haptics";

type EnergyCheckProps = {
  value: Energy | null;
  onChange: (energy: Energy) => void;
  surface: Surface;
  petName: string;
};

/**
 * One tap: how much battery is there today? The answer reshapes the plan (drained or on edge = fewer,
 * gentler things) and how the pet carries itself. Once answered it folds into a small chip.
 */
export default function EnergyCheck({ value, onChange, surface, petName }: EnergyCheckProps) {
  const [editing, setEditing] = useState(false);
  const chosen = energyOption(value);

  if (chosen && !editing) {
    const tone = categoryTone(chosen.category);
    return (
      <View style={[styles.folded, { backgroundColor: surface.paper, boxShadow: surface.shadow }]}>
        <View style={[styles.foldedIcon, { backgroundColor: tone.tint }]}>
          <Ionicons name={chosen.icon as any} size={18} color={tone.strong} />
        </View>
        <Text style={[type.callout, styles.foldedText, { color: surface.text }]}>
          Feeling <Text style={{ fontFamily: fonts.bodyHeavy, color: surface.isNight ? tone.mid : tone.strong }}>{chosen.label.toLowerCase()}</Text> today
        </Text>
        <Pressable onPress={() => setEditing(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Change how you're feeling">
          <Text style={[type.meta, { color: surface.textSecondary }]}>Change</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: surface.paper, boxShadow: surface.shadow }]}>
      <Text style={[type.h3, { color: surface.text }]}>How's your battery?</Text>
      <Text style={[type.meta, styles.sub, { color: surface.textSecondary }]}>
        {petName} will shape today around it.
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {ENERGY_OPTIONS.map((option) => {
          const tone = categoryTone(option.category);
          const selected = option.id === value;
          const night = surface.isNight;
          const accent = night ? tone.mid : tone.strong;
          return (
            <PressableScale
              key={option.id}
              pressedScale={0.94}
              onPress={() => {
                selection();
                setEditing(false);
                onChange(option.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={option.label}
              containerStyle={styles.optionSlot}
              style={[styles.option, { backgroundColor: night ? surface.sunken : tone.tint, borderColor: selected ? accent : "transparent" }]}
            >
              <View style={[styles.optionIcon, night && { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                <Ionicons name={option.icon as any} size={22} color={accent} />
              </View>
              <Text style={[styles.optionLabel, { color: accent }]} numberOfLines={2}>
                {option.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 16,
  },
  sub: {
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  optionSlot: {
    flex: 1,
  },
  option: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.tile + 2,
    borderCurve: "continuous",
    borderWidth: 2,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    marginTop: 6,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  folded: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    paddingLeft: 6,
    paddingRight: 16,
    paddingVertical: 6,
  },
  foldedIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  foldedText: {
    flex: 1,
  },
});
