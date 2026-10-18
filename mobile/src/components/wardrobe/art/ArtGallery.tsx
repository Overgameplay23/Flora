// Dev-only design preview for the accessory art (?preview=wardrobe-art in src/screens/dev/DesignPreview.tsx):
// every item at two sizes on its tone's tinted tile with its name and art key, then every item placed on the
// plain reference head by its registry anchor and width, so placements can be eyeballed (the dashed line is the
// slot's reference width, the dot its anchor). Not used by the app itself.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import Screen from "../../common/Screen";
import { Eyebrow, Lead, ScreenTitle, SectionTitle } from "../../common/Headings";
import { useTheme } from "../../../theme/theme";
import { radius, type } from "../../../theme/tokens";
import { SLOT_LABELS, WARDROBE_ITEMS } from "../../../domain/wardrobe/catalog";
import type { OutfitSlot, WardrobeItem } from "../../../domain/wardrobe/types";
import { accessoryArt, artFrame } from "./index";
import { REFERENCE_BODY, REFERENCE_EYES, REFERENCE_HEAD, REFERENCE_SIZE, REFERENCE_SLOTS } from "./reference";

const SLOTS: OutfitSlot[] = ["head", "face", "neck"];
/** the part of the reference box each slot's diagram shows (tall hats need room above the head) */
const WINDOW: Record<OutfitSlot, { from: number; to: number }> = {
  head: { from: -84, to: 168 },
  face: { from: 30, to: 170 },
  neck: { from: 70, to: 232 },
};

/** Fit an item of the given aspect inside a square of `box`. */
function fitted(aspect: number, box: number) {
  const width = Math.min(box, box / aspect);
  return { width, height: width * aspect };
}

function ItemTile({ item }: { item: WardrobeItem }) {
  const theme = useTheme();
  const tone = theme.tone(item.tone);
  const art = accessoryArt(item.art);
  if (!art) {
    return (
      <View style={[styles.tile, { backgroundColor: theme.surface.sunken }]}>
        <Text style={[type.meta, { color: theme.alert }]}>No art for {item.art}</Text>
      </View>
    );
  }
  const large = fitted(art.aspect, 92);
  const small = fitted(art.aspect, 40);
  return (
    <View style={[styles.tile, { backgroundColor: tone.fill, boxShadow: theme.surface.shadow }]}>
      <View style={styles.sizes}>
        <View style={styles.large}>
          <art.Component width={large.width} height={large.height} />
        </View>
        <View style={styles.small}>
          <art.Component width={small.width} height={small.height} />
        </View>
      </View>
      <Text style={[type.meta, { color: theme.surface.text }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[type.micro, { color: tone.accent }]}>{item.art}</Text>
    </View>
  );
}

function ReferenceTile({ item }: { item: WardrobeItem }) {
  const theme = useTheme();
  const { surface } = theme;
  const art = accessoryArt(item.art);
  const slot = REFERENCE_SLOTS[item.slot];
  const win = WINDOW[item.slot];
  const height = win.to - win.from;
  const mark = theme.tone("focus").accent;
  const frame = art ? artFrame(art, { x: slot.x, y: slot.y }, slot.width) : null;
  return (
    <View style={[styles.reference, { backgroundColor: surface.paper, boxShadow: surface.shadow }]}>
      <View style={[styles.canvas, { width: REFERENCE_SIZE, height }]}>
        <Svg width={REFERENCE_SIZE} height={height} viewBox={`0 ${win.from} ${REFERENCE_SIZE} ${height}`} style={StyleSheet.absoluteFill}>
          <Path d={REFERENCE_BODY} fill={surface.sunken} stroke={surface.track} strokeWidth={1} />
          <Circle cx={REFERENCE_HEAD.cx} cy={REFERENCE_HEAD.cy} r={REFERENCE_HEAD.r} fill={surface.track} stroke={surface.hairline} strokeWidth={1} />
          <Circle cx={REFERENCE_HEAD.cx - REFERENCE_EYES.dx} cy={REFERENCE_EYES.y} r={REFERENCE_EYES.r} fill={surface.textSecondary} />
          <Circle cx={REFERENCE_HEAD.cx + REFERENCE_EYES.dx} cy={REFERENCE_EYES.y} r={REFERENCE_EYES.r} fill={surface.textSecondary} />
          <Path d="M95 112L105 112L100 118Z" fill={surface.textTertiary} />
        </Svg>
        {art && frame ? (
          <View pointerEvents="none" style={[styles.placed, { left: frame.left, top: frame.top - win.from, width: frame.width, height: frame.height }]}>
            <art.Component width={frame.width} height={frame.height} />
          </View>
        ) : null}
        <Svg width={REFERENCE_SIZE} height={height} viewBox={`0 ${win.from} ${REFERENCE_SIZE} ${height}`} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Line x1={slot.x - slot.width / 2} x2={slot.x + slot.width / 2} y1={slot.y} y2={slot.y} stroke={mark} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
          <Circle cx={slot.x} cy={slot.y} r={2.4} fill={mark} />
        </Svg>
      </View>
      <Text style={[type.meta, { color: surface.text }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[type.micro, { color: surface.textTertiary }]}>
        {art ? `anchor ${art.anchor.x}, ${art.anchor.y} · width x${art.widthScale}` : "no art"}
      </Text>
    </View>
  );
}

export default function WardrobeArtGallery() {
  const { surface } = useTheme();
  return (
    <Screen topInset>
      <ScreenTitle>Wardrobe art</ScreenTitle>
      <Lead style={styles.lead}>Every accessory at two sizes, then on the reference head by its anchor and width.</Lead>

      <SectionTitle>All items</SectionTitle>
      <View style={styles.grid}>
        {WARDROBE_ITEMS.map((item) => (
          <ItemTile key={item.id} item={item} />
        ))}
      </View>

      <SectionTitle>On the reference head</SectionTitle>
      {SLOTS.map((slot) => (
        <View key={slot} style={styles.group}>
          <Eyebrow style={styles.eyebrow} color={surface.textSecondary}>
            {SLOT_LABELS[slot]}
          </Eyebrow>
          <View style={styles.grid}>
            {WARDROBE_ITEMS.filter((item) => item.slot === slot).map((item) => (
              <ReferenceTile key={item.id} item={item} />
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {
    marginTop: 6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tile: {
    width: 164,
    padding: 12,
    gap: 2,
    borderRadius: radius.tile,
    borderCurve: "continuous",
  },
  sizes: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 100,
    marginBottom: 6,
  },
  large: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  small: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  group: {
    marginBottom: 18,
  },
  eyebrow: {
    marginBottom: 8,
  },
  reference: {
    padding: 10,
    gap: 2,
    borderRadius: radius.tile,
    borderCurve: "continuous",
  },
  canvas: {
    overflow: "hidden",
    marginBottom: 6,
  },
  placed: {
    position: "absolute",
  },
});
