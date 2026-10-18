// Where Wardrobe items sit on a pet, and how big they are. Everything is normalized to the pet's drawn box
// (0..1 of its width and height, origin top-left), so the same numbers work at any size. Pure: the rig numbers
// come straight from the rig's own geometry (src/components/pet/vector/petParts.ts), the portrait numbers are
// estimates for the v3 painting, and "Adjust fit" (FitAdjust) covers the difference for any one pet.
//
// The art registry (src/components/wardrobe/art) says, for each drawing, which point of it rests on the slot's
// anchor and how wide it is relative to the slot's reference width:
//   head  the top of the head (centre of the crown of the skull)      width: the head
//   face  the eye line, midway between the eyes (the glasses' bridge) width: outer edge to outer edge of the eyes
//   neck  where a collar wraps, just under the chin                   width: the neck's silhouette at that line

import { BOX, bodyGeometry, headGeometry, pivots } from "../../components/pet/vector/petParts";
import type { Build, PetLook, Species } from "../petLook";
import type { FitAdjust, OutfitSlot, PetAnchors } from "./types";

export type PetDrawKind = "portrait" | "rig";

/** Back to front: a neckerchief under the glasses, the hat over everything. */
export const OUTFIT_DRAW_ORDER: OutfitSlot[] = ["neck", "face", "head"];

/** What placeItem needs from an accessory drawing (AccessoryArt has these fields). */
export type ItemShape = {
  /** height / width of the drawing */
  aspect: number;
  /** the point inside the drawing (0..1) that sits on the slot anchor */
  anchor: { x: number; y: number };
  /** item width = the slot's reference width * widthScale */
  widthScale: number;
};

export type FitNudge = { dx: number; dy: number; scale: number };

export type ItemRect = { left: number; top: number; width: number; height: number };

/** The same limits equip_outfit applies on the server. */
export const FIT_LIMITS = { offset: 0.5, minScale: 0.5, maxScale: 2 } as const;

// ---- the rig ----------------------------------------------------------------------------------------------

// PetRig draws the eyes at head.cx +/- 16 on the eye pivot line; a dog's eye is a circle of r 8, a cat's an
// ellipse of rx 7 (PetRig.tsx, "eyes (blink)").
const RIG_EYE_DX = 16;
const RIG_EYE_R: Record<Species, number> = { dog: 8, cat: 7 };
// The collar line sits a little above the bottom of the head ellipse, so a band tucks under the chin.
const RIG_NECK_TUCK = 3;

function rigAnchors(species: Species, build: Build): PetAnchors {
  const look = { species, build } as PetLook; // the geometry only reads species and build
  const head = headGeometry(look);
  const body = bodyGeometry(look);
  const eyes = pivots(look).eyes;
  const neckY = head.cy + head.ry - RIG_NECK_TUCK;
  // the neck is the body's silhouette at the collar line (the head is drawn over the top of the body)
  const t = (neckY - body.cy) / body.ry;
  const neckHalf = body.rx * Math.sqrt(Math.max(0, 1 - t * t));
  return {
    head: { cx: head.cx / BOX, top: (head.cy - head.ry) / BOX, width: (2 * head.rx) / BOX },
    face: { cx: eyes.x / BOX, cy: eyes.y / BOX, width: (2 * (RIG_EYE_DX + RIG_EYE_R[species])) / BOX },
    neck: { cx: body.cx / BOX, cy: neckY / BOX, width: (2 * neckHalf) / BOX },
  };
}

// ---- the painted portrait ---------------------------------------------------------------------------------

// The v3 painting (supabase/functions/pet-stylize, PROMPT_V3_PORTRAIT) is a square image of the whole pet sitting
// upright, facing the viewer, centred, paws on the bottom edge, with a small margin on top and at the sides. With
// natural proportions the head takes roughly the top third. Estimates for a typical pet, from the skull (ears
// can rise above it; a hat sits between them):
//   dog  skull top ~0.09, head ~0.34 wide, eyes at ~0.225 about 0.2 apart outside to outside, collar ~0.41
//   cat  a smaller head on a taller, narrower body, so everything sits a little higher and narrower
const PORTRAIT_ANCHORS: Record<Species, PetAnchors> = {
  dog: {
    head: { cx: 0.5, top: 0.09, width: 0.34 },
    face: { cx: 0.5, cy: 0.225, width: 0.2 },
    neck: { cx: 0.5, cy: 0.41, width: 0.28 },
  },
  cat: {
    head: { cx: 0.5, top: 0.085, width: 0.28 },
    face: { cx: 0.5, cy: 0.2, width: 0.17 },
    neck: { cx: 0.5, cy: 0.355, width: 0.22 },
  },
};

