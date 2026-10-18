// What the pet is wearing, drawn over it. The layer fills the pet's drawn box and sits inside the same animated
// view as the pet, so every item breathes, hops and wiggles with it. Placement is pure (src/domain/wardrobe/
// anchors.ts); the drawings come from the accessory art registry (./art).
import React, { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { accessoryArt } from "./art";
import { wardrobeItem } from "../../domain/wardrobe/catalog";
import { OUTFIT_DRAW_ORDER, placeItem, type ItemRect } from "../../domain/wardrobe/anchors";
import type { FitAdjust, OutfitSelection, OutfitSlot, PetAnchors } from "../../domain/wardrobe/types";

type OutfitLayerProps = {
  outfit: OutfitSelection | null | undefined;
  fit?: FitAdjust | null;
  anchors: PetAnchors;
  /** the pet's drawn box, in layout units */
  box: { width: number; height: number };
  /** draw only these slots (e.g. to put head items on a separately animated head layer) */
  only?: OutfitSlot[];
  style?: StyleProp<ViewStyle>;
};

type Placed = { slot: OutfitSlot; id: string; art: NonNullable<ReturnType<typeof accessoryArt>>; rect: ItemRect };

/** The worn items that can be drawn, back to front, with where each goes. Unknown ids and art keys are skipped. */
export function placeOutfit(
  outfit: OutfitSelection | null | undefined,
  fit: FitAdjust | null | undefined,
  anchors: PetAnchors,
  box: { width: number; height: number },
  only?: OutfitSlot[]
): Placed[] {
  if (!outfit || !anchors) return [];
  const placed: Placed[] = [];
  for (const slot of OUTFIT_DRAW_ORDER) {
    if (only && !only.includes(slot)) continue;
    const item = wardrobeItem(outfit[slot]);
    if (!item || item.slot !== slot) continue;
    const art = accessoryArt(item.art);
    if (!art || !art.Component) continue;
    const rect = placeItem(art, slot, anchors, box, fit?.[slot]);
    if (!(rect.width > 0) || !(rect.height > 0)) continue;
    placed.push({ slot, id: item.id, art, rect });
  }
  return placed;
}

/**
 * How far the worn items reach past the pet's box on each side, in layout units (0 when they fit). A container
 * that clips its children can pad by this much so a tall hat is not cut off.
 */
export function outfitOverhang(
  outfit: OutfitSelection | null | undefined,
  fit: FitAdjust | null | undefined,
  anchors: PetAnchors,
  box: { width: number; height: number }
): { top: number; left: number; right: number; bottom: number } {
  const reach = { top: 0, left: 0, right: 0, bottom: 0 };
  for (const { rect } of placeOutfit(outfit, fit, anchors, box)) {
    reach.top = Math.max(reach.top, -rect.top);
    reach.left = Math.max(reach.left, -rect.left);
    reach.right = Math.max(reach.right, rect.left + rect.width - box.width);
    reach.bottom = Math.max(reach.bottom, rect.top + rect.height - box.height);
  }
  return reach;
}

/** One drawing that throws must not take the pet down with it; it just is not drawn. */
class ItemBoundary extends React.Component<{ id: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn("WARDROBE_ART_FAILED", this.props.id, (error as any)?.message || String(error));
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function OutfitLayer({ outfit, fit, anchors, box, only, style }: OutfitLayerProps) {
  const placed = useMemo(
    () => placeOutfit(outfit, fit, anchors, box, only),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outfit, fit, anchors, box.width, box.height, only?.join(",")]
  );
  if (placed.length === 0) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.layer, { width: box.width, height: box.height }, style]}
    >
      {placed.map(({ slot, id, art, rect }) => {
        const Art = art.Component;
        return (
          <View key={slot} pointerEvents="none" style={[styles.item, rect]}>
            <ItemBoundary key={id} id={id}>
              <Art width={rect.width} height={rect.height} />
            </ItemBoundary>
          </View>
        );
      })}
    </View>
  );
}

export default React.memo(OutfitLayer);

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  item: {
    position: "absolute",
  },
});
