// The Wardrobe (outfit shop) data model. Items are drawn as layers over the user's own pet (the painted
// portrait or the rig) at anchor points, so trying something on is instant and free; buying costs Sprouts,
// which are only ever earned through care (docs/ROADMAP.md, "Wardrobe"). Real-money items come later with a
// development build (owner, 2026-10-15: "Sprouts now, $ later").

import type { CareCategory } from "../plan/types";

/** Where an item sits on the pet. One item per slot can be worn at a time. */
export type OutfitSlot = "head" | "face" | "neck";

export type WardrobeCategory = "hats" | "glasses" | "neckwear";

export type Rarity = "common" | "uncommon" | "rare";

export type WardrobeItem = {
  /** stable slug, also the database id (wardrobe_items.id) */
  id: string;
  name: string;
  /** one cozy line for the item card */
  description: string;
  slot: OutfitSlot;
  category: WardrobeCategory;
  /** 0 = a free starter item, claimed instead of bought */
  priceSprouts: number;
  rarity: Rarity;
  species: Array<"dog" | "cat">;
  /** e.g. "Everyday", "Autumn"; seasonal collections return every year and the app says so */
  collection: string;
  /** card colour */
  tone: CareCategory;
  /** key into the accessory art registry (src/components/wardrobe/art) */
  art: string;
  /** reserved for real-money items; never purchasable with Sprouts */
  premium?: boolean;
};

/** What the pet wears: one item id per slot. */
export type OutfitSelection = Partial<Record<OutfitSlot, string>>;

/**
 * Per-slot nudge the person made with "Adjust fit", relative to the automatic anchor: dx/dy as a fraction of
 * the pet's drawn box, scale as a multiplier (1 = automatic size).
 */
export type FitAdjust = Partial<Record<OutfitSlot, { dx: number; dy: number; scale: number }>>;

/**
 * Where the slots are on a pet, normalized to the pet's drawn box (0..1 of its width / height, origin top-left).
 * `width` is the reference width an item scales to (head width, eye span, neck width).
 */
export type PetAnchors = {
  head: { cx: number; top: number; width: number };
  face: { cx: number; cy: number; width: number };
  neck: { cx: number; cy: number; width: number };
};
