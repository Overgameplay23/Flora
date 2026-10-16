import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import Chip from "../common/Chip";
import PressableScale from "../common/PressableScale";
import { useTheme } from "../../theme/theme";
import { brand, fonts, ink, radius, type } from "../../theme/tokens";
import { selection } from "../../utils/haptics";

type PetLookEditorProps = {
  look: PetLook;
  onChange: (next: PetLook) => void;
  /** shown beside the preview, e.g. the photo the person picked, to match colours against */
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

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function Section({ title, children, color }: { title: string; children: React.ReactNode; color: string }) {
  return (
    <View style={styles.section}>
      <Text style={[type.micro, styles.sectionTitle, { color }]}>{title.toUpperCase()}</Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

function Swatch({ color, active, onPress, label, ring }: { color: string; active: boolean; onPress: () => void; label: string; ring: string }) {
  return (
    <Pressable
      onPress={() => {
        selection();
        onPress();
      }}
      style={[styles.swatch, { backgroundColor: color, borderColor: active ? ring : "rgba(74,52,40,0.14)", borderWidth: active ? 3 : 2 }]}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={4}
    >
      {active ? <Ionicons name="checkmark" size={16} color={isLight(color) ? ink.primary : brand.cream} /> : null}
    </Pressable>
  );
}

/**
 * "Make it look like yours": presets, coat, eyes, nose, ears, tail, markings, build. The rig previews
 * every change live; the parent owns the look and decides when to save. Paper and tokens from the design
 * system; the connection rose marks what is picked.
 */
export default function PetLookEditor({ look, onChange, aside, previewSize = 168 }: PetLookEditorProps) {
  const theme = useTheme();
  const { surface, night } = theme;
  const tone = theme.tone("connection");
  const presets = useMemo(() => presetsFor(look.species), [look.species]);
  const set = (patch: Partial<PetLook>) => onChange(normalizeLook({ ...look, ...patch }, look.species));
  const coatId = COAT_SWATCHES.find((s) => s.coat === look.coat)?.id ?? null;

  return (
    <View>
      <View style={styles.previewRow}>
        <View style={[styles.preview, { backgroundColor: night ? surface.sunken : theme.tone("body").fill }]}>
          <PetRig look={look} size={previewSize} mood="happy" />
        </View>
        {aside ? <View style={styles.aside}>{aside}</View> : null}
      </View>

      <Section title="Start from" color={surface.textTertiary}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {presets.map((preset) => {
            const active = JSON.stringify(preset.look) === JSON.stringify(look);
            return (
              <PressableScale
                key={preset.id}
                onPress={() => {
                  selection();
                  onChange(preset.look);
                }}
                pressedScale={0.96}
                accessibilityRole="radio"
                accessibilityLabel={preset.label}
                accessibilityState={{ selected: active }}
                style={[
                  styles.preset,
                  { backgroundColor: active ? tone.fill : surface.paper, borderColor: active ? tone.accent : surface.hairline, boxShadow: active ? "none" : surface.shadow },
                ]}
              >
                <PetRig look={preset.look} size={56} mood="calm" reducedMotion />
                <Text style={[styles.presetLabel, { color: active ? tone.accent : surface.textSecondary }]}>{preset.label}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </Section>

      <Section title="Coat" color={surface.textTertiary}>
        {COAT_SWATCHES.map((s) => (
          <Swatch key={s.id} color={s.coat} label={s.label} ring={tone.accent} active={coatId === s.id} onPress={() => set({ coat: s.coat, secondary: s.secondary, ear: s.ear })} />
        ))}
      </Section>

      <Section title="Eyes" color={surface.textTertiary}>
        {EYE_SWATCHES.map((s) => (
          <Swatch key={s.id} color={s.eye} label={s.label} ring={tone.accent} active={look.eye === s.eye} onPress={() => set({ eye: s.eye })} />
        ))}
      </Section>

      <Section title="Nose" color={surface.textTertiary}>
        {NOSE_SWATCHES.map((s) => (
          <Swatch key={s.id} color={s.nose} label={s.label} ring={tone.accent} active={look.nose === s.nose} onPress={() => set({ nose: s.nose })} />
        ))}
      </Section>

      <Section title="Ears" color={surface.textTertiary}>
        {EAR_STYLES[look.species].map((ears) => (
          <Chip key={ears} label={LABELS[ears]} selected={look.ears === ears} onPress={() => set({ ears })} category="connection" style={styles.chip} />
        ))}
      </Section>

      <Section title="Tail" color={surface.textTertiary}>
        {TAIL_STYLES[look.species].map((tail) => (
          <Chip key={tail} label={LABELS[tail]} selected={look.tail === tail} onPress={() => set({ tail })} category="connection" style={styles.chip} />
        ))}
      </Section>

      <Section title="Markings" color={surface.textTertiary}>
        {MARKINGS[look.species].map((marking) => (
          <Chip key={marking} label={LABELS[marking]} selected={look.marking === marking} onPress={() => set({ marking })} category="connection" style={styles.chip} />
        ))}
      </Section>

      <Section title="Build" color={surface.textTertiary}>
        {(["round", "slim"] as const).map((build) => (
          <Chip key={build} label={LABELS[build]} selected={look.build === build} onPress={() => set({ build })} category="connection" style={styles.chip} />
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
    padding: 10,
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  aside: { marginLeft: 14 },
  section: { marginTop: 16 },
  sectionTitle: { marginBottom: 8, marginLeft: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  presetRow: { paddingRight: 12 },
  preset: {
    alignItems: "center",
    marginRight: 8,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    borderRadius: radius.tile,
    borderCurve: "continuous",
    borderWidth: 1.5,
    minWidth: 76,
  },
  presetLabel: { marginTop: 2, fontFamily: fonts.bodyBold, fontSize: 11 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: { marginRight: 6, marginBottom: 6 },
});