/**
 * The slot anchors for a pet drawn as the rig (exact) or as the painted portrait (estimated), normalized to the
 * box the pet is drawn in. `build` only changes the rig's neck width.
 */
export function anchorsFor(kind: PetDrawKind, species: Species, build: Build = "round"): PetAnchors {
  const s: Species = species === "cat" ? "cat" : "dog";
  if (kind === "rig") return rigAnchors(s, build === "slim" ? "slim" : "round");
  const anchors = PORTRAIT_ANCHORS[s];
  return { head: { ...anchors.head }, face: { ...anchors.face }, neck: { ...anchors.neck } };
}

// ---- fit ----------------------------------------------------------------------------------------------------

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positive(value: unknown, fallback: number): number {
  const n = finite(value, fallback);
  return n > 0 ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value)) || 0; // `|| 0` turns -0 into 0
}

/** One slot's nudge within the server's limits; anything missing or not a number is the automatic fit. */
export function clampFit(fit?: Partial<FitNudge> | null): FitNudge {
  return {
    dx: clamp(finite(fit?.dx, 0), -FIT_LIMITS.offset, FIT_LIMITS.offset),
    dy: clamp(finite(fit?.dy, 0), -FIT_LIMITS.offset, FIT_LIMITS.offset),
    scale: clamp(finite(fit?.scale, 1), FIT_LIMITS.minScale, FIT_LIMITS.maxScale),
  };
}

/** A stored or server FitAdjust, clamped; unknown slots and untouched (automatic) slots are dropped. */
export function normalizeFit(raw: unknown): FitAdjust {
  const fit: FitAdjust = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fit;
  for (const slot of OUTFIT_DRAW_ORDER) {
    const value = (raw as Record<string, unknown>)[slot];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const nudge = clampFit(value as Partial<FitNudge>);
    if (nudge.dx !== 0 || nudge.dy !== 0 || nudge.scale !== 1) fit[slot] = nudge;
  }
  return fit;
}

// ---- placement ------------------------------------------------------------------------------------------------

/**
 * Where one item goes, in the box's own units (left/top from the box's top-left corner). The drawing's anchor
 * point lands on the slot anchor (moved by the nudge), and the item scales around that point, so "bigger"
 * never drifts it off the head. Items are not clipped to the box: a tall hat may rise above it.
 */
export function placeItem(
  art: ItemShape,
  slot: OutfitSlot,
  anchors: PetAnchors,
  box: { width: number; height: number },
  fit?: Partial<FitNudge> | null
): ItemRect {
  const W = Math.max(0, finite(box?.width, 0));
  const H = Math.max(0, finite(box?.height, 0));
  const anchor = anchors?.[slot] as { cx: number; width: number; top?: number; cy?: number } | undefined;
  if (!art || !anchor || W === 0 || H === 0) return { left: 0, top: 0, width: 0, height: 0 };

  const nudge = clampFit(fit);
  const x = (finite(anchor.cx, 0.5) + nudge.dx) * W;
  const y = (finite(slot === "head" ? anchor.top : anchor.cy, 0.5) + nudge.dy) * H;
  const widthScale = positive(art.widthScale, 1);
  const aspect = positive(art.aspect, 1);
  const width = Math.max(0, finite(anchor.width, 0)) * W * widthScale * nudge.scale;
  const height = width * aspect;
  const ax = clamp(finite(art.anchor?.x, 0.5), 0, 1);
  const ay = clamp(finite(art.anchor?.y, 0.5), 0, 1);
  return { left: x - ax * width, top: y - ay * height, width, height };
}
