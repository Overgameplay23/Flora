// Pure layout rules for the garden scene.
//
// The pet and the plants are anchored to the PAINTING, not to the screen: every position is a normalized
// point (u, v) on the background image, and the same "cover + focus + zoom" transform that places the
// background is used to place the sprites. That keeps a plant rooted in the soil patch and the pet
// sitting on the grass beside it on any screen size.

export type ScenePoint = { u: number; v: number };

export type SceneFrame = {
  /** displayed size of one source-image pixel, in layout units */
  scale: number;
  /** offset of the (larger than the container) background image inside the container */
  left: number;
  top: number;
  /** displayed size of the whole background image */
  width: number;
  height: number;
};

export type PlantStage = "seed" | "sproutSmall" | "sprout" | "bloom";

export type ScenePlantInput = {
  id: string;
  level: number;
  maxLevel: number;
  /** ISO timestamp; earlier purchases keep the earlier planting spots */
  purchasedAt?: string | null;
};

export type PlacedPlant = { id: string; stage: PlantStage; spotIndex: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

/**
 * Places the background so that it always covers the container, is zoomed by `zoom` (>= 1) and keeps the
 * focus point as close to the container's centre as the image edges allow.
 */
export function computeSceneFrame(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
  focus: ScenePoint,
  zoom = 1
): SceneFrame {
  const cw = Math.max(1, finite(containerWidth, 1));
  const ch = Math.max(1, finite(containerHeight, 1));
  const iw = Math.max(1, finite(imageWidth, 1));
  const ih = Math.max(1, finite(imageHeight, 1));
  const scale = Math.max(cw / iw, ch / ih) * Math.max(1, finite(zoom, 1));
  const width = iw * scale;
  const height = ih * scale;
  const left = clamp(cw / 2 - clamp(finite(focus.u, 0.5), 0, 1) * width, cw - width, 0);
  const top = clamp(ch / 2 - clamp(finite(focus.v, 0.5), 0, 1) * height, ch - height, 0);
  return { scale, left, top, width, height };
}

/** Converts a point on the painting to layout coordinates inside the container. */
export function sceneToView(frame: SceneFrame, point: ScenePoint): { x: number; y: number } {
  return { x: frame.left + point.u * frame.width, y: frame.top + point.v * frame.height };
}

/**
 * Growth stage shown for a plant. Level 1 is a freshly planted seed and the plant blooms in the last
 * quarter of its levels, whatever its max level is.
 */
export function plantStageForLevel(level: number, maxLevel: number): PlantStage | null {
  const safeLevel = Math.floor(finite(level, 0));
  if (safeLevel <= 0) return null;
  const safeMax = Math.max(2, Math.floor(finite(maxLevel, 5)));
  const progress = clamp((safeLevel - 1) / (safeMax - 1), 0, 1);
  if (progress <= 0) return "seed";
  if (progress < 0.4) return "sproutSmall";
  if (progress < 0.75) return "sprout";
  return "bloom";
}

/**
 * Assigns owned plants to planting spots. Order is by purchase time so a plant never jumps to another
 * spot when it levels up; if there are more plants than spots the highest-level ones are shown.
 */
export function layoutGardenPlants(plants: ScenePlantInput[], spotCount: number): PlacedPlant[] {
  const owned = (plants || []).filter((plant) => plant && plantStageForLevel(plant.level, plant.maxLevel));
  const byPurchase = (a: ScenePlantInput, b: ScenePlantInput) => {
    const ta = a.purchasedAt ? Date.parse(a.purchasedAt) : Number.NaN;
    const tb = b.purchasedAt ? Date.parse(b.purchasedAt) : Number.NaN;
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  };
  let shown = owned;
  const limit = Math.max(0, Math.floor(finite(spotCount, 0)));
  if (owned.length > limit) {
    shown = owned
      .slice()
      .sort((a, b) => b.level - a.level || byPurchase(a, b))
      .slice(0, limit);
  }
  return shown
    .slice()
    .sort(byPurchase)
    .map((plant, index) => ({
      id: String(plant.id),
      stage: plantStageForLevel(plant.level, plant.maxLevel) as PlantStage,
      spotIndex: index,
    }));
}

/** Width/height of a box with the given height that matches an image's aspect ratio (no letterboxing). */
export function fitHeight(height: number, imageWidth: number, imageHeight: number): { width: number; height: number } {
  const h = Math.max(1, finite(height, 1));
  const ratio = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;
  return { width: h * clamp(ratio, 0.4, 2.2), height: h };
}
