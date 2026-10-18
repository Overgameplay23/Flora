// Shared drawing kit for the Wardrobe accessory art: the Svg wrapper every item draws into, gradient ids that
// stay unique per mounted drawing (two pets wearing the same scarf on one screen must never share a `url(#…)`),
// colour mixing inside the token palette, and small path builders (petals, beads, leaves, hearts, stars,
// scallops, knit ribs) so each item stays a short list of shapes. No filters or blur: react-native-svg handles
// them poorly on iOS, so volume comes from gradients, a soft highlight and a same-hue edge only.

import React, { useId, useMemo } from "react";
import Svg, { LinearGradient, RadialGradient, Stop } from "react-native-svg";

export type ArtProps = { width: number; height: number };

/** An accessory drawing plus the viewBox it is drawn in (its aspect is vh / vw). */
export type ArtComponent = React.ComponentType<ArtProps> & { box: { vw: number; vh: number } };

export type ArtIds = {
  /** an id unique to this mounted drawing, for gradients and clip paths */
  id: (name: string) => string;
  /** `url(#…)` for the same id */
  url: (name: string) => string;
};

export function useArtIds(): ArtIds {
  const raw = useId();
  return useMemo(() => {
    // useId reads ":r1:", "«r1»" or "_r_1_" depending on the React version; keep only url-safe characters
    const base = `wa${raw.replace(/[^A-Za-z0-9]/g, "")}`;
    return { id: (name: string) => `${base}_${name}`, url: (name: string) => `url(#${base}_${name})` };
  }, [raw]);
}

/**
 * Wraps a drawing in its own Svg. The viewBox stretches to exactly width x height (no letterboxing), so the
 * normalized anchor in the registry always lands on the same point of the drawing; callers size it by `aspect`.
 */
export function artComponent(name: string, vw: number, vh: number, draw: (u: ArtIds) => React.ReactNode): ArtComponent {
  function Art({ width, height }: ArtProps) {
    const u = useArtIds();
    return (
      <Svg width={width} height={height} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" pointerEvents="none">
        {draw(u)}
      </Svg>
    );
  }
  Art.displayName = name;
  const memo = React.memo(Art) as unknown as ArtComponent;
  memo.box = { vw, vh };
  return memo;
}

// ---- colour ----------------------------------------------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `a` moved toward `b` by t (0..1). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`.toUpperCase();
}

/** Warm white the highlights lean to (never pure white on the cloth, only on glass and pearls). */
export const WARM_WHITE = "#FFFDF8";

export type Ramp = { light: string; base: string; shade: string; edge: string };

/** One colour's highlight, base, shade and edge, all in its own hue: the dark end leans to `deep`, never black. */
export function ramp(base: string, deep: string, lift = 0.45): Ramp {
  return { light: mix(base, WARM_WHITE, lift), base, shade: mix(base, deep, 0.42), edge: mix(base, deep, 0.7) };
}

// ---- gradients -------------------------------------------------------------------------------------------

export type StopSpec = readonly [offset: number, color: string, opacity?: number];

function stopList(stops: ReadonlyArray<StopSpec>) {
  return stops.map(([offset, color, opacity = 1], i) => <Stop key={i} offset={String(offset)} stopColor={color} stopOpacity={String(opacity)} />);
}

/** Linear gradient in the shape's own box; top to bottom unless told otherwise. */
export function Linear({ id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1 }: { id: string; stops: ReadonlyArray<StopSpec>; x1?: number; y1?: number; x2?: number; y2?: number }) {
  return (
    <LinearGradient id={id} x1={String(x1)} y1={String(y1)} x2={String(x2)} y2={String(y2)}>
      {stopList(stops)}
    </LinearGradient>
  );
}

/** Radial gradient in the shape's own box; the light sits up and to the left by default. */
export function Radial({ id, stops, cx = 0.36, cy = 0.3, r = 0.78 }: { id: string; stops: ReadonlyArray<StopSpec>; cx?: number; cy?: number; r?: number }) {
  return (
    <RadialGradient id={id} cx={String(cx)} cy={String(cy)} r={String(r)} fx={String(cx)} fy={String(cy)}>
      {stopList(stops)}
    </RadialGradient>
  );
}

/** A soft white glow that fades to nothing: the gentle highlight on cloth, metal and glass. */
export const SHEEN: ReadonlyArray<StopSpec> = [
  [0, "#FFFFFF", 0.55],
  [1, "#FFFFFF", 0],
];

export const ROUND = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

// ---- geometry --------------------------------------------------------------------------------------------

export type Pt = { x: number; y: number };

/** Two decimals keep the path strings short. */
export const n2 = (v: number) => Math.round(v * 100) / 100;

export function quadAt(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const s = 1 - t;
  return { x: s * s * p0.x + 2 * s * t * p1.x + t * t * p2.x, y: s * s * p0.y + 2 * s * t * p1.y + t * t * p2.y };
}

export function cubicAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const s = 1 - t;
  const a = s * s * s;
  const b = 3 * s * s * t;
  const c = 3 * s * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/** Direction of a cubic at t, in degrees (0 = pointing right, 90 = down). */
