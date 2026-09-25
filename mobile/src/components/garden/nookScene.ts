// The window nook: the cat's sanctuary (product strategy report: "cozy sanctuary, ambient domestic
// comfort, quiet co-presence"). Unlike the garden it is not a painting but a vector room drawn by
// NookBackdrop, so this descriptor uses the same shape as scene.json over a virtual 1200 x 1000 canvas.
import type { PlantStage, ScenePoint } from "../../domain/gardenScene";

export const NOOK_W = 1200;
export const NOOK_H = 1000;

const pot = { width: 130, height: 200, anchorX: 0.5, anchorY: 1 };

export const NOOK_SCENE = {
  image: { width: NOOK_W, height: NOOK_H },
  // where pots go, first purchases first: the sill, then the side table, then the floor
  spots: [
    { u: 600 / NOOK_W, v: 582 / NOOK_H, scale: 0.9 },
    { u: 420 / NOOK_W, v: 582 / NOOK_H, scale: 0.86 },
    { u: 780 / NOOK_W, v: 582 / NOOK_H, scale: 0.86 },
    { u: 1075 / NOOK_W, v: 702 / NOOK_H, scale: 0.9 },
    { u: 215 / NOOK_W, v: 770 / NOOK_H, scale: 1.15 },
    { u: 905 / NOOK_W, v: 800 / NOOK_H, scale: 1.1 },
  ] as Array<ScenePoint & { scale?: number }>,
  // the rug, where the cat sits
  pet: { u: 470 / NOOK_W, v: 905 / NOOK_H, heightRatio: 0.2 } as ScenePoint & { heightRatio: number },
  sprites: { seed: pot, sproutSmall: pot, sprout: pot, bloom: pot } as Record<PlantStage, { width: number; height: number; anchorX: number; anchorY: number }>,
};

/** How the room is framed in each place it appears (same keys as the garden's SCENE_FRAMING). */
export const NOOK_FRAMING = {
  home: { focus: { u: 0.5, v: 0.62 }, zoom: 1.08 },
  garden: { focus: { u: 0.5, v: 0.6 }, zoom: 1.02 },
  pet: { focus: { u: 0.44, v: 0.74 }, zoom: 1.38 },
  welcome: { focus: { u: 0.5, v: 0.64 }, zoom: 1.1 },
} as const;
