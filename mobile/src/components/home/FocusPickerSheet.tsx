import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../common/PressableScale";
import PetMascot from "../pet/PetMascot";
import { FOCUS_AREAS } from "../../domain/plan/focusAreas";
import type { FocusArea } from "../../domain/plan/types";
import { brand, categoryTone, fonts, ink, radius, surfaces, type } from "../../theme/tokens";
import { selection } from "../../utils/haptics";

const MAX_FOCUS = 3;

type FocusPickerSheetProps = {
  visible: boolean;
  initial: FocusArea[];
  petName: string;
  saving?: boolean;
  onSave: (areas: FocusArea[]) => void;
  onClose: () => void;
};

/**
 * "What would you like help with?" Up to three areas, in the order picked; the first leads. Until the
 * onboarding quiz exists this is how the plan engine learns what to build the days around.
 */
export default function FocusPickerSheet({ visible, initial, petName, saving = false, onSave, onClose }: FocusPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<FocusArea[]>(initial);
  const [hint, setHint] = useState<string | null>(null);
  // start from the saved choice each time the sheet opens, and only then: re-renders behind an open sheet
  // (data landing on Home) must never wipe what the person is picking
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setPicked(initial);
      setHint(null);
    }
    wasVisible.current = visible;
  }, [initial, visible]);

  const toggle = (id: FocusArea) => {
    selection();
    setHint(null);
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((area) => area !== id);
      if (prev.length >= MAX_FOCUS) {
        setHint("Three is plenty. Unpick one to swap it.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const surface = surfaces.light;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: surface.canvas, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={[type.title, { color: surface.text }]}>What would you like help with?</Text>
                <Text style={[type.callout, styles.lead, { color: surface.textSecondary }]}>
                  Pick up to three. {petName} will build your days around them, starting with the first.
                </Text>
              </View>
              <PetMascot size={74} mood="happy" showShadow={false} />
            </View>

            <View style={styles.grid}>
              {FOCUS_AREAS.map((area) => {
                const tone = categoryTone(area.category);
                const rank = picked.indexOf(area.id);
                const on = rank >= 0;
                return (
                  <PressableScale
                    key={area.id}
                    onPress={() => toggle(area.id)}
                    pressedScale={0.96}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${area.label}. ${area.blurb}`}
                    style={[styles.option, { backgroundColor: on ? tone.tint : surface.paper, borderColor: on ? tone.strong : surface.hairline, boxShadow: on ? "none" : surface.shadow }]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: on ? "rgba(255,255,255,0.75)" : tone.tint }]}>
                      <Ionicons name={area.icon as any} size={22} color={tone.strong} />
                    </View>
                    <View style={styles.optionBody}>
                      <Text style={[type.bodyStrong, { color: surface.text }]}>{area.label}</Text>
                      <Text style={[type.meta, { color: surface.textSecondary }]} numberOfLines={2}>
                        {area.blurb}
                      </Text>
                    </View>
                    <View style={[styles.rank, { borderColor: on ? tone.strong : surface.track, backgroundColor: on ? tone.strong : "transparent" }]}>
                      {on ? <Text style={styles.rankText}>{rank + 1}</Text> : null}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {hint ? <Text style={[type.meta, styles.hint, { color: brand.ember }]}>{hint}</Text> : null}
            <PressableScale
              onPress={() => (picked.length > 0 && !saving ? onSave(picked) : undefined)}
              disabled={picked.length === 0 || saving}
              accessibilityRole="button"
              accessibilityLabel="Build my plan"
              style={[styles.cta, { backgroundColor: picked.length === 0 ? surface.track : brand.bloom }]}
            >
              <Text style={styles.ctaText}>{saving ? "Building..." : picked.length === 0 ? "Pick at least one" : "Build my plan"}</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(32,24,40,0.42)",
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: "continuous",
    paddingTop: 8,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(46,40,56,0.18)",
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
  },
  lead: {
    marginTop: 6,
  },
  grid: {
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radius.row,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.tile - 2,
    alignItems: "center",
    justifyContent: "center",
  },
  optionBody: {
    flex: 1,
    marginHorizontal: 12,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    color: brand.cream,
    fontFamily: fonts.bodyHeavy,
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  hint: {
    textAlign: "center",
    marginBottom: 8,
  },
  cta: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: ink.primary,
    fontFamily: fonts.bodyHeavy,
    fontSize: 16,
  },
});
