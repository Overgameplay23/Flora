// The fitting room's rules, kept pure so they are easy to test: what the pet is trying on, and what the one
// main button should offer (wear the look, get an item, claim a gift, or say kindly that it isn't time yet).

import { inSeason, wardrobeItem } from "./catalog";
import type { OutfitSelection, OutfitSlot, WardrobeItem } from "./types";

const SLOTS: OutfitSlot[] = ["head", "face", "neck"];

/** Put an item on, or take it off if it is already on. One item per slot. */
export function toggleItem(outfit: OutfitSelection, item: WardrobeItem): OutfitSelection {
  const next: OutfitSelection = { ...outfit };
  if (next[item.slot] === item.id) delete next[item.slot];
  else next[item.slot] = item.id;
  return next;
}

export function takeOff(outfit: OutfitSelection, slot: OutfitSlot): OutfitSelection {
  const next: OutfitSelection = { ...outfit };
  delete next[slot];
  return next;
}

/** Drops ids that are not in the catalog (an item retired from the shop, a stale cache). */
export function cleanOutfit(outfit: OutfitSelection | null | undefined): OutfitSelection {
  const next: OutfitSelection = {};
  for (const slot of SLOTS) {
    const id = outfit?.[slot];
    const item = wardrobeItem(id);
    if (item && item.slot === slot) next[slot] = item.id;
  }
  return next;
}

export function sameOutfit(a: OutfitSelection, b: OutfitSelection): boolean {
  return SLOTS.every((slot) => (a[slot] ?? null) === (b[slot] ?? null));
}

export type FittingCta =
  /** the pet already wears exactly this */
  | { kind: "wearing" }
  /** everything on is owned; save it as the look */
  | { kind: "wear" }
  /** a free starter that is not claimed yet */
  | { kind: "claim"; item: WardrobeItem }
  | { kind: "buy"; item: WardrobeItem; price: number }
  /** not enough Sprouts yet: how many more */
  | { kind: "short"; item: WardrobeItem; price: number; missing: number }
  /** a seasonal item out of its season (it comes back every year) */
  | { kind: "season"; item: WardrobeItem }
  /** this backend has no Wardrobe yet: trying on works, keeping does not */
  | { kind: "notReady"; item: WardrobeItem };

/**
 * What the main button offers. An unowned item on the pet comes first (the one tried most recently, else the
 * first slot in head-face-neck order); with everything owned it is "wear" or "wearing".
 */
export function fittingCta(input: {
  worn: OutfitSelection;
  trying: OutfitSelection;
  owned: string[];
  balance: number | null;
  serverReady: boolean;
  lastTriedId?: string | null;
  month?: number;
}): FittingCta {
  const owned = new Set(input.owned);
  const unowned = SLOTS.map((slot) => wardrobeItem(input.trying[slot])).filter((item): item is WardrobeItem => !!item && !owned.has(item.id));
  if (unowned.length === 0) return sameOutfit(input.worn, input.trying) ? { kind: "wearing" } : { kind: "wear" };

  const item = unowned.find((candidate) => candidate.id === input.lastTriedId) ?? unowned[0];
  if (!input.serverReady) return { kind: "notReady", item };
  if (!inSeason(item, input.month)) return { kind: "season", item };
  if (item.priceSprouts <= 0) return { kind: "claim", item };
  const balance = Math.max(0, Math.floor(input.balance ?? 0));
  if (input.balance != null && balance < item.priceSprouts) {
    return { kind: "short", item, price: item.priceSprouts, missing: item.priceSprouts - balance };
  }
  return { kind: "buy", item, price: item.priceSprouts };
}

/** Roughly how many care tasks cover a shortfall (each pays 2 Sprouts), for a kind "a few more" line. */
export function tasksToGo(missing: number): number {
  return Math.max(1, Math.ceil(Math.max(0, missing) / 2));
}
