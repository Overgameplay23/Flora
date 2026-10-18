import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../common/PressableScale";
import PetMascot from "../pet/PetMascot";
import { brand, categories, fonts, ink, radius, type, type Surface } from "../../theme/tokens";

/** Shown until focus areas are chosen: the plan engine's front door before onboarding exists. */
export function FocusPromptCard({ petName, onPress, surface }: { petName: string; onPress: () => void; surface: Surface }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Choose what you want help with" style={[styles.promptCard, { boxShadow: surface.shadow }]}>
      <LinearGradient colors={[categories.calm.tint, categories.connection.tint, categories.play.tint]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.promptFill}>
        <View style={styles.promptText}>
          <Text style={[type.h3, { color: ink.primary }]}>What would you like help with?</Text>
          <Text style={[type.meta, styles.promptSub, { color: ink.secondary }]}>
            Pick up to three things. {petName} will build each day around them.
          </Text>
          <View style={styles.promptCta}>
            <Text style={styles.promptCtaText}>Choose my focus</Text>
            <Ionicons name="arrow-forward" size={16} color={ink.primary} />
          </View>
        </View>
        <PetMascot size={84} mood="excited" showShadow={false} />
      </LinearGradient>
    </PressableScale>
  );
}

/** Everything for today is done: the pet takes the stage, nothing else is asked for. */
export function AllDoneCard({ petName, surface }: { petName: string; surface: Surface }) {
  return (
    <View style={[styles.doneCard, { backgroundColor: surface.isNight ? surface.paper : categories.body.tint, boxShadow: surface.shadow }]} accessible accessibilityLabel={`All cared for. ${petName} is proud of you.`}>
      <View style={[styles.doneIcon, { backgroundColor: brand.sprout }]}>
        <Ionicons name="checkmark" size={22} color={brand.cream} />
      </View>
      <View style={styles.doneText}>
        <Text style={[type.bodyStrong, { color: surface.text }]}>All cared for today</Text>
        <Text style={[type.meta, { color: surface.textSecondary }]}>{petName} is proud of you. The rest of the day is yours.</Text>
      </View>
    </View>
  );
}

type MemorialCardProps = {
  reflection: string;
  onMemories: () => void;
  onQuiet: () => void;
  onCheckIn: () => void;
  surface: Surface;
};

/** Memorial mode: tasks pause; a reflection and three gentle doors stay open. */
export function MemorialCard({ reflection, onMemories, onQuiet, onCheckIn, surface }: MemorialCardProps) {
  return (
    <View style={[styles.memorialCard, { backgroundColor: surface.paper, boxShadow: surface.shadow }]}>
      <Text style={[type.body, { color: surface.text }]}>{reflection}</Text>
      <Text style={[type.meta, styles.memorialMeta, { color: surface.textSecondary }]}>
        Daily care is paused. Check-ins and quiet minutes are still here whenever you want them.
      </Text>
      <View style={styles.memorialActions}>
        <PressableScale onPress={onMemories} accessibilityRole="button" style={[styles.pill, { backgroundColor: brand.plum }]}>
          <Text style={[styles.pillText, { color: brand.cream }]}>Memories</Text>
        </PressableScale>
        <PressableScale onPress={onQuiet} accessibilityRole="button" style={[styles.pill, { backgroundColor: surface.sunken }]}>
          <Text style={[styles.pillText, { color: surface.text }]}>One quiet minute</Text>
        </PressableScale>
        <PressableScale onPress={onCheckIn} accessibilityRole="button" style={[styles.pill, { backgroundColor: surface.sunken }]}>
          <Text style={[styles.pillText, { color: surface.text }]}>Check in</Text>
        </PressableScale>
      </View>
    </View>
  );
}

/** Small section heading inside the Home sheet. */
export function SectionTitle({ children, surface }: { children: React.ReactNode; surface: Surface }) {
  return (
    <Text style={[type.h2, styles.sectionTitle, { color: surface.text }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  promptCard: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
    marginBottom: 12,
  },
  promptFill: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    paddingBottom: 12,
  },
  promptText: {
    flex: 1,
    paddingRight: 8,
    paddingBottom: 4,
  },
  promptSub: {
    marginTop: 4,
  },
  promptCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: brand.bloom,
  },
  promptCtaText: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 14,
    color: ink.primary,
  },
  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: radius.row,
    borderCurve: "continuous",
    marginBottom: 10,
  },
  doneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    flex: 1,
    marginLeft: 12,
  },
  memorialCard: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: 18,
  },
  memorialMeta: {
    marginTop: 10,
  },
  memorialActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 12,
  },
});
