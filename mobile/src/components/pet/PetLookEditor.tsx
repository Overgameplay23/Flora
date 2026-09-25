import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  COAT_SWATCHES,
  EAR_STYLES,
  EYE_SWATCHES,
  MARKINGS,
  NOSE_SWATCHES,
  PetLook,
  TAIL_STYLES,
  normalizeLook,
  presetsFor,
} from "../../domain/petLook";
import PetRig from "./vector/PetRig";

type PetLookEditorProps = {
  look: PetLook;
  onChange: (next: PetLook) => void;
  /** shown above the swatches, e.g. the photo the person picked, to match colours against */
  aside?: React.ReactNode;
  previewSize?: number;
};

const LABELS: Record<string, string> = {
  floppy: "Floppy",
  pointy: "Pointy",
  folded: "Folded",
  curl: "Curly",
  straight: "Straight",
  fluffy: "Fluffy",
  none: "Plain",
  patch: "Eye patch",
  mask: "Mask",
  socks: "Socks",
  tuxedo: "Tuxedo",
  tabby: "Tabby",
  round: "Round",
  slim: "Slim",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

function Swatch({ color, active, onPress, label }: { color: string; active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.swatch, { backgroundColor: color }, active && styles.swatchActive]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}>
      {active ? <Feather name="check" size={14} color={isLight(color) ? "#0f172a" : "#ffffff"} /> : null}
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/**
 * "Make it look like yours": presets, coat, eyes, nose, ears, tail, markings, build. The rig previews
 * every change live; the parent owns the look and decides when to save.
 */
export default function PetLookEditor({ look, onChange, aside, previewSize = 168 }: PetLookEditorProps) {
  const presets = useMemo(() => presetsFor(look.species), [look.species]);
  const set = (patch: Partial<PetLook>) => onChange(normalizeLook({ ...look, ...patch }, look.species));
  const coatId = COAT_SWATCHES.find((s) => s.coat === look.coat)?.id ?? null;

  return (
    <View>
      <View style={styles.previewRow}>
        <View style={styles.preview}>
          <PetRig look={look} size={previewSize} mood="happy" />
        </View>
        {aside ? <View style={styles.aside}>{aside}</View> : null}
      </View>

      <Section title="Start from">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {presets.map((preset) => {
            const active = JSON.stringify(preset.look) === JSON.stringify(look);
            return (
              <Pressable key={preset.id} onPress={() => onChange(preset.look)} style={[styles.preset, active && styles.presetActive]} accessibilityRole="button" accessibilityLabel={preset.label} accessibilityState={{ selected: active }}>
                <PetRig look={preset.look} size={56} mood="calm" reducedMotion />
                <Text style={styles.presetLabel}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Section>

      <Section title="Coat">
        {COAT_SWATCHES.map((s) => (
          <Swatch key={s.id} color={s.coat} label={s.label} active={coatId === s.id} onPress={() => set({ coat: s.coat, secondary: s.secondary, ear: s.ear })} />
        ))}
      </Section>

      <Section title="Eyes">
        {EYE_SWATCHES.map((s) => (
          <Swatch key={s.id} color={s.eye} label={s.label} active={look.eye === s.eye} onPress={() => set({ eye: s.eye })} />
        ))}
      </Section>

      <Section title="Nose">
        {NOSE_SWATCHES.map((s) => (
          <Swatch key={s.id} color={s.nose} label={s.label} active={look.nose === s.nose} onPress={() => set({ nose: s.nose })} />
        ))}
      </Section>

      <Section title="Ears">
        {EAR_STYLES[look.species].map((ears) => (
          <Chip key={ears} label={LABELS[ears]} active={look.ears === ears} onPress={() => set({ ears })} />
        ))}
      </Section>

      <Section title="Tail">
        {TAIL_STYLES[look.species].map((tail) => (
          <Chip key={tail} label={LABELS[tail]} active={look.tail === tail} onPress={() => set({ tail })} />
        ))}
      </Section>

      <Section title="Markings">
        {MARKINGS[look.species].map((marking) => (
          <Chip key={marking} label={LABELS[marking]} active={look.marking === marking} onPress={() => set({ marking })} />
        ))}
      </Section>

      <Section title="Build">
        {(["round", "slim"] as const).map((build) => (
          <Chip key={build} label={LABELS[build]} active={look.build === build} onPress={() => set({ build })} />
        ))}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  preview: {
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 8,
    borderRadius: 24,
    backgroundColor: "rgba(53,208,127,0.08)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  aside: { marginLeft: 14 },
  section: { marginTop: 14 },
  sectionTitle: { color: "rgba(148,163,184,0.95)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  presetRow: { paddingRight: 12 },
  preset: {
    alignItems: "center",
    marginRight: 8,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(18,24,38,0.95)",
    minWidth: 74,
  },
  presetActive: { borderColor: "#35d07f", backgroundColor: "rgba(53,208,127,0.14)" },
  presetLabel: { marginTop: 2, color: "#e2e8f0", fontSize: 11, fontWeight: "600" },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  swatchActive: { borderColor: "#35d07f", borderWidth: 3 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "rgba(148,163,184,0.35)", marginRight: 6, marginBottom: 6, backgroundColor: "rgba(18,24,38,0.95)" },
  chipActive: { backgroundColor: "rgba(53,208,127,0.2)", borderColor: "#35d07f" },
  chipText: { color: "#e2e8f0", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#a7f3d0" },
});
