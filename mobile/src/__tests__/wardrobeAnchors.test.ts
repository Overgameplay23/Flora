// Where Wardrobe items sit on a pet: the slot anchors (exact for the rig, estimated for the painted portrait),
// placement of a drawing on its anchor, and the "Adjust fit" limits. All pure.
import fs from "fs";
import path from "path";
import { BOX, bodyGeometry, headGeometry, pivots } from "../components/pet/vector/petParts";
import type { PetLook, Species } from "../domain/petLook";
import {
  FIT_LIMITS,
  OUTFIT_DRAW_ORDER,
  anchorsFor,
  clampFit,
  normalizeFit,
  placeItem,
  type ItemShape,
  type PetDrawKind,
} from "../domain/wardrobe/anchors";
import { WARDROBE_ITEMS } from "../domain/wardrobe/catalog";
import type { OutfitSlot, PetAnchors } from "../domain/wardrobe/types";

const SPECIES: Species[] = ["dog", "cat"];
const KINDS: PetDrawKind[] = ["portrait", "rig"];
// a square stage, a small toast-sized pet, and a portrait image that is a little taller than wide
const BOXES = [
  { width: 180, height: 180 },
  { width: 40, height: 40 },
  { width: 150, height: 180 },
];

// Drawings at the edges of what the art registry is likely to hold, per slot.
const SHAPES: Record<OutfitSlot, Record<string, ItemShape>> = {
  head: {
    beret: { aspect: 0.55, anchor: { x: 0.5, y: 0.85 }, widthScale: 1 },
    witchHat: { aspect: 1.25, anchor: { x: 0.5, y: 0.92 }, widthScale: 0.95 },
    sunHat: { aspect: 0.45, anchor: { x: 0.5, y: 0.8 }, widthScale: 1.5 },
    crown: { aspect: 0.6, anchor: { x: 0.5, y: 0.95 }, widthScale: 0.6 },
  },
  face: {
    round: { aspect: 0.42, anchor: { x: 0.5, y: 0.45 }, widthScale: 1.3 },
    hearts: { aspect: 0.5, anchor: { x: 0.5, y: 0.4 }, widthScale: 1.5 },
  },
  neck: {
    bandana: { aspect: 0.65, anchor: { x: 0.5, y: 0.12 }, widthScale: 1.05 },
    lei: { aspect: 0.45, anchor: { x: 0.5, y: 0.3 }, widthScale: 1.25 },
    bowtie: { aspect: 0.5, anchor: { x: 0.5, y: 0.5 }, widthScale: 0.6 },
  },
};

const anchorPoint = (anchors: PetAnchors, slot: OutfitSlot) => {
  const a = anchors[slot] as any;
  return { x: a.cx, y: slot === "head" ? a.top : a.cy };
};

const EPS = 1e-9;

