// Photo -> look suggestion: which coat, belly and ear colours the illustrated pet should start from.
//
// Pure functions over an RGBA pixel buffer so they run anywhere (device, web, tests). The caller
// decodes the photo (see src/services/photoLook.ts); this module samples the centre of the picture,
// discards colours that look like the background (the border ring), clusters what is left, and maps
// the clusters onto the rig's colour slots. It is a starting point for the editor, not a verdict.
import { PetLook, Species, normalizeLook, shade } from "./petLook";

export type RGB = [number, number, number];

export type PixelSource = {
  width: number;
  height: number;
  /** RGBA, row-major, 4 bytes per pixel */
  data: Uint8Array | Uint8ClampedArray | number[];
};

export type Cluster = { color: RGB; share: number };

export type LookSuggestion = {
  coat: string;
  secondary: string;
  ear: string;
  nose: string;
  eye: string;
  /** what the analysis saw, largest first */
  palette: Cluster[];
  /** 0..1, how sure the analysis is that it found a subject (share of centre pixels kept) */
  confidence: number;
};

const toHex = (c: RGB) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const dist2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const luma = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const hue = (c: RGB) => {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60) % 360;
};
const hueDistance = (a: RGB, b: RGB) => {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
};
const saturation = (c: RGB) => {
  const max = Math.max(c[0], c[1], c[2]);
  const min = Math.min(c[0], c[1], c[2]);
  return max === 0 ? 0 : (max - min) / max;
};

/** Reads every `step`-th pixel inside a region as RGB triples. */
function samplePixels(src: PixelSource, x0: number, y0: number, x1: number, y1: number, step: number): RGB[] {
  const out: RGB[] = [];
  for (let y = Math.max(0, y0); y < Math.min(src.height, y1); y += step) {
    for (let x = Math.max(0, x0); x < Math.min(src.width, x1); x += step) {
      const i = (y * src.width + x) * 4;
      const a = src.data[i + 3];
      if (a !== undefined && a < 128) continue; // transparent pixels are not the pet
      out.push([src.data[i], src.data[i + 1], src.data[i + 2]]);
    }
  }
  return out;
}

/** Plain k-means on RGB, seeded deterministically; small and good enough for a handful of clusters. */
export function kmeans(points: RGB[], k: number, iterations = 12): Cluster[] {
  if (points.length === 0) return [];
  const kk = Math.min(k, points.length);
  // farthest-point seeding (deterministic): the first centre is the first point, each next centre is
  // the point farthest from all centres so far, so two seeds never land in the same blob
  const centers: RGB[] = [[...points[0]] as RGB];
  while (centers.length < kk) {
    let best = 0;
    let bestD = -1;
    for (let p = 0; p < points.length; p++) {
      let nearest = Infinity;
      for (const c of centers) nearest = Math.min(nearest, dist2(points[p], c));
      if (nearest > bestD) {
        bestD = nearest;
        best = p;
      }
    }
    if (bestD <= 0) break;
    centers.push([...points[best]] as RGB);
  }
  const kEff = centers.length;
  let assignment = new Int32Array(points.length);
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let p = 0; p < points.length; p++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < kEff; c++) {
        const d = dist2(points[p], centers[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assignment[p] !== best) {
        assignment[p] = best;
        moved = true;
      }
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let p = 0; p < points.length; p++) {
      const s = sums[assignment[p]];
      s[0] += points[p][0];
      s[1] += points[p][1];
      s[2] += points[p][2];
      s[3] += 1;
    }
    for (let c = 0; c < kEff; c++) {
      if (sums[c][3] > 0) centers[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
    }
    if (!moved) break;
  }
  const counts = centers.map(() => 0);
  for (let p = 0; p < points.length; p++) counts[assignment[p]] += 1;
  return centers
    .map((color, i) => ({ color, share: counts[i] / points.length }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}

/**
 * Suggests rig colours from a photo. Background is estimated from the border ring and removed from the
 * centre samples by colour distance; the remaining pixels are clustered into up to four colours.
 */
export function suggestLookFromPixels(src: PixelSource, species: Species = "dog"): LookSuggestion | null {
  if (!src || src.width < 8 || src.height < 8) return null;
  const step = Math.max(1, Math.floor(Math.min(src.width, src.height) / 48));
  const ring = Math.max(2, Math.floor(Math.min(src.width, src.height) * 0.08));
  const border = [
    ...samplePixels(src, 0, 0, src.width, ring, step),
    ...samplePixels(src, 0, src.height - ring, src.width, src.height, step),
    ...samplePixels(src, 0, ring, ring, src.height - ring, step),
    ...samplePixels(src, src.width - ring, ring, src.width, src.height - ring, step),
  ];
  const background = kmeans(border, 3).filter((c) => c.share >= 0.15);

  const cx0 = Math.floor(src.width * 0.2);
  const cy0 = Math.floor(src.height * 0.15);
  const cx1 = Math.ceil(src.width * 0.8);
  const cy1 = Math.ceil(src.height * 0.9);
  const centre = samplePixels(src, cx0, cy0, cx1, cy1, step);
  if (centre.length < 16) return null;
  const threshold = 42 * 42;
  const subject = centre.filter((p) => !background.some((b) => dist2(p, b.color) < threshold));
  const kept = subject.length / centre.length;
  // if almost everything matched the background, the pet probably fills the frame: keep everything
  const usable = kept < 0.2 ? centre : subject;
  const palette = kmeans(usable, 4).filter((c) => c.share >= 0.06);
  if (palette.length === 0) return null;

  // coat: the biggest cluster that is not near-white glare or near-black shadow (unless that is all there is)
  const isGlare = (c: RGB) => luma(c) > 235 && saturation(c) < 0.12;
  const isShadow = (c: RGB) => luma(c) < 28;
  const coatCluster = palette.find((c) => !isGlare(c.color) && !isShadow(c.color)) ?? palette[0];
  const coat = coatCluster.color;
  const lighter = palette.filter((c) => c !== coatCluster && luma(c.color) > luma(coat) + 30 && !isGlare(c.color)).sort((a, b) => b.share - a.share)[0];
  // ears are the coat's own family: a darker cluster only counts when its hue is close to the coat's
  // (a green lawn or a blue sky behind the pet must not become the ears)
  const darker = palette
    .filter((c) => c !== coatCluster && luma(c.color) < luma(coat) - 30 && !isShadow(c.color) && (hueDistance(c.color, coat) < 40 || saturation(c.color) < 0.18))
    .sort((a, b) => b.share - a.share)[0];
  const secondary = lighter ? lighter.color : (hexToRgb(shade(toHex(coat), 0.3)) as RGB);
  const ear = darker ? darker.color : (hexToRgb(shade(toHex(coat), -0.25)) as RGB);
  const dark = palette.find((c) => isShadow(c.color));
  const nose = luma(coat) > 200 && !dark ? "#e8889b" : "#2a2530";
  const eye = luma(coat) < 90 ? "#c2841f" : "#5a3b1e";

  return {
    coat: toHex(coat),
    secondary: toHex(secondary),
    ear: toHex(ear),
    nose,
    eye,
    palette,
    confidence: Math.max(0, Math.min(1, kept)),
  };
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Applies a suggestion to a look, keeping the person's structural choices (ears, tail, markings). */
export function applySuggestion(look: PetLook, suggestion: LookSuggestion): PetLook {
  return normalizeLook({ ...look, coat: suggestion.coat, secondary: suggestion.secondary, ear: suggestion.ear, nose: suggestion.nose, eye: suggestion.eye }, look.species);
}
