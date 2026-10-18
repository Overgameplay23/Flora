// Neck-slot accessories, front view: the band that wraps the neck runs across the top of each drawing (curving
// down at the middle, as a collar does seen slightly from above) and whatever hangs from it sits below. The
// registry anchor is the middle of that band. Same storybook finish as the hats: gradient volume lit from the
// upper left, a soft highlight, a thin same-hue edge, no filters.

import React from "react";
import { Circle, ClipPath, Defs, Ellipse, G, Path } from "react-native-svg";
import { brand, categories } from "../../../theme/tokens";
import {
  Linear,
  Radial,
  ROUND,
  SHEEN,
  WARM_WHITE,
  artComponent,
  cubicAngle,
  cubicAt,
  dotsPath,
  evenlyAlong,
  heartPath,
  leafPath,
  mix,
  n2,
  petalsPath,
  quadAt,
  ramp,
  scallopBand,
  type Pt,
} from "./kit";

const { body, calm, connection, energy, nourish, play, rest } = categories;

// ---- bandanas (shared cut) -------------------------------------------------------------------------------

const BANDANA_TRI = "M7 13Q50 31 93 13Q81 40 55 66.5Q50 70.5 45 66.5Q19 40 7 13Z";
const BANDANA_BAND = "M3 5Q50 20 97 5Q99 8.8 97.6 12.6Q50 29 2.4 12.6Q1 8.8 3 5Z";
const BANDANA_SHADOW = "M9 15.5Q50 34 91 15.5Q50 41 9 15.5Z";

/** Parallel stripes across a generous square, for gingham (two crossed layers at half opacity). */
function stripes(axis: "x" | "y", period: number, width: number): string {
  let d = "";
  for (let v = -40; v <= 140; v += period) {
    d += axis === "x" ? `M${n2(v)} -40h${width}V140h${-width}Z` : `M-40 ${n2(v)}v${width}H140v${-width}Z`;
  }
  return d;
}

// ---- Red bandana -----------------------------------------------------------------------------------------

const RED = ramp(mix("#CC4F3E", energy.mid, 0.15), energy.strong, 0.38);
const RED_CREAM = mix(WARM_WHITE, energy.tint, 0.4);
const RED_FLOWERS = dotsPath(
  [[28, 27], [50, 36], [72, 27], [39, 47], [61, 47], [50, 58]].flatMap(([x, y]) => [
    [x - 1.7, y, 1.05] as const,
    [x + 1.7, y, 1.05] as const,
    [x, y - 1.7, 1.05] as const,
    [x, y + 1.7, 1.05] as const,
  ])
);
const RED_SPECKS = dotsPath([[19, 22, 0.8], [81, 22, 0.8], [39, 33, 0.7], [61, 33, 0.7], [50, 46, 0.8], [33, 38, 0.6], [67, 38, 0.6]]);