export function cubicAngle(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): number {
  const s = 1 - t;
  const dx = 3 * s * s * (p1.x - p0.x) + 6 * s * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const dy = 3 * s * s * (p1.y - p0.y) + 6 * s * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * `count` points evenly spaced by length along a curve (first and last on its ends), with the curve parameter
 * of each. Uniform t bunches beads where a curve flattens out; this keeps a string of pearls even.
 */
export function evenlyAlong(at: (t: number) => Pt, count: number, from = 0, to = 1): Array<Pt & { t: number }> {
  const steps = 160;
  const lengths = [0];
  let prev = at(from);
  for (let i = 1; i <= steps; i += 1) {
    const p = at(from + ((to - from) * i) / steps);
    lengths.push(lengths[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  const total = lengths[steps];
  const out: Array<Pt & { t: number }> = [];
  let k = 1;
  for (let i = 0; i < count; i += 1) {
    const goal = count === 1 ? total / 2 : (total * i) / (count - 1);
    while (k < steps && lengths[k] < goal) k += 1;
    const span = lengths[k] - lengths[k - 1] || 1;
    const f = Math.min(1, Math.max(0, (goal - lengths[k - 1]) / span));
    const t = from + ((to - from) * (k - 1 + f)) / steps;
    out.push({ ...at(t), t });
  }
  return out;
}

/** Many circles as one path, so a string of beads or a scatter of dots is a single native shape. */
export function dotsPath(dots: ReadonlyArray<readonly [x: number, y: number, r: number]>): string {
  return dots.map(([x, y, r]) => `M${n2(x - r)} ${n2(y)}a${n2(r)} ${n2(r)} 0 1 0 ${n2(2 * r)} 0a${n2(r)} ${n2(r)} 0 1 0 ${n2(-2 * r)} 0Z`).join("");
}

/** `count` rounded petals around (cx, cy), each from radius `inner` out to `outer` and `width` across. */
export function petalsPath(cx: number, cy: number, count: number, inner: number, outer: number, width: number, rotation = -90): string {
  const rx = n2((outer - inner) / 2);
  const ry = n2(width / 2);
  let d = "";
  for (let i = 0; i < count; i += 1) {
    const deg = rotation + (360 / count) * i;
    const a = (deg * Math.PI) / 180;
    const x1 = n2(cx + Math.cos(a) * inner);
    const y1 = n2(cy + Math.sin(a) * inner);
    const x2 = n2(cx + Math.cos(a) * outer);
    const y2 = n2(cy + Math.sin(a) * outer);
    d += `M${x1} ${y1}A${rx} ${ry} ${n2(deg)} 0 1 ${x2} ${y2}A${rx} ${ry} ${n2(deg)} 0 1 ${x1} ${y1}Z`;
  }
  return d;
}

/** A pointed leaf from (x, y) along `angle` degrees, `length` long and about `width` across at its widest. */
export function leafPath(x: number, y: number, angle: number, length: number, width: number): string {
  const a = (angle * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const tx = x + ux * length;
  const ty = y + uy * length;
  const mx = x + ux * length * 0.45;
  const my = y + uy * length * 0.45;
  return `M${n2(x)} ${n2(y)}Q${n2(mx - uy * width)} ${n2(my + ux * width)} ${n2(tx)} ${n2(ty)}Q${n2(mx + uy * width)} ${n2(my - ux * width)} ${n2(x)} ${n2(y)}Z`;
}

/** A soft heart centred on (cx, cy), w wide and h tall, point down. */
export function heartPath(cx: number, cy: number, w: number, h: number): string {
  const L = cx - w / 2;
  const R = cx + w / 2;
  const T = cy - h / 2;
  const B = cy + h / 2;
  return [
    `M${n2(cx)} ${n2(T + h * 0.24)}`,
    `C${n2(cx - w * 0.06)} ${n2(T + h * 0.02)} ${n2(L + w * 0.04)} ${n2(T - h * 0.02)} ${n2(L)} ${n2(T + h * 0.3)}`,
    `C${n2(L - w * 0.02)} ${n2(T + h * 0.6)} ${n2(cx - w * 0.22)} ${n2(B - h * 0.18)} ${n2(cx)} ${n2(B)}`,
    `C${n2(cx + w * 0.22)} ${n2(B - h * 0.18)} ${n2(R + w * 0.02)} ${n2(T + h * 0.6)} ${n2(R)} ${n2(T + h * 0.3)}`,
    `C${n2(R - w * 0.04)} ${n2(T - h * 0.02)} ${n2(cx + w * 0.06)} ${n2(T + h * 0.02)} ${n2(cx)} ${n2(T + h * 0.24)}Z`,
  ].join("");
}

/** A star with `points` points (outer radius `r`, inner `ri`), first point straight up. */
export function starPath(cx: number, cy: number, r: number, ri: number, points = 5, rotation = -90): string {
  let d = "";
  for (let i = 0; i < points * 2; i += 1) {
    const a = ((rotation + (180 / points) * i) * Math.PI) / 180;
    const rad = i % 2 === 0 ? r : ri;
    d += `${i === 0 ? "M" : "L"}${n2(cx + Math.cos(a) * rad)} ${n2(cy + Math.sin(a) * rad)}`;
  }
  return `${d}Z`;
}

/** A four-pointed twinkle (the little sparkle beside the glasses and the witch hat). */
export function twinklePath(cx: number, cy: number, r: number): string {
  const k = r * 0.22;
  return `M${n2(cx)} ${n2(cy - r)}Q${n2(cx + k)} ${n2(cy - k)} ${n2(cx + r)} ${n2(cy)}Q${n2(cx + k)} ${n2(cy + k)} ${n2(cx)} ${n2(cy + r)}Q${n2(cx - k)} ${n2(cy + k)} ${n2(cx - r)} ${n2(cy)}Q${n2(cx - k)} ${n2(cy - k)} ${n2(cx)} ${n2(cy - r)}Z`;
}

/** Short vertical strokes between two curves (knit ribs on a cuff), one path. */
export function ribsPath(x0: number, x1: number, step: number, top: (x: number) => number, bottom: (x: number) => number): string {
  let d = "";
  for (let x = x0; x <= x1 + 0.001; x += step) d += `M${n2(x)} ${n2(top(x))}L${n2(x)} ${n2(bottom(x))}`;
  return d;
}

/**
 * A band whose top follows one quadratic and whose lower edge is `count` scallops along another (a ruffle, a
 * lace edge). Returns the filled band, the scalloped edge on its own (for a lace stroke), the fold lines between
 * scallops and the shaded half of each pleat.
 */
export function scallopBand(top: [Pt, Pt, Pt], bottom: [Pt, Pt, Pt], count: number, depth: number): { d: string; edge: string; folds: string; pleats: string } {
  const [t0, t1, t2] = top;
  let edge = "";
  let folds = "";
  let pleats = "";
  // the shaded half of every pleat, so the gathers read as folded cloth rather than a flat band
  for (let i = 0; i < count; i += 1) {
    const ta = quadAt(t0, t1, t2, i / count);
    const tb = quadAt(t0, t1, t2, (i + 0.5) / count);
    const ba = quadAt(bottom[0], bottom[1], bottom[2], i / count);
    const bb = quadAt(bottom[0], bottom[1], bottom[2], (i + 0.5) / count);
    pleats += `M${n2(ta.x)} ${n2(ta.y)}L${n2(tb.x)} ${n2(tb.y)}L${n2(bb.x)} ${n2(bb.y + depth * 0.9)}L${n2(ba.x)} ${n2(ba.y)}Z`;
  }
  const start = quadAt(bottom[0], bottom[1], bottom[2], 0);
  edge += `M${n2(start.x)} ${n2(start.y)}`;
  for (let i = 0; i < count; i += 1) {
    const a = quadAt(bottom[0], bottom[1], bottom[2], i / count);
    const b = quadAt(bottom[0], bottom[1], bottom[2], (i + 1) / count);
    const m = quadAt(bottom[0], bottom[1], bottom[2], (i + 0.5) / count);
    // the bump bulges away from the band (outward along the normal of the chord, downward here)
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    edge += `Q${n2(m.x + (nx / len) * depth * 2)} ${n2(m.y + (ny / len) * depth * 2)} ${n2(b.x)} ${n2(b.y)}`;
    if (i > 0) {
      const tp = quadAt(t0, t1, t2, i / count);
      folds += `M${n2(tp.x + (a.x - tp.x) * 0.25)} ${n2(tp.y + (a.y - tp.y) * 0.25)}L${n2(a.x)} ${n2(a.y)}`;
    }
  }
  const end = quadAt(bottom[0], bottom[1], bottom[2], 1);
  const d = `M${n2(t0.x)} ${n2(t0.y)}Q${n2(t1.x)} ${n2(t1.y)} ${n2(t2.x)} ${n2(t2.y)}L${n2(end.x)} ${n2(end.y)}${reverseScallops(bottom, count, depth)}Z`;
  return { d, edge, folds, pleats };
}

function reverseScallops(bottom: [Pt, Pt, Pt], count: number, depth: number): string {
  let d = "";
  for (let i = count; i > 0; i -= 1) {
    const a = quadAt(bottom[0], bottom[1], bottom[2], i / count);
    const b = quadAt(bottom[0], bottom[1], bottom[2], (i - 1) / count);
    const m = quadAt(bottom[0], bottom[1], bottom[2], (i - 0.5) / count);
    const nx = a.y - b.y;
    const ny = -(a.x - b.x);
    const len = Math.hypot(nx, ny) || 1;
    // same outward bulge as the forward pass (the chord is reversed, so is the normal)
    d += `Q${n2(m.x - (nx / len) * depth * 2)} ${n2(m.y - (ny / len) * depth * 2)} ${n2(b.x)} ${n2(b.y)}`;
  }
  return d;
}
