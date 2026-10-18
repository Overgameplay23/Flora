// The Wardrobe accessory art registry: one drawing per catalog `art` key (src/domain/wardrobe/catalog.ts) and
// how it sits on a pet. Placement contract, shared with the outfit layer that dresses the pet:
//   head  `anchor` is the point of the drawing that rests on the TOP of the head (the crown of the skull,
//         between the ears). Reference width: the head's width (skull, ears excluded).
//   face  `anchor` is the bridge between the lenses, on the eye line. Reference width: the eye span, outer edge
//         of one eye to the outer edge of the other.
//   neck  `anchor` is the middle of the band where it wraps the neck. Reference width: the neck's width there.
// The item is drawn `reference width x widthScale` wide and `aspect` times that tall, positioned so its anchor
// lands on the slot point (artFrame below does the arithmetic). Hats sit deep enough that the crown of the head
// is inside them, so they read as worn rather than balanced on top; the halo floats just above the head.
// Check placements on the reference head: http://localhost:8081/?preview=wardrobe-art

import type React from "react";
import type { ArtComponent, ArtProps } from "./kit";
import { BandanaGingham, BandanaRed, BellCollar, BowtiePlum, CollarSky, FlowerLei, KnitScarf, LeafGarland, PearlNecklace, RuffleCollar } from "./neckwear";
import { BeanieSage, BeretRose, BowBlush, DaisyCrown, FlowerHalo, FrogHat, GoldCrown, PartyHat, PumpkinBeanie, SunHat, WitchHat } from "./hats";
import { HeartSunnies, RoundGlasses, StarGlasses } from "./glasses";

export type AccessoryArt = {
  /** draws the item filling width x height */
  Component: React.ComponentType<ArtProps>;
  /** height / width of the drawing */
  aspect: number;
  /** normalized point inside the drawing that sits on the slot anchor (see the contract above) */
  anchor: { x: number; y: number };
  /** item width = slot reference width (head width / eye span / neck width) x widthScale */
  widthScale: number;
};

function entry(Component: ArtComponent, anchor: { x: number; y: number }, widthScale: number): AccessoryArt {
  return { Component, aspect: Component.box.vh / Component.box.vw, anchor, widthScale };
}

export const ACCESSORY_ART: Record<string, AccessoryArt> = {
  // ---- head --------------------------------------------------------------------------------------------
  daisy_crown: entry(DaisyCrown, { x: 0.5, y: 0.26 }, 1),
  bow_blush: entry(BowBlush, { x: 0.5, y: 0.56 }, 0.62),
  party_hat: entry(PartyHat, { x: 0.5, y: 0.9 }, 0.48),
  beret_rose: entry(BeretRose, { x: 0.5, y: 0.75 }, 0.92),
  beanie_sage: entry(BeanieSage, { x: 0.5, y: 0.66 }, 1.02),
  sun_hat: entry(SunHat, { x: 0.5, y: 0.64 }, 1.42),
  frog_hat: entry(FrogHat, { x: 0.5, y: 0.6 }, 1.06),
  flower_halo: entry(FlowerHalo, { x: 0.5, y: 0.96 }, 0.92),
  gold_crown: entry(GoldCrown, { x: 0.5, y: 0.86 }, 0.46),
  pumpkin_beanie: entry(PumpkinBeanie, { x: 0.5, y: 0.66 }, 1.02),
  witch_hat: entry(WitchHat, { x: 0.5, y: 0.8 }, 1.22),
  // ---- face --------------------------------------------------------------------------------------------
  round_glasses: entry(RoundGlasses, { x: 0.5, y: 0.5 }, 1.3),
  heart_sunnies: entry(HeartSunnies, { x: 0.5, y: 0.5 }, 1.32),
  star_glasses: entry(StarGlasses, { x: 0.5, y: 0.52 }, 1.4),
  // ---- neck --------------------------------------------------------------------------------------------
  bandana_red: entry(BandanaRed, { x: 0.5, y: 0.23 }, 1.12),
  bandana_gingham: entry(BandanaGingham, { x: 0.5, y: 0.23 }, 1.12),
  collar_sky: entry(CollarSky, { x: 0.5, y: 0.36 }, 1.06),
  bell_collar: entry(BellCollar, { x: 0.5, y: 0.33 }, 1.06),
  bowtie_plum: entry(BowtiePlum, { x: 0.5, y: 0.39 }, 1.04),
  flower_lei: entry(FlowerLei, { x: 0.5, y: 0.13 }, 1.2),
  ruffle_collar: entry(RuffleCollar, { x: 0.5, y: 0.43 }, 1.36),
  pearl_necklace: entry(PearlNecklace, { x: 0.5, y: 0.13 }, 1.08),
  knit_scarf: entry(KnitScarf, { x: 0.5, y: 0.26 }, 1.22),
  leaf_garland: entry(LeafGarland, { x: 0.5, y: 0.1 }, 1.16),
};

export function accessoryArt(key: string): AccessoryArt | undefined {
  return Object.prototype.hasOwnProperty.call(ACCESSORY_ART, key) ? ACCESSORY_ART[key] : undefined;
}

/**
 * Where to draw an item, in the caller's units: `at` is the slot point (top of head, eye-line centre, neck
 * centre), `referenceWidth` the slot's width, `scale` a fit adjustment (1 = automatic size).
 */
export function artFrame(art: AccessoryArt, at: { x: number; y: number }, referenceWidth: number, scale = 1): { left: number; top: number; width: number; height: number } {
  const width = referenceWidth * art.widthScale * scale;
  const height = width * art.aspect;
  return { left: at.x - art.anchor.x * width, top: at.y - art.anchor.y * height, width, height };
}

export type { ArtProps } from "./kit";