export const BandanaRed = artComponent("BandanaRed", 100, 72, (u) => (
  <>
    <Defs>
      <Linear id={u.id("cloth")} stops={[[0, RED.base], [0.6, RED.base], [1, RED.shade]]} />
      <Linear id={u.id("band")} stops={[[0, RED.light], [0.45, RED.base], [1, RED.shade]]} />
      <Radial id={u.id("hl")} cx={0.5} cy={0.5} r={0.5} stops={SHEEN} />
    </Defs>
    <Path d={BANDANA_TRI} fill={u.url("cloth")} stroke={RED.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M13.5 21Q24.5 41 48.4 62.6M86.5 21Q75.5 41 51.6 62.6" fill="none" stroke={RED_CREAM} strokeOpacity={0.75} strokeWidth={0.9} strokeDasharray="2.4 1.8" />
    <Path d={RED_FLOWERS} fill={RED_CREAM} fillOpacity={0.9} />
    <Path d={RED_SPECKS} fill={RED_CREAM} fillOpacity={0.7} />
    <Ellipse cx={36} cy={33} rx={10} ry={5} fill={u.url("hl")} transform="rotate(35 36 33)" />
    <Path d={BANDANA_SHADOW} fill={RED.edge} fillOpacity={0.35} />
    <Path d={BANDANA_BAND} fill={u.url("band")} stroke={RED.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M5 9Q50 24.5 95 9" fill="none" stroke={RED_CREAM} strokeOpacity={0.7} strokeWidth={0.8} strokeDasharray="2.2 1.8" />
  </>
));

// ---- Picnic gingham bandana ------------------------------------------------------------------------------

const GINGHAM_CLOTH = mix(body.tint, WARM_WHITE, 0.3);
const GINGHAM_INK = mix(body.mid, body.strong, 0.32);
const GINGHAM_EDGE = mix(body.mid, body.strong, 0.7);
const GINGHAM_X = stripes("x", 8, 4);
const GINGHAM_Y = stripes("y", 8, 4);

export const BandanaGingham = artComponent("BandanaGingham", 100, 72, (u) => (
  <>
    <Defs>
      <ClipPath id={u.id("tri")}>
        <Path d={BANDANA_TRI} />
      </ClipPath>
      <ClipPath id={u.id("band")}>
        <Path d={BANDANA_BAND} />
      </ClipPath>
      <Linear id={u.id("shade")} stops={[[0, body.strong, 0], [0.7, body.strong, 0.06], [1, body.strong, 0.2]]} />
      <Radial id={u.id("hl")} cx={0.5} cy={0.5} r={0.5} stops={SHEEN} />
    </Defs>
    <Path d={BANDANA_TRI} fill={GINGHAM_CLOTH} />
    <G clipPath={u.url("tri")}>
      <G transform="rotate(45 50 40)">
        <Path d={GINGHAM_X} fill={GINGHAM_INK} fillOpacity={0.42} />
        <Path d={GINGHAM_Y} fill={GINGHAM_INK} fillOpacity={0.42} />
      </G>
    </G>
    <Path d={BANDANA_TRI} fill={u.url("shade")} stroke={GINGHAM_EDGE} strokeWidth={1.1} strokeLinejoin="round" />
    <Ellipse cx={36} cy={33} rx={10} ry={5} fill={u.url("hl")} transform="rotate(35 36 33)" />
    <Path d={BANDANA_SHADOW} fill={body.strong} fillOpacity={0.25} />
    <Path d={BANDANA_BAND} fill={GINGHAM_CLOTH} />
    <G clipPath={u.url("band")}>
      <G transform="rotate(45 50 40)">
        <Path d={GINGHAM_X} fill={GINGHAM_INK} fillOpacity={0.42} />
        <Path d={GINGHAM_Y} fill={GINGHAM_INK} fillOpacity={0.42} />
      </G>
    </G>
    <Path d={BANDANA_BAND} fill={u.url("shade")} stroke={GINGHAM_EDGE} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M6 7.6Q50 22.4 94 7.6" fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.1} {...ROUND} />
  </>
));

// ---- Sky collar with tag ---------------------------------------------------------------------------------

const COLLAR_BAND = "M2 5Q50 21 98 5Q99.6 9.5 98 14Q50 31 2 14Q0.4 9.5 2 5Z";
const SKY = ramp(nourish.mid, nourish.strong, 0.45);
const TAG = ramp(mix(play.mid, brand.gold, 0.3), play.strong, 0.5);

export const CollarSky = artComponent("CollarSky", 100, 50, (u) => (
  <>
    <Defs>
      <Linear id={u.id("band")} stops={[[0, SKY.light], [0.45, SKY.base], [1, SKY.shade]]} />
      <Radial id={u.id("tag")} stops={[[0, TAG.light], [0.5, TAG.base], [1, TAG.shade]]} />
    </Defs>
    <Path d={COLLAR_BAND} fill={u.url("band")} stroke={SKY.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M4.5 9.6Q50 26 95.5 9.6" fill="none" stroke={WARM_WHITE} strokeOpacity={0.7} strokeWidth={0.8} strokeDasharray="2 1.6" />
    <Path d="M5 7Q50 21.8 95 7" fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={0.9} {...ROUND} />
    <Circle cx={50} cy={26} r={3.5} fill="none" stroke={TAG.edge} strokeWidth={1.7} />
    <Circle cx={50} cy={37.5} r={8.6} fill={u.url("tag")} stroke={TAG.edge} strokeWidth={1} />
    <Path d={heartPath(50, 38.2, 7, 6.2)} fill="none" stroke={TAG.shade} strokeOpacity={0.8} strokeWidth={0.9} strokeLinejoin="round" />
    <Path d="M43.6 34A7.4 7.4 0 0 1 48.8 30.4" fill="none" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={1.1} {...ROUND} />
  </>
));

// ---- Little bell collar ----------------------------------------------------------------------------------

const VELVET = ramp(mix(connection.strong, energy.mid, 0.3), connection.strong, 0.4);
const BRASS = ramp(mix(play.mid, brand.gold, 0.5), play.strong, 0.5);
const BRASS_DEEP = mix(play.strong, "#3A2A10", 0.35);

export const BellCollar = artComponent("BellCollar", 100, 54, (u) => (
  <>
    <Defs>
      <Linear id={u.id("band")} stops={[[0, VELVET.light], [0.4, VELVET.base], [1, VELVET.shade]]} />
      <Radial id={u.id("bell")} cx={0.36} cy={0.28} r={0.8} stops={[[0, mix(BRASS.light, WARM_WHITE, 0.5)], [0.3, BRASS.light], [0.65, BRASS.base], [1, BRASS.edge]]} />
    </Defs>
    <Path d={COLLAR_BAND} fill={u.url("band")} stroke={VELVET.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M4.5 9.6Q50 26 95.5 9.6" fill="none" stroke={VELVET.light} strokeOpacity={0.7} strokeWidth={0.8} strokeDasharray="2 1.6" />
    <Path d="M5 7Q50 21.8 95 7" fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.9} {...ROUND} />
    <Circle cx={50} cy={25.6} r={3} fill="none" stroke={BRASS.edge} strokeWidth={1.8} />
    <Circle cx={50} cy={39} r={12} fill={u.url("bell")} stroke={BRASS.edge} strokeWidth={1} />
    <Path d="M38.4 37Q50 42 61.6 37" fill="none" stroke={BRASS.shade} strokeWidth={1.3} {...ROUND} />
    <Path d="M39.2 39.6Q50 44.4 60.8 39.6" fill="none" stroke={BRASS.light} strokeOpacity={0.75} strokeWidth={0.8} {...ROUND} />
    <Path d="M50 45L50 50.5" fill="none" stroke={BRASS_DEEP} strokeWidth={1.8} {...ROUND} />
    <Circle cx={50} cy={45} r={2.2} fill={BRASS_DEEP} />
    <Ellipse cx={44.6} cy={32.6} rx={3.6} ry={2} fill="#FFFFFF" fillOpacity={0.7} transform="rotate(-32 44.6 32.6)" />
  </>
));

// ---- Plum bow tie ----------------------------------------------------------------------------------------

const PLUM = ramp(mix(calm.strong, connection.strong, 0.25), brand.plum, 0.4);

export const BowtiePlum = artComponent("BowtiePlum", 100, 40, (u) => (
  <>
    <Defs>
      <Radial id={u.id("wing")} cx={0.45} cy={0.28} r={0.85} stops={[[0, PLUM.light], [0.5, PLUM.base], [1, PLUM.shade]]} />
      <Linear id={u.id("knot")} stops={[[0, PLUM.light], [0.5, PLUM.base], [1, PLUM.edge]]} />
    </Defs>
    <Path d="M2 6Q50 20 98 6Q99.4 8.5 98 11Q50 25.5 2 11Q0.6 8.5 2 6Z" fill={PLUM.shade} stroke={PLUM.edge} strokeWidth={0.9} strokeLinejoin="round" />
    <Path d="M46 12C38 6 26 2.5 21.5 6.5C17.5 12 17.5 24 21.5 30C26 34 38 28 46 22ZM54 12C62 6 74 2.5 78.5 6.5C82.5 12 82.5 24 78.5 30C74 34 62 28 54 22Z" fill={u.url("wing")} stroke={PLUM.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M44 14.5C37 12 29 10 24 11M44 19.5C37 22 29 25 24 25.5M56 14.5C63 12 71 10 76 11M56 19.5C63 22 71 25 76 25.5" fill="none" stroke={PLUM.shade} strokeOpacity={0.7} strokeWidth={1} {...ROUND} />
    <Path d={dotsPath([[30, 15.6, 1.1], [27, 21.4, 1.1], [36, 21, 1], [70, 15.6, 1.1], [73, 21.4, 1.1], [64, 21, 1]])} fill={WARM_WHITE} fillOpacity={0.7} />
    <Path d="M23.5 8.5C28 6 36 8 43 12.5M76.5 8.5C72 6 64 8 57 12.5" fill="none" stroke={PLUM.light} strokeOpacity={0.8} strokeWidth={1.2} {...ROUND} />
    <Path d="M44 9.6Q50 7.8 56 9.6L56.8 22.4Q50 24.4 43.2 22.4Z" fill={u.url("knot")} stroke={PLUM.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M47 11.6Q48.4 15.5 47.2 20" fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={1} {...ROUND} />
  </>
));

// ---- Flower lei ------------------------------------------------------------------------------------------

const LEI: [Pt, Pt, Pt, Pt] = [{ x: 8, y: 8 }, { x: 12, y: 64 }, { x: 88, y: 64 }, { x: 92, y: 8 }];
const LEI_ROSE = ramp(connection.mid, connection.strong, 0.5);
const LEI_DEEP = ramp(mix(connection.mid, connection.strong, 0.35), connection.strong, 0.45);
const LEI_TONES = ["rose", "cream", "deep", "blush"] as const;
const LEI_BLOOMS = Array.from({ length: 11 }, (_, i) => {
  const t = 0.03 + i * 0.094;
  const p = cubicAt(LEI[0], LEI[1], LEI[2], LEI[3], t);
  return { x: p.x, y: p.y, r: 7.2 + 1.2 * (1 - Math.abs(2 * t - 1)), t, tone: LEI_TONES[i % 4], spin: -90 + i * 23 };
}).sort((a, b) => Math.abs(b.t - 0.5) - Math.abs(a.t - 0.5));
const LEI_LEAVES = Array.from({ length: 10 }, (_, i) => {
  const t = 0.08 + i * 0.094;
  const p = cubicAt(LEI[0], LEI[1], LEI[2], LEI[3], t);
  const out = cubicAngle(LEI[0], LEI[1], LEI[2], LEI[3], t) + (i % 2 === 0 ? 90 : -90);
  return leafPath(p.x, p.y, out, 9.5, 3.2);
}).join("");

export const FlowerLei = artComponent("FlowerLei", 100, 70, (u) => (
  <>
    <Defs>
      <Radial id={u.id("rose")} cx={0.5} cy={0.5} r={0.5} stops={[[0, LEI_ROSE.shade], [0.35, LEI_ROSE.base], [1, LEI_ROSE.light]]} />
      <Radial id={u.id("deep")} cx={0.5} cy={0.5} r={0.5} stops={[[0, LEI_DEEP.edge], [0.35, LEI_DEEP.shade], [1, LEI_DEEP.base]]} />
      <Radial id={u.id("cream")} cx={0.5} cy={0.5} r={0.5} stops={[[0, mix(play.mid, WARM_WHITE, 0.3)], [0.35, WARM_WHITE], [1, mix(WARM_WHITE, connection.tint, 0.6)]]} />
      <Radial id={u.id("blush")} cx={0.5} cy={0.5} r={0.5} stops={[[0, connection.mid], [0.4, mix(connection.tint, connection.mid, 0.4)], [1, connection.tint]]} />
    </Defs>
    <Path d={LEI_LEAVES} fill={mix(body.mid, body.strong, 0.2)} stroke={mix(body.mid, body.strong, 0.6)} strokeWidth={0.5} />
    {LEI_BLOOMS.map((b, i) => (
      <Path
        key={i}
        d={petalsPath(b.x, b.y, 5, b.r * 0.1, b.r, b.r * 0.86, b.spin)}
        fill={u.url(b.tone)}
        stroke={b.tone === "cream" || b.tone === "blush" ? mix(connection.mid, WARM_WHITE, 0.2) : LEI_ROSE.edge}
        strokeOpacity={0.6}
        strokeWidth={0.5}
      />
    ))}
    <Path d={dotsPath(LEI_BLOOMS.map((b) => [b.x, b.y, b.r * 0.2] as const))} fill={mix(play.mid, brand.gold, 0.3)} />
  </>
));

// ---- Ruffle collar ---------------------------------------------------------------------------------------

const PERI = ramp(rest.mid, rest.strong, 0.5);
// both layers taper to nothing at the sides, where the ring turns away behind the neck
const RUFFLE_BACK = scallopBand([{ x: 1, y: 10 }, { x: 50, y: 23 }, { x: 99, y: 10 }], [{ x: 1, y: 12 }, { x: 50, y: 47 }, { x: 99, y: 12 }], 11, 3);
const RUFFLE_FRONT = scallopBand([{ x: 7, y: 12 }, { x: 50, y: 24 }, { x: 93, y: 12 }], [{ x: 8, y: 14 }, { x: 50, y: 40 }, { x: 92, y: 14 }], 9, 2.6);
const LACE = mix(WARM_WHITE, rest.tint, 0.3);

export const RuffleCollar = artComponent("RuffleCollar", 100, 40, (u) => (
  <>
    <Defs>
      <Linear id={u.id("back")} stops={[[0, PERI.base], [1, PERI.shade]]} />
      <Linear id={u.id("front")} stops={[[0, PERI.light], [0.55, mix(PERI.light, PERI.base, 0.6)], [1, PERI.base]]} />
      <Radial id={u.id("pearl")} stops={[[0, "#FFFFFF"], [0.5, mix(WARM_WHITE, rest.tint, 0.6)], [1, rest.mid]]} />
    </Defs>
    <Path d={RUFFLE_BACK.d} fill={u.url("back")} stroke={PERI.edge} strokeWidth={0.9} strokeLinejoin="round" />
    <Path d={RUFFLE_BACK.pleats} fill={PERI.edge} fillOpacity={0.22} />
    <Path d={RUFFLE_BACK.edge} fill="none" stroke={LACE} strokeOpacity={0.75} strokeWidth={1} strokeDasharray="0.1 1.9" {...ROUND} />
    <Path d={RUFFLE_FRONT.d} fill={u.url("front")} stroke={PERI.edge} strokeWidth={0.9} strokeLinejoin="round" />
    <Path d={RUFFLE_FRONT.pleats} fill={PERI.shade} fillOpacity={0.3} />
    <Path d={RUFFLE_FRONT.folds} fill="none" stroke={PERI.shade} strokeOpacity={0.5} strokeWidth={0.8} {...ROUND} />
    <Path d={RUFFLE_FRONT.edge} fill="none" stroke={LACE} strokeWidth={1.3} {...ROUND} />
    <Path d="M12 14.4Q50 26.4 88 14.4" fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1} {...ROUND} />
    <Circle cx={50} cy={21.8} r={2.6} fill={u.url("pearl")} stroke={PERI.shade} strokeWidth={0.5} />
  </>
));

// ---- Pearl necklace --------------------------------------------------------------------------------------

const PEARL_ARC: [Pt, Pt, Pt] = [{ x: 5, y: 6 }, { x: 50, y: 50 }, { x: 95, y: 6 }];
const PEARLS = evenlyAlong((t) => quadAt(PEARL_ARC[0], PEARL_ARC[1], PEARL_ARC[2], t), 15).map((p) => ({
  x: p.x,
  y: p.y,
  r: 3.5 + 1.3 * (1 - Math.abs(2 * p.t - 1)),
}));
const PEARL_SHADOWS = dotsPath(PEARLS.map((p) => [p.x + 0.5, p.y + 1.2, p.r] as const));
const PEARL_GLINTS = dotsPath([...PEARLS.map((p) => [p.x - p.r * 0.36, p.y - p.r * 0.38, p.r * 0.24] as const), [48.6, 39.6, 0.9]]);
const PEARL_TONES = {
  hi: "#FFFFFF",
  body: mix(WARM_WHITE, rest.tint, 0.5),
  cool: mix(rest.tint, rest.mid, 0.45),
  // the faint pink-lilac blush at the rim that makes it read as pearl rather than plastic
  rim: mix(rest.mid, connection.mid, 0.4),
};

export const PearlNecklace = artComponent("PearlNecklace", 100, 48, (u) => (
  <>
    <Defs>
      <Radial id={u.id("pearl")} cx={0.36} cy={0.3} r={0.72} stops={[[0, PEARL_TONES.hi], [0.35, PEARL_TONES.body], [0.8, PEARL_TONES.cool], [1, PEARL_TONES.rim]]} />
    </Defs>
    <Path d="M5 6Q50 50 95 6" fill="none" stroke={mix(rest.mid, rest.strong, 0.3)} strokeOpacity={0.6} strokeWidth={0.8} />
    <Path d={PEARL_SHADOWS} fill={rest.strong} fillOpacity={0.14} />
    {PEARLS.map((p, i) => (
      <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={u.url("pearl")} stroke={PEARL_TONES.rim} strokeOpacity={0.7} strokeWidth={0.4} />
    ))}
    <Path d="M48.2 32.2L51.8 32.2L51.4 34.6L48.6 34.6Z" fill={mix(play.mid, brand.gold, 0.4)} stroke={play.strong} strokeOpacity={0.6} strokeWidth={0.4} />
    <Path d="M50 34.2C53.4 37.4 54.6 40.4 54.6 42.2C54.6 44.9 52.6 46.6 50 46.6C47.4 46.6 45.4 44.9 45.4 42.2C45.4 40.4 46.6 37.4 50 34.2Z" fill={u.url("pearl")} stroke={PEARL_TONES.rim} strokeOpacity={0.7} strokeWidth={0.4} />
    <Path d={PEARL_GLINTS} fill="#FFFFFF" fillOpacity={0.9} />
  </>
));

// ---- Chunky knit scarf -----------------------------------------------------------------------------------

const SCARF = ramp(mix(energy.mid, energy.strong, 0.28), energy.strong, 0.4);
const SCARF_STRIPE = mix(WARM_WHITE, energy.tint, 0.5);

function tailStitches(): string {
  let d = "";
  for (let y = 31; y <= 68; y += 5) {
    const drift = (y - 24) * 0.072;
    for (const x of [57.8, 64.2, 70.6]) {
      d += `M${n2(x + drift)} ${y}L${n2(x + drift + 2.5)} ${y + 3}L${n2(x + drift + 5)} ${y}`;
    }
  }
  return d;
}

/** Little "v" stitches in a grid across both rolls of the wrap, following its curve. */
function wrapStitches(): string {
  let d = "";
  const curve = (x: number) => ((x - 50) / 48) ** 2;
  const rows = [
    { y: (x: number) => 14 + 3 * curve(x), reach: 43 },
    { y: (x: number) => 18.6 + 2.6 * curve(x), reach: 44 },
    { y: (x: number) => 27.6 + 1.2 * curve(x), reach: 42 },
    { y: (x: number) => 31.6, reach: 36 },
  ];
  for (const row of rows) {
    for (let x = 50 - row.reach; x <= 50 + row.reach - 3.4 + 0.001; x += 4.4) {
      const y = row.y(x + 1.7);
      d += `M${n2(x)} ${n2(y - 1.3)}L${n2(x + 1.7)} ${n2(y + 1.3)}L${n2(x + 3.4)} ${n2(y - 1.3)}`;
    }
  }
  return d;
}

const SCARF_TAIL_STITCHES = tailStitches();
const SCARF_WRAP_STITCHES = wrapStitches();
const SCARF_FRINGE = Array.from({ length: 6 }, (_, i) => {
  const x = 60.4 + i * 3.8;
  return `M${n2(x)} 71.6L${n2(x - 0.6 + (i % 2) * 1.2)} ${n2(80.5 + (i % 3))}`;
}).join("");

export const KnitScarf = artComponent("KnitScarf", 100, 88, (u) => (
  <>
    <Defs>
      <Linear id={u.id("tail")} x2={1} y2={0} stops={[[0, SCARF.light], [0.4, SCARF.base], [1, SCARF.shade]]} />
      <Linear id={u.id("wrap")} stops={[[0, SCARF.light], [0.45, SCARF.base], [1, SCARF.shade]]} />
    </Defs>
    <Path d={SCARF_FRINGE} fill="none" stroke={SCARF.shade} strokeWidth={2.2} {...ROUND} />
    <Path d="M55 24C57 38 58.5 56 58.5 72L80.5 70.4C79 54 77.5 38 75.5 24Z" fill={u.url("tail")} stroke={SCARF.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M58.1 57.6L79.4 56L79.8 61.8L58.3 63.4Z" fill={SCARF_STRIPE} fillOpacity={0.9} />
    <Path d={SCARF_TAIL_STITCHES} fill="none" stroke={SCARF.shade} strokeOpacity={0.55} strokeWidth={1.1} {...ROUND} />
    <Path d="M56.2 33.5L76.2 33.5L76.8 39Q66 41 57 39Z" fill={SCARF.edge} fillOpacity={0.35} />
    <Path d="M1.5 13C8 4 30 6 50 10C70 6 92 4 98.5 13C100 23 92 33 80 35C66 37 58 35 50 35C42 35 34 37 20 35C8 33 0 23 1.5 13Z" fill={u.url("wrap")} stroke={SCARF.edge} strokeWidth={1.2} strokeLinejoin="round" />
    <Path d="M3 22C20 26.5 38 25 50 23.4C62 25 80 26.5 97 22" fill="none" stroke={SCARF.shade} strokeOpacity={0.75} strokeWidth={1.4} {...ROUND} />
    <Path d={SCARF_WRAP_STITCHES} fill="none" stroke={SCARF.shade} strokeOpacity={0.5} strokeWidth={0.9} {...ROUND} />
    <Path d="M9 11.5C22 7.4 36 8.6 47 11.6" fill="none" stroke={SCARF.light} strokeOpacity={0.8} strokeWidth={1.4} {...ROUND} />
  </>
));

// ---- Autumn leaf garland ---------------------------------------------------------------------------------

const TWINE: [Pt, Pt, Pt, Pt] = [{ x: 6, y: 6 }, { x: 14, y: 50 }, { x: 86, y: 50 }, { x: 94, y: 6 }];
const TWINE_COLOR = mix(energy.strong, "#6B4F3A", 0.5);
const MAPLE = "M0 2L-2.6 4.4L-6.6 3.2L-5 7L-10 9.2L-6.6 11L-7.4 12.8L-3.2 12.4L-2.8 15.4L0 19L2.8 15.4L3.2 12.4L7.4 12.8L6.6 11L10 9.2L5 7L6.6 3.2L2.6 4.4Z";
const MAPLE_VEINS = "M0 -1L0 16.5M0 3L-7.4 9M0 3L7.4 9";
const OVAL = "M0 1.5C5.6 4.5 7 11 0 19C-7 11 -5.6 4.5 0 1.5Z";
const OVAL_VEINS = "M0 -1L0 17M0 7.4L3 5.2M0 11.4L3.4 8.8M0 7.4L-3 5.2M0 11.4L-3.4 8.8";
const AUTUMN = {
  rust: ramp(mix(energy.strong, energy.mid, 0.3), energy.strong, 0.4),
  apricot: ramp(energy.mid, energy.strong, 0.4),
  gold: ramp(mix(play.mid, brand.gold, 0.5), play.strong, 0.4),
  cranberry: ramp(mix(connection.strong, energy.strong, 0.45), connection.strong, 0.35),
};
const AUTUMN_ORDER = ["rust", "gold", "cranberry", "apricot"] as const;
const GARLAND_LEAVES = Array.from({ length: 9 }, (_, i) => {
  const t = 0.08 + i * 0.105;
  const p = cubicAt(TWINE[0], TWINE[1], TWINE[2], TWINE[3], t);
  const tangent = cubicAngle(TWINE[0], TWINE[1], TWINE[2], TWINE[3], t);
  // leaves hang down, swinging a little either way, with a touch of lean where the twine is steep
  const lean = (i % 2 === 0 ? 7 : -7) + tangent * 0.12;
  const scale = 0.86 + 0.16 * (1 - Math.abs(2 * t - 1));
  return { x: p.x, y: p.y, lean, scale, maple: i % 2 === 0, tone: AUTUMN_ORDER[i % 4] };
}).sort((a, b) => Math.abs(b.x - 50) - Math.abs(a.x - 50));

export const LeafGarland = artComponent("LeafGarland", 100, 60, (u) => (
  <>
    <Defs>
      {AUTUMN_ORDER.map((tone) => (
        <Linear key={tone} id={u.id(tone)} x1={0} y1={0} x2={1} y2={1} stops={[[0, AUTUMN[tone].light], [0.5, AUTUMN[tone].base], [1, AUTUMN[tone].shade]]} />
      ))}
    </Defs>
    <Path d="M6 6C14 50 86 50 94 6" fill="none" stroke={TWINE_COLOR} strokeWidth={1.2} {...ROUND} />
    {GARLAND_LEAVES.map((leaf, i) => (
      <G key={i} transform={`translate(${n2(leaf.x)} ${n2(leaf.y)}) rotate(${n2(leaf.lean)}) scale(${n2(leaf.scale)})`}>
        <Path d={leaf.maple ? MAPLE : OVAL} fill={u.url(leaf.tone)} stroke={AUTUMN[leaf.tone].edge} strokeWidth={0.6} strokeLinejoin="round" />
        <Path d={leaf.maple ? MAPLE_VEINS : OVAL_VEINS} fill="none" stroke={AUTUMN[leaf.tone].edge} strokeOpacity={0.65} strokeWidth={0.6} {...ROUND} />
      </G>
    ))}
    <Path d={dotsPath([[6, 6, 1.4], [94, 6, 1.4]])} fill={TWINE_COLOR} />
  </>
));