describe("slot anchors", () => {
  it("match the rig's own geometry exactly, for both species and builds", () => {
    for (const species of SPECIES) {
      for (const build of ["round", "slim"] as const) {
        const look = { species, build } as PetLook;
        const head = headGeometry(look);
        const body = bodyGeometry(look);
        const eyes = pivots(look).eyes;
        const a = anchorsFor("rig", species, build);
        expect(a.head.cx).toBeCloseTo(head.cx / BOX, 9);
        expect(a.head.top).toBeCloseTo((head.cy - head.ry) / BOX, 9);
        expect(a.head.width).toBeCloseTo((2 * head.rx) / BOX, 9);
        expect(a.face.cy).toBeCloseTo(eyes.y / BOX, 9);
        // the neck line sits just under the chin, on the body's silhouette
        const neckY = a.neck.cy * BOX;
        expect(neckY).toBeLessThan(head.cy + head.ry);
        expect(neckY).toBeGreaterThan(head.cy + head.ry - 8);
        const t = (neckY - body.cy) / body.ry;
        expect(a.neck.width).toBeCloseTo((2 * body.rx * Math.sqrt(1 - t * t)) / BOX, 9);
      }
    }
  });

  it("gives the rig dog the numbers it draws (head top 43, width 84, eyes on 86, 48 across)", () => {
    const a = anchorsFor("rig", "dog");
    expect(a.head).toEqual({ cx: 0.5, top: 43 / 200, width: 84 / 200 });
    expect(a.face).toEqual({ cx: 0.5, cy: 86 / 200, width: 48 / 200 });
    expect(anchorsFor("rig", "dog", "slim").neck.width).toBeLessThan(a.neck.width);
  });

  it("puts a cat's portrait head smaller and a little higher than a dog's", () => {
    const dog = anchorsFor("portrait", "dog");
    const cat = anchorsFor("portrait", "cat");
    expect(cat.head.width).toBeLessThan(dog.head.width);
    expect(cat.head.top).toBeLessThanOrEqual(dog.head.top);
    expect(cat.face.cy).toBeLessThan(dog.face.cy);
    expect(cat.neck.cy).toBeLessThan(dog.neck.cy);
    expect(cat.neck.width).toBeLessThan(dog.neck.width);
  });

  it("are ordered head, eyes, neck, centred and inside the box, for every species and kind", () => {
    for (const kind of KINDS) {
      for (const species of SPECIES) {
        const a = anchorsFor(kind, species);
        expect(a.head.top).toBeLessThan(a.face.cy);
        expect(a.face.cy).toBeLessThan(a.neck.cy);
        for (const slot of OUTFIT_DRAW_ORDER) {
          const p = anchorPoint(a, slot);
          expect(p.x).toBe(0.5);
          expect(p.y).toBeGreaterThan(0);
          expect(p.y).toBeLessThan(0.75);
          expect(a[slot].width).toBeGreaterThan(0.1);
          expect(a[slot].width).toBeLessThan(0.6);
        }
        // glasses span less than the head
        expect(a.face.width).toBeLessThan(a.head.width);
      }
    }
  });

  it("treat anything that is not a cat as a dog, and hand out a fresh copy each time", () => {
    expect(anchorsFor("portrait", "fox" as any)).toEqual(anchorsFor("portrait", "dog"));
    const a = anchorsFor("portrait", "dog");
    a.head.top = 0.9;
    expect(anchorsFor("portrait", "dog").head.top).not.toBe(0.9);
  });

  it("draw neck, then face, then head", () => {
    expect(OUTFIT_DRAW_ORDER).toEqual(["neck", "face", "head"]);
  });
});

