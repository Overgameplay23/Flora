// A plain reference head (a circle on a neck, in a 200 x 200 box) that the registry's anchors and widths are
// tuned against: the dev preview (?preview=wardrobe-art) draws every item on it and the tests check each one
// lands sensibly. Real pets get their own anchors from the outfit layer; this only keeps the art consistent.

import type { OutfitSlot, PetAnchors } from "../../../domain/wardrobe/types";

export const REFERENCE_SIZE = 200;

export const REFERENCE_HEAD = { cx: 100, cy: 96, r: 56 };
export const REFERENCE_EYES = { y: 98, dx: 21, r: 7.5 };
/** neck and shoulders, under the head (running on below the box, for the neckwear diagrams) */
export const REFERENCE_BODY = "M68 146C66 162 54 186 46 200L40 240L160 240L154 200C146 186 134 162 132 146Z";

/**
 * The slot points in box units: head = top of the skull with the head's width, face = midpoint of the eyes
 * with the eye span (outer edge to outer edge), neck = where a collar sits with the neck's width there.
 */
export const REFERENCE_SLOTS: Record<OutfitSlot, { x: number; y: number; width: number }> = {
  head: { x: REFERENCE_HEAD.cx, y: REFERENCE_HEAD.cy - REFERENCE_HEAD.r, width: REFERENCE_HEAD.r * 2 },
  face: { x: REFERENCE_HEAD.cx, y: REFERENCE_EYES.y, width: 2 * (REFERENCE_EYES.dx + REFERENCE_EYES.r) },
  neck: { x: REFERENCE_HEAD.cx, y: 158, width: 68 },
};

/** The same slots normalized like PetAnchors (0..1 of the box), e.g. as a fixture for the outfit layer. */
export const REFERENCE_ANCHORS: PetAnchors = {
  head: { cx: REFERENCE_SLOTS.head.x / REFERENCE_SIZE, top: REFERENCE_SLOTS.head.y / REFERENCE_SIZE, width: REFERENCE_SLOTS.head.width / REFERENCE_SIZE },
  face: { cx: REFERENCE_SLOTS.face.x / REFERENCE_SIZE, cy: REFERENCE_SLOTS.face.y / REFERENCE_SIZE, width: REFERENCE_SLOTS.face.width / REFERENCE_SIZE },
  neck: { cx: REFERENCE_SLOTS.neck.x / REFERENCE_SIZE, cy: REFERENCE_SLOTS.neck.y / REFERENCE_SIZE, width: REFERENCE_SLOTS.neck.width / REFERENCE_SIZE },
};
