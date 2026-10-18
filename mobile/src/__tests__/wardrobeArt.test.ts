// The accessory art registry (src/components/wardrobe/art) covers the whole Wardrobe catalog, every entry can be
// placed (a sane aspect and width, an anchor inside the drawing), every drawing renders with gradient ids of its
// own, and on the reference head each item lands where its slot says: hats on top of the head and clear of the
// eyes, glasses over both eyes, neckwear at the neck and clear of the face.
import React from "react";
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import Svg, { Circle, ClipPath, Ellipse, Line, LinearGradient, Path, RadialGradient, Rect } from "react-native-svg";
import { WARDROBE_ITEMS } from "../domain/wardrobe/catalog";
import { ACCESSORY_ART, accessoryArt, artFrame, type AccessoryArt } from "../components/wardrobe/art";
import { REFERENCE_EYES, REFERENCE_HEAD, REFERENCE_SLOTS } from "../components/wardrobe/art/reference";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const ART_KEYS = Array.from(new Set(WARDROBE_ITEMS.map((item) => item.art)));
const SHAPES: unknown[] = [Path, Circle, Ellipse, Rect, Line];
const DEFS: unknown[] = [LinearGradient, RadialGradient, ClipPath];

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer as ReactTestRenderer;
}

function draw(art: AccessoryArt, width = 120): React.ReactElement {
  return React.createElement(art.Component, { width, height: width * art.aspect });
}

function idsIn(root: ReactTestInstance): string[] {
  return root.findAll((node) => DEFS.includes(node.type)).map((node) => node.props.id as string);
}

function urlsIn(root: ReactTestInstance): string[] {
  const urls: string[] = [];
  for (const node of root.findAll((n) => typeof n.type !== "string")) {
    for (const key of ["fill", "stroke", "clipPath"]) {
      const value = node.props[key];
      const match = typeof value === "string" ? /^url\(#(.+)\)$/.exec(value) : null;
      if (match) urls.push(match[1]);
    }
  }
  return urls;
}

describe("wardrobe accessory art registry", () => {
  it("has a drawing for every art key in the catalog, and nothing the catalog does not use", () => {
    expect(ART_KEYS.length).toBe(24);
    for (const key of ART_KEYS) expect(accessoryArt(key)).toBeDefined();
    expect(Object.keys(ACCESSORY_ART).sort()).toEqual([...ART_KEYS].sort());
    expect(accessoryArt("no_such_item")).toBeUndefined();
    expect(accessoryArt("toString")).toBeUndefined();
  });

  it.each(ART_KEYS)("%s has a sane aspect, width and an anchor inside the drawing", (key) => {
    const art = ACCESSORY_ART[key];
    expect(art.aspect).toBeGreaterThan(0.25);
    expect(art.aspect).toBeLessThan(2);
    expect(art.widthScale).toBeGreaterThan(0.3);
    expect(art.widthScale).toBeLessThan(2);
    for (const v of [art.anchor.x, art.anchor.y]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // everything is drawn front-on and symmetric enough to hang from its middle
    expect(art.anchor.x).toBe(0.5);
  });

  it.each(ART_KEYS)("%s renders, stays lean, and every url(#…) points at its own gradient or clip", (key) => {
    const art = ACCESSORY_ART[key];
    const renderer = render(draw(art));
    const root = renderer.root;
    const svg = root.findByType(Svg as any);
    const [, , vw, vh] = String(svg.props.viewBox).split(" ").map(Number);
    expect(vh / vw).toBeCloseTo(art.aspect, 5);
    expect(svg.props.width).toBe(120);
    const shapes = root.findAll((node) => SHAPES.includes(node.type));
    expect(shapes.length).toBeGreaterThan(3);
    expect(shapes.length).toBeLessThanOrEqual(40);
    const ids = idsIn(root);
    expect(new Set(ids).size).toBe(ids.length);
    for (const ref of urlsIn(root)) expect(ids).toContain(ref);
    act(() => renderer.unmount());
  });

  it("gives two copies of the same item on one screen different gradient ids", () => {
    const art = ACCESSORY_ART.beanie_sage;
    const renderer = render(React.createElement(React.Fragment, null, draw(art), draw(art, 60)));
    const ids = idsIn(renderer.root);
    expect(ids.length).toBeGreaterThan(2);
    expect(new Set(ids).size).toBe(ids.length);
    act(() => renderer.unmount());
  });

  it("lands every item where its slot says on the reference head", () => {
    const headTop = REFERENCE_HEAD.cy - REFERENCE_HEAD.r;
    const eyeTop = REFERENCE_EYES.y - REFERENCE_EYES.r;
    const eyesLeft = REFERENCE_HEAD.cx - REFERENCE_EYES.dx - REFERENCE_EYES.r;
    const eyesRight = REFERENCE_HEAD.cx + REFERENCE_EYES.dx + REFERENCE_EYES.r;
    for (const item of WARDROBE_ITEMS) {
      const art = ACCESSORY_ART[item.art];
      const slot = REFERENCE_SLOTS[item.slot];
      const f = artFrame(art, { x: slot.x, y: slot.y }, slot.width);
      const where = `${item.art} (${item.slot})`;
      expect([where, f.left + f.width / 2]).toEqual([where, slot.x]);
      if (item.slot === "head") {
        // on top of the head, reaching no lower than the eyes
        expect([where, f.top < headTop]).toEqual([where, true]);
        expect([where, f.top + f.height <= eyeTop]).toEqual([where, true]);
        expect([where, f.width > slot.width * 0.35 && f.width < slot.width * 1.6]).toEqual([where, true]);
      } else if (item.slot === "face") {
        // across both eyes, on the eye line
        expect([where, f.left < eyesLeft && f.left + f.width > eyesRight]).toEqual([where, true]);
        expect([where, f.top < REFERENCE_EYES.y && f.top + f.height > REFERENCE_EYES.y]).toEqual([where, true]);
      } else {
        // around the neck, below the face
        expect([where, f.top < slot.y && f.top + f.height > slot.y]).toEqual([where, true]);
        expect([where, f.top > REFERENCE_EYES.y + REFERENCE_EYES.r]).toEqual([where, true]);
        expect([where, f.width >= slot.width * 0.95]).toEqual([where, true]);
      }
    }
  });
});