describe("placing an item", () => {
  it("lands every catalog item on its slot, in the box, for both species and both kinds", () => {
    let checked = 0;
    for (const item of WARDROBE_ITEMS) {
      for (const kind of KINDS) {
        for (const species of SPECIES) {
          const anchors = anchorsFor(kind, species);
          for (const box of BOXES) {
            for (const shape of Object.values(SHAPES[item.slot])) {
              const rect = placeItem(shape, item.slot, anchors, box);
              for (const value of Object.values(rect)) expect(Number.isFinite(value)).toBe(true);
              expect(rect.width).toBeGreaterThan(0);
              expect(rect.height).toBeCloseTo(rect.width * shape.aspect, 9);
              // the drawing's anchor point is on the slot anchor
              const p = anchorPoint(anchors, item.slot);
              expect(rect.left + shape.anchor.x * rect.width).toBeCloseTo(p.x * box.width, 9);
              expect(rect.top + shape.anchor.y * rect.height).toBeCloseTo(p.y * box.height, 9);
              // inside the box side to side and at the bottom
              expect(rect.left).toBeGreaterThanOrEqual(-EPS);
              expect(rect.left + rect.width).toBeLessThanOrEqual(box.width + EPS);
              expect(rect.top + rect.height).toBeLessThanOrEqual(box.height + EPS);
              if (item.slot === "head") {
                // a tall hat may rise above the painted box, but never more than a third of the pet's height
                expect(rect.top).toBeGreaterThan(-box.height / 3);
              } else {
                expect(rect.top).toBeGreaterThanOrEqual(-EPS);
              }
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(WARDROBE_ITEMS.length * 4 * 3);
  });

  it("sizes from the slot's reference width and the drawing's widthScale", () => {
    const anchors = anchorsFor("rig", "dog");
    const box = { width: 200, height: 200 };
    const rect = placeItem({ aspect: 0.5, anchor: { x: 0.5, y: 1 }, widthScale: 1 }, "head", anchors, box);
    expect(rect.width).toBeCloseTo(84, 9);
    expect(rect.height).toBeCloseTo(42, 9);
    expect(rect.left).toBeCloseTo(58, 9);
    expect(rect.top).toBeCloseTo(1, 9); // the brim (bottom edge) rests on the top of the head at 43
    const wide = placeItem({ aspect: 0.5, anchor: { x: 0.5, y: 1 }, widthScale: 1.5 }, "head", anchors, box);
    expect(wide.width).toBeCloseTo(126, 9);
  });

  it("scales around the anchor point, within the limits", () => {
    const anchors = anchorsFor("portrait", "cat");
    const box = { width: 160, height: 160 };
    const shape = SHAPES.face.round;
    const base = placeItem(shape, "face", anchors, box);
    const big = placeItem(shape, "face", anchors, box, { scale: 2 });
    expect(big.width).toBeCloseTo(base.width * 2, 9);
    expect(big.height).toBeCloseTo(base.height * 2, 9);
    const at = (r: typeof base) => ({ x: r.left + shape.anchor.x * r.width, y: r.top + shape.anchor.y * r.height });
    expect(at(big).x).toBeCloseTo(at(base).x, 9);
    expect(at(big).y).toBeCloseTo(at(base).y, 9);
    expect(placeItem(shape, "face", anchors, box, { scale: 9 }).width).toBeCloseTo(base.width * FIT_LIMITS.maxScale, 9);
    expect(placeItem(shape, "face", anchors, box, { scale: 0.1 }).width).toBeCloseTo(base.width * FIT_LIMITS.minScale, 9);
  });

  it("nudges by a fraction of the box, within the limits", () => {
    const anchors = anchorsFor("rig", "cat");
    const box = { width: 100, height: 200 };
    const shape = SHAPES.neck.bandana;
    const base = placeItem(shape, "neck", anchors, box);
    const moved = placeItem(shape, "neck", anchors, box, { dx: 0.1, dy: -0.05 });
    expect(moved.left - base.left).toBeCloseTo(10, 9);
    expect(moved.top - base.top).toBeCloseTo(-10, 9);
    expect(moved.width).toBeCloseTo(base.width, 9);
    const far = placeItem(shape, "neck", anchors, box, { dx: 3, dy: -3 });
    expect(far.left - base.left).toBeCloseTo(50, 9);
    expect(far.top - base.top).toBeCloseTo(-100, 9);
  });

  it("returns an empty rect rather than NaN for a missing box, slot or drawing", () => {
    const anchors = anchorsFor("rig", "dog");
    const zero = { left: 0, top: 0, width: 0, height: 0 };
    expect(placeItem(SHAPES.head.beret, "head", anchors, { width: 0, height: 100 })).toEqual(zero);
    expect(placeItem(SHAPES.head.beret, "head", anchors, { width: NaN, height: 100 })).toEqual(zero);
    expect(placeItem(SHAPES.head.beret, "tail" as any, anchors, { width: 100, height: 100 })).toEqual(zero);
    expect(placeItem(null as any, "head", anchors, { width: 100, height: 100 })).toEqual(zero);
    // a drawing with broken numbers falls back to square, centred, automatic width
    const odd = placeItem({ aspect: NaN, anchor: { x: 7, y: -1 }, widthScale: -2 } as any, "face", anchors, { width: 200, height: 200 });
    expect(odd.width).toBeCloseTo(48, 9);
    expect(odd.height).toBeCloseTo(48, 9);
    expect(odd.left).toBeCloseTo(100 - 48, 9); // anchor x clamped to 1
    expect(odd.top).toBeCloseTo(86, 9); // anchor y clamped to 0
  });
});

describe("adjust fit", () => {
  it("clamps to the server's limits and fills in the automatic fit", () => {
    expect(clampFit(undefined)).toEqual({ dx: 0, dy: 0, scale: 1 });
    expect(clampFit(null)).toEqual({ dx: 0, dy: 0, scale: 1 });
    expect(clampFit({ dx: 0.2 })).toEqual({ dx: 0.2, dy: 0, scale: 1 });
    expect(clampFit({ dx: 0.9, dy: -4, scale: 7 })).toEqual({ dx: 0.5, dy: -0.5, scale: 2 });
    expect(clampFit({ dx: -0.51, dy: 0.51, scale: 0.2 })).toEqual({ dx: -0.5, dy: 0.5, scale: 0.5 });
    expect(clampFit({ dx: NaN, dy: Infinity, scale: "big" } as any)).toEqual({ dx: 0, dy: 0, scale: 1 });
    expect(clampFit({ dx: "0.3", scale: "2" } as any)).toEqual({ dx: 0, dy: 0, scale: 1 });
    expect(Object.is(clampFit({ dx: -0 }).dx, 0)).toBe(true);
  });

  it("normalizes a stored fit: known slots only, clamped, automatic slots dropped", () => {
    expect(normalizeFit(null)).toEqual({});
    expect(normalizeFit("head")).toEqual({});
    expect(normalizeFit([{ dx: 1 }])).toEqual({});
    expect(
      normalizeFit({
        head: { dx: 0.1, dy: -0.9, scale: 3 },
        face: { dx: 0, dy: 0, scale: 1 },
        neck: "tight",
        tail: { dx: 0.2, dy: 0, scale: 1 },
      })
    ).toEqual({ head: { dx: 0.1, dy: -0.5, scale: 2 } });
  });
});

// The real drawings, once the art registry (src/components/wardrobe/art) is in place: one entry per catalog art
// key, every one placeable on both species and kinds.
// Skipped only while the registry file does not exist yet; once it does, a registry that fails to import fails here.
const ART_INDEX = path.resolve(__dirname, "..", "components", "wardrobe", "art", "index");
const hasArt = [".ts", ".tsx", ".js"].some((ext) => fs.existsSync(ART_INDEX + ext));
const registry: { ACCESSORY_ART?: Record<string, ItemShape & { Component?: unknown }> } | null = hasArt
  ? require("../components/wardrobe/art")
  : null;
const describeWithArt = hasArt ? describe : describe.skip;

describeWithArt("the art registry", () => {
  it("has a drawing for every catalog item that places sensibly", () => {
    const art = registry!.ACCESSORY_ART!;
    for (const item of WARDROBE_ITEMS) {
      const shape = art[item.art];
      const drawable = !!shape && (typeof shape.Component === "function" || (typeof shape.Component === "object" && shape.Component !== null));
      expect({ id: item.id, drawable }).toEqual({ id: item.id, drawable: true });
      expect(shape.aspect).toBeGreaterThan(0);
      expect(shape.widthScale).toBeGreaterThan(0);
      expect(shape.anchor.x).toBeGreaterThanOrEqual(0);
      expect(shape.anchor.x).toBeLessThanOrEqual(1);
      expect(shape.anchor.y).toBeGreaterThanOrEqual(0);
      expect(shape.anchor.y).toBeLessThanOrEqual(1);
      for (const kind of KINDS) {
        for (const species of SPECIES) {
          const box = { width: 180, height: 180 };
          const rect = placeItem(shape, item.slot, anchorsFor(kind, species), box);
          expect(rect.width).toBeGreaterThan(0);
          // centred items stay within the box side to side, and nothing hangs below the paws
          expect(rect.left).toBeGreaterThan(-box.width * 0.1);
          expect(rect.left + rect.width).toBeLessThan(box.width * 1.1);
          expect(rect.top + rect.height).toBeLessThanOrEqual(box.height);
          expect(rect.top).toBeGreaterThan(-box.height / 2);
        }
      }
    }
  });
});
