// Head-slot accessories (the "hats" category: hats, bows, crowns), drawn front view in the storybook style of
// the painted pet: gradient volume lit from the upper left, a soft highlight, a thin same-hue edge, and one or
// two believable details each. Every drawing is a handful of shapes, no filters. Placement (anchor, width) lives
// in the registry (./index.ts).

import React from "react";
import { Circle, Defs, Ellipse, G, Path } from "react-native-svg";
import { brand, categories } from "../../../theme/tokens";
import {
  Linear,
  Radial,
  ROUND,
  SHEEN,
  WARM_WHITE,
  artComponent,
  dotsPath,
  evenlyAlong,
  leafPath,
  mix,
  n2,
  petalsPath,
  quadAt,
  ramp,
  ribsPath,
  starPath,
  twinklePath,
  type Pt,
} from "./kit";

const { body, calm, connection, cycle, energy, focus, play } = categories;

/** A folded knit cuff whose top sits at y (curving up 2.5 at the middle) and is h deep. */
function knitCuff(y: number, h: number) {
  const bow = (x: number) => {
    const t = Math.min(1, Math.max(0, (x - 12) / 76));
    return 10 * t * (1 - t);
  };
  return {
    d: `M6 ${y + 6}Q6 ${y} 12 ${y}Q50 ${y - 5} 88 ${y}Q94 ${y} 94 ${y + 6}L94 ${y + h - 6}Q94 ${y + h} 88 ${y + h}Q50 ${y + h + 5} 12 ${y + h}Q6 ${y + h} 6 ${y + h - 6}Z`,
    ribs: ribsPath(15, 85, 5, (x) => y - bow(x) + 3, (x) => y + h + bow(x) - 3),
    ribLights: ribsPath(16.5, 86.5, 5, (x) => y - bow(x) + 3.5, (x) => y + h + bow(x) - 3.5),
    rim: `M13 ${y + 2.4}Q50 ${y - 2.6} 87 ${y + 2.4}`,
  };
}

// ---- Sage knit beanie ------------------------------------------------------------------------------------

const SAGE = ramp(mix(focus.mid, body.mid, 0.45), focus.strong);
const BEANIE_DOME = "M10 64C10 31 28 19 50 19C72 19 90 31 90 64Z";
const BEANIE_DOME_RIBS = "M50 22L50 60M39 23Q34 41 33 60M61 23Q66 41 67 60M28.5 28Q21.5 44 21 60M71.5 28Q78.5 44 79 60";
const BEANIE_CUFF = knitCuff(58, 23);

export const BeanieSage = artComponent("BeanieSage", 100, 86, (u) => (
  <>
    <Defs>
      <Radial id={u.id("dome")} cx={0.34} cy={0.2} r={0.95} stops={[[0, SAGE.light], [0.5, SAGE.base], [1, SAGE.shade]]} />
      <Radial id={u.id("pom")} cx={0.36} cy={0.3} r={0.8} stops={[[0, SAGE.light], [0.55, SAGE.base], [1, SAGE.shade]]} />
      <Linear id={u.id("cuff")} stops={[[0, mix(SAGE.base, SAGE.light, 0.55)], [0.5, SAGE.base], [1, SAGE.shade]]} />
      <Radial id={u.id("hl")} cx={0.5} cy={0.5} r={0.5} stops={SHEEN} />
    </Defs>
    <Path d={BEANIE_DOME} fill={u.url("dome")} stroke={SAGE.edge} strokeWidth={1.2} />
    <Path d={BEANIE_DOME_RIBS} fill="none" stroke={SAGE.shade} strokeOpacity={0.55} strokeWidth={1.6} {...ROUND} />
    <Ellipse cx={33} cy={35} rx={12} ry={6.5} fill={u.url("hl")} transform="rotate(-32 33 35)" />
    <Path d={BEANIE_CUFF.d} fill={u.url("cuff")} stroke={SAGE.edge} strokeWidth={1.2} />
    <Path d={BEANIE_CUFF.ribs} fill="none" stroke={SAGE.shade} strokeOpacity={0.5} strokeWidth={2.1} {...ROUND} />
    <Path d={BEANIE_CUFF.ribLights} fill="none" stroke={SAGE.light} strokeOpacity={0.55} strokeWidth={0.9} {...ROUND} />
    <Path d={BEANIE_CUFF.rim} fill="none" stroke={SAGE.light} strokeOpacity={0.75} strokeWidth={1.1} {...ROUND} />
    <Circle cx={50} cy={13} r={11} fill={u.url("pom")} stroke={SAGE.edge} strokeWidth={1.1} />
    <Path d="M43 10q2.5-2.5 5 0M50.5 7q2.5-2.5 5 0M45 16q2.5-2.5 5 0M52.5 13.5q2.5-2.5 5 0" fill="none" stroke={SAGE.shade} strokeOpacity={0.6} strokeWidth={1.1} {...ROUND} />
  </>
));

// ---- Pumpkin beanie --------------------------------------------------------------------------------------

const PUMPKIN = ramp(mix(energy.mid, "#E5782F", 0.45), energy.strong);
const PUMPKIN_CUFF_TONE = ramp(mix(PUMPKIN.base, energy.strong, 0.22), energy.strong, 0.35);
const STEM = mix(body.strong, "#7A5A3A", 0.55);
const PUMPKIN_DOME = "M9 66C9 33 27 21 50 21C73 21 91 33 91 66Z";
const PUMPKIN_GROOVES = "M50 23L50 62M38 24C31 36 30 50 32 62M62 24C69 36 70 50 68 62M27 30C19.5 41 18.5 52 19.5 62M73 30C80.5 41 81.5 52 80.5 62";
const PUMPKIN_LOBE_LIGHTS = "M44.5 27Q42.5 42 44 58M26 36Q24 46 25 56M56 27Q54.5 42 56 58M75 36Q74 46 75 56";
const PUMPKIN_CUFF = knitCuff(60, 23);

export const PumpkinBeanie = artComponent("PumpkinBeanie", 100, 88, (u) => (
  <>
    <Defs>
      <Radial id={u.id("dome")} cx={0.34} cy={0.2} r={0.95} stops={[[0, PUMPKIN.light], [0.5, PUMPKIN.base], [1, PUMPKIN.shade]]} />
      <Linear id={u.id("cuff")} stops={[[0, mix(PUMPKIN_CUFF_TONE.base, PUMPKIN_CUFF_TONE.light, 0.5)], [0.5, PUMPKIN_CUFF_TONE.base], [1, PUMPKIN_CUFF_TONE.shade]]} />
      <Linear id={u.id("leaf")} x2={1} y2={0} stops={[[0, mix(body.mid, WARM_WHITE, 0.2)], [1, mix(body.mid, body.strong, 0.4)]]} />
      <Radial id={u.id("hl")} cx={0.5} cy={0.5} r={0.5} stops={SHEEN} />
    </Defs>
    <Path d="M46.5 22C46 15 48 9.5 52.5 5.5C54.5 4 57.5 5.6 56.4 7.8C53.6 11.4 52.6 16 53.4 22Z" fill={STEM} stroke={mix(STEM, "#3E2E22", 0.45)} strokeWidth={1} />
    <Path d="M47 15C41 14 38.5 9 41.5 6.5C44 4.6 46.8 7 44.8 8.8" fill="none" stroke={STEM} strokeWidth={1.3} {...ROUND} />
    <Path d={PUMPKIN_DOME} fill={u.url("dome")} stroke={PUMPKIN.edge} strokeWidth={1.2} />
    <Path d={PUMPKIN_GROOVES} fill="none" stroke={PUMPKIN.shade} strokeOpacity={0.6} strokeWidth={1.7} {...ROUND} />
    <Path d={PUMPKIN_LOBE_LIGHTS} fill="none" stroke={PUMPKIN.light} strokeOpacity={0.5} strokeWidth={2.2} {...ROUND} />
    <Ellipse cx={34} cy={36} rx={11} ry={6} fill={u.url("hl")} transform="rotate(-32 34 36)" />
    <Path d="M54 14C60 6.5 70 6 75 10C69.5 15.5 61 16.5 54 14Z" fill={u.url("leaf")} stroke={mix(body.mid, body.strong, 0.7)} strokeWidth={0.9} />
    <Path d="M55.5 13.6C61 11.4 67 10.2 72.5 10.4" fill="none" stroke={mix(body.mid, body.strong, 0.7)} strokeOpacity={0.7} strokeWidth={0.8} {...ROUND} />
    <Path d={PUMPKIN_CUFF.d} fill={u.url("cuff")} stroke={PUMPKIN.edge} strokeWidth={1.2} />
    <Path d={PUMPKIN_CUFF.ribs} fill="none" stroke={PUMPKIN_CUFF_TONE.shade} strokeOpacity={0.55} strokeWidth={2.1} {...ROUND} />
    <Path d={PUMPKIN_CUFF.ribLights} fill="none" stroke={PUMPKIN_CUFF_TONE.light} strokeOpacity={0.5} strokeWidth={0.9} {...ROUND} />
    <Path d={PUMPKIN_CUFF.rim} fill="none" stroke={PUMPKIN_CUFF_TONE.light} strokeOpacity={0.7} strokeWidth={1.1} {...ROUND} />
  </>
));

// ---- Party hat -------------------------------------------------------------------------------------------

const GOLD = ramp(play.mid, play.strong, 0.5);
const PARTY_ROSE = ramp(connection.mid, connection.strong);
const CONE_APEX: Pt = { x: 30, y: 12 };
const CONE_L: Pt = { x: 4, y: 80 };
const CONE_R: Pt = { x: 56, y: 80 };

/** A band around the cone between s0 and s1 (0 apex, 1 base), sagging like the base ellipse does. */
function coneBand(s0: number, s1: number): string {
  const at = (p: Pt, s: number) => ({ x: CONE_APEX.x + (p.x - CONE_APEX.x) * s, y: CONE_APEX.y + (p.y - CONE_APEX.y) * s });
  const l0 = at(CONE_L, s0);
  const r0 = at(CONE_R, s0);
  const l1 = at(CONE_L, s1);
  const r1 = at(CONE_R, s1);
  return `M${n2(l0.x)} ${n2(l0.y)}Q30 ${n2(l0.y + 16 * s0)} ${n2(r0.x)} ${n2(r0.y)}L${n2(r1.x)} ${n2(r1.y)}Q30 ${n2(r1.y + 16 * s1)} ${n2(l1.x)} ${n2(l1.y)}Z`;
}

const PARTY_BANDS = `${coneBand(0.3, 0.42)}${coneBand(0.62, 0.74)}`;
const PARTY_TRIM = dotsPath(Array.from({ length: 9 }, (_, i) => {
  const p = quadAt({ x: 6, y: 81 }, { x: 30, y: 96 }, { x: 54, y: 81 }, i / 8);
  return [p.x, p.y, 3.6] as const;
}));
const PARTY_DOTS = dotsPath([[30, 30, 1.5], [24, 54, 1.6], [36, 52, 1.6], [30, 61, 1.4], [17, 72, 1.6], [43, 72, 1.6]]);

export const PartyHat = artComponent("PartyHat", 60, 92, (u) => (
  <>
    <Defs>
      <Linear id={u.id("cone")} x2={1} y2={0} stops={[[0, GOLD.light], [0.4, GOLD.base], [1, GOLD.shade]]} />
      <Linear id={u.id("band")} x2={1} y2={0} stops={[[0, PARTY_ROSE.light], [0.45, PARTY_ROSE.base], [1, PARTY_ROSE.shade]]} />
      <Radial id={u.id("pom")} stops={[[0, WARM_WHITE], [0.6, mix(connection.tint, WARM_WHITE, 0.3)], [1, connection.mid]]} />
    </Defs>
    <Path d="M28.4 13Q30 10.4 31.6 13L56 80Q30 94 4 80Z" fill={u.url("cone")} stroke={GOLD.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d={PARTY_BANDS} fill={u.url("band")} />
    <Path d={PARTY_DOTS} fill={WARM_WHITE} fillOpacity={0.9} />
    <Path d="M27 20L12.5 70" fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={2.6} {...ROUND} />
    <Path d={PARTY_TRIM} fill={u.url("pom")} stroke={mix(connection.mid, connection.strong, 0.35)} strokeWidth={0.8} />
    <Circle cx={30} cy={9} r={7.5} fill={u.url("pom")} stroke={mix(connection.mid, connection.strong, 0.35)} strokeWidth={0.9} />
    <Path d="M26.5 6.5q1.6-1.8 3.4-.4M30.5 11q1.6-1.8 3.4-.4" fill="none" stroke={connection.mid} strokeOpacity={0.8} strokeWidth={0.9} {...ROUND} />
  </>
));

// ---- Rose beret ------------------------------------------------------------------------------------------

const ROSE = ramp(mix(connection.mid, connection.strong, 0.28), connection.strong, 0.4);

export const BeretRose = artComponent("BeretRose", 100, 60, (u) => (
  <>
    <Defs>
      <Radial id={u.id("puff")} cx={0.36} cy={0.22} r={0.85} stops={[[0, ROSE.light], [0.5, ROSE.base], [1, ROSE.shade]]} />
      <Linear id={u.id("band")} stops={[[0, ROSE.shade], [1, mix(ROSE.shade, connection.strong, 0.4)]]} />
      <Radial id={u.id("hl")} cx={0.5} cy={0.5} r={0.5} stops={SHEEN} />
    </Defs>
    <Path d="M20 43Q50 49 80 43L80.6 52Q50 58.5 19.4 52Z" fill={u.url("band")} stroke={ROSE.edge} strokeWidth={1} strokeLinejoin="round" />
    <Path d="M23 49.5Q50 55 77 49.5" fill="none" stroke={ROSE.light} strokeOpacity={0.35} strokeWidth={0.9} strokeDasharray="1.6 1.6" />
    <Path d="M8 41C2 29 16 13 44 9.5C70 6.5 96 15 97.5 31C98.5 41 87 46.5 70 46.5L30 46.5C18 46.5 10 45.5 8 41Z" fill={u.url("puff")} stroke={ROSE.edge} strokeWidth={1.2} />
    <Path d="M28 40C43 34.5 63 33 84 37.5" fill="none" stroke={ROSE.shade} strokeOpacity={0.45} strokeWidth={1.6} {...ROUND} />
    <Ellipse cx={37} cy={20} rx={15} ry={5.5} fill={u.url("hl")} transform="rotate(-12 37 20)" />
    <Path d="M56 10C55.6 5.4 57.6 2.8 60.6 2.8C63 2.8 63.6 5.6 61.6 7C60.6 7.8 60.3 8.8 60.4 10Z" fill={ROSE.shade} stroke={ROSE.edge} strokeWidth={0.9} />
  </>
));

// ---- Straw sun hat ---------------------------------------------------------------------------------------

const STRAW = ramp(mix(play.mid, energy.tint, 0.38), play.strong, 0.5);
const RIBBON = ramp(mix(energy.mid, connection.mid, 0.5), connection.strong);

export const SunHat = artComponent("SunHat", 100, 62, (u) => (
  <>
    <Defs>
      <Linear id={u.id("brim")} stops={[[0, STRAW.light], [0.55, STRAW.base], [1, STRAW.shade]]} />
      <Linear id={u.id("crown")} x2={1} y2={0} stops={[[0, STRAW.light], [0.45, STRAW.base], [1, STRAW.shade]]} />
      <Linear id={u.id("ribbon")} stops={[[0, RIBBON.light], [0.5, RIBBON.base], [1, RIBBON.shade]]} />
      <Radial id={u.id("hl")} cx={0.5} cy={0.5} r={0.5} stops={SHEEN} />
    </Defs>
    <Ellipse cx={50} cy={46} rx={49} ry={13} fill={u.url("brim")} stroke={STRAW.edge} strokeWidth={1.1} />
    <Path d="M9 46A41 10.5 0 0 0 91 46M19 46A31 7.8 0 0 0 81 46M9 46A41 10.5 0 0 1 28 37.2M91 46A41 10.5 0 0 0 72 37.2" fill="none" stroke={STRAW.shade} strokeOpacity={0.45} strokeWidth={0.9} />
    <Path d="M1.6 47.5Q50 68 98.4 47.5Q50 61.5 1.6 47.5Z" fill={STRAW.shade} fillOpacity={0.45} />
    <Path d="M28 45C27 26 34 14 50 14C66 14 73 26 72 45Q50 50.5 28 45Z" fill={u.url("crown")} stroke={STRAW.edge} strokeWidth={1.1} />
    <Path d="M32 22Q50 18 68 22M29.5 29Q50 25 70.5 29M41 15.5L39 35M50 14.5L50 36M59 15.5L61 35" fill="none" stroke={STRAW.shade} strokeOpacity={0.35} strokeWidth={0.8} />
    <Ellipse cx={39} cy={22} rx={8} ry={4.5} fill={u.url("hl")} transform="rotate(-25 39 22)" />
    <Path d="M28.4 36Q50 41.5 71.6 36L72 44Q50 50 28 44Z" fill={u.url("ribbon")} stroke={RIBBON.edge} strokeWidth={0.9} strokeLinejoin="round" />
    <Path d="M69 42L76.5 54.5L72.5 55.2L66.5 43.5ZM70.5 41.5L82 50.5L79.5 53.5L68.5 43.5Z" fill={RIBBON.shade} stroke={RIBBON.edge} strokeWidth={0.8} strokeLinejoin="round" />
    <Path d={petalsPath(35, 40.5, 8, 1.2, 5.6, 2.6)} fill={WARM_WHITE} stroke={mix(WARM_WHITE, play.strong, 0.25)} strokeWidth={0.4} />
    <Circle cx={35} cy={40.5} r={1.8} fill={play.mid} stroke={mix(play.mid, play.strong, 0.5)} strokeWidth={0.5} />
  </>
));

// ---- Frog bucket hat -------------------------------------------------------------------------------------

const FROG = ramp(mix(body.mid, body.strong, 0.3), body.strong, 0.42);
const FROG_PUPIL = mix(body.strong, "#1E2A1A", 0.55);

export const FrogHat = artComponent("FrogHat", 100, 78, (u) => (
  <>
    <Defs>
      <Radial id={u.id("crown")} cx={0.34} cy={0.2} r={0.95} stops={[[0, FROG.light], [0.5, FROG.base], [1, FROG.shade]]} />
      <Radial id={u.id("bump")} cx={0.36} cy={0.3} r={0.8} stops={[[0, FROG.light], [0.6, FROG.base], [1, FROG.shade]]} />
      <Linear id={u.id("brim")} stops={[[0, mix(FROG.base, FROG.light, 0.4)], [0.6, FROG.base], [1, FROG.shade]]} />
      <Linear id={u.id("eye")} stops={[[0, WARM_WHITE], [1, mix(WARM_WHITE, body.tint, 0.9)]]} />
      <Radial id={u.id("hl")} cx={0.5} cy={0.5} r={0.5} stops={SHEEN} />
    </Defs>
    <Path d="M22 57C22 38 26 23 50 23C74 23 78 38 78 57Z" fill={u.url("crown")} stroke={FROG.edge} strokeWidth={1.2} />
    <Circle cx={33} cy={17} r={11} fill={u.url("bump")} stroke={FROG.edge} strokeWidth={1.1} />
    <Circle cx={67} cy={17} r={11} fill={u.url("bump")} stroke={FROG.edge} strokeWidth={1.1} />
    <Path d={dotsPath([[33, 16, 7], [67, 16, 7]])} fill={u.url("eye")} stroke={mix(FROG.edge, WARM_WHITE, 0.3)} strokeWidth={0.6} />
    <Path d={dotsPath([[34, 17, 3.9], [66, 17, 3.9]])} fill={FROG_PUPIL} />
    <Path d={dotsPath([[35.4, 15.4, 1.3], [67.4, 15.4, 1.3]])} fill="#FFFFFF" />
    <Ellipse cx={36} cy={33} rx={8} ry={4} fill={u.url("hl")} transform="rotate(-20 36 33)" />
    <Path d={dotsPath([[32, 42, 4], [68, 42, 4]])} fill={connection.mid} fillOpacity={0.55} />
    <Path d="M40.5 40Q50 47.5 59.5 40" fill="none" stroke={FROG.edge} strokeWidth={1.6} {...ROUND} />
    <Path d="M8 66C10 56 22 50.5 50 50.5C78 50.5 90 56 92 66C92 72.5 78 75 50 75C22 75 8 72.5 8 66Z" fill={u.url("brim")} stroke={FROG.edge} strokeWidth={1.2} />
    <Path d="M14 66.5C20 60.5 34 57.5 50 57.5C66 57.5 80 60.5 86 66.5" fill="none" stroke={FROG.shade} strokeOpacity={0.7} strokeWidth={0.9} strokeDasharray="2.4 2" {...ROUND} />
    <Path d="M18 58Q30 53 46 52.5" fill="none" stroke={FROG.light} strokeOpacity={0.7} strokeWidth={1.1} {...ROUND} />
  </>
));

// ---- Little witch hat ------------------------------------------------------------------------------------

const WITCH = ramp(mix(calm.mid, calm.strong, 0.5), brand.plum, 0.38);
const WITCH_BAND = mix(calm.strong, brand.plum, 0.55);

export const WitchHat = artComponent("WitchHat", 100, 98, (u) => (
  <>
    <Defs>
      <Linear id={u.id("brim")} stops={[[0, WITCH.light], [0.5, WITCH.base], [1, WITCH.shade]]} />
      <Linear id={u.id("cone")} x2={1} y2={0} stops={[[0, WITCH.light], [0.45, WITCH.base], [1, WITCH.shade]]} />
      <Linear id={u.id("star")} stops={[[0, mix(play.mid, WARM_WHITE, 0.4)], [1, mix(play.mid, play.strong, 0.25)]]} />
    </Defs>
    <Ellipse cx={50} cy={83} rx={49} ry={12} fill={u.url("brim")} stroke={WITCH.edge} strokeWidth={1.2} />
    <Path d="M2 84.5Q50 104 98 84.5Q50 97 2 84.5Z" fill={WITCH.shade} fillOpacity={0.55} />
    <Path d="M30 82C34 62 40 40 50 26C56 17.5 64 11 77 8.5C81 7.8 82.6 10.6 79.6 12.6C70.5 17 66.5 25 64.6 35C62.4 49 66 67 70 82Q50 89 30 82Z" fill={u.url("cone")} stroke={WITCH.edge} strokeWidth={1.2} strokeLinejoin="round" />
    <Path d="M51 28C47 33 44.5 38 43.5 45" fill="none" stroke={WITCH.shade} strokeOpacity={0.5} strokeWidth={1.3} {...ROUND} />
    <Path d="M37.5 74C39.5 59 43.5 45 49 34" fill="none" stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={2.6} {...ROUND} />
    <Path d="M32.2 71Q50 77 67.8 71L69.6 80.5Q50 87.5 30.4 80.5Z" fill={WITCH_BAND} stroke={mix(WITCH_BAND, "#2A2040", 0.4)} strokeWidth={0.9} strokeLinejoin="round" />
    <Path d={starPath(50, 77.5, 4.6, 2, 5)} fill={u.url("star")} stroke={play.strong} strokeOpacity={0.7} strokeWidth={0.6} strokeLinejoin="round" />
    <Path d={`${twinklePath(88, 20, 4.2)}${twinklePath(92.5, 32, 2.4)}`} fill={mix(play.mid, WARM_WHITE, 0.35)} />
  </>
));

// ---- Blush bow -------------------------------------------------------------------------------------------

const BLUSH = ramp(connection.mid, connection.strong, 0.48);

export const BowBlush = artComponent("BowBlush", 100, 66, (u) => (
  <>
    <Defs>
      <Radial id={u.id("loop")} cx={0.45} cy={0.25} r={0.85} stops={[[0, BLUSH.light], [0.55, BLUSH.base], [1, BLUSH.shade]]} />
      <Linear id={u.id("tail")} stops={[[0, BLUSH.shade], [1, BLUSH.base]]} />
      <Linear id={u.id("knot")} stops={[[0, BLUSH.light], [0.5, BLUSH.base], [1, BLUSH.shade]]} />
    </Defs>
    <Path d="M46 35L32.5 61.5L38.2 59.6L40.6 64.8L51.5 37.5ZM54 35L67.5 61.5L61.8 59.6L59.4 64.8L48.5 37.5Z" fill={u.url("tail")} stroke={BLUSH.edge} strokeWidth={1} strokeLinejoin="round" />
    <Path d="M47 30C38 14 22 4 10 10C2 15 2 34 8 44C14 52 32 44 47 34Z" fill={u.url("loop")} stroke={BLUSH.edge} strokeWidth={1.2} strokeLinejoin="round" />
    <Path d="M53 30C62 14 78 4 90 10C98 15 98 34 92 44C86 52 68 44 53 34Z" fill={u.url("loop")} stroke={BLUSH.edge} strokeWidth={1.2} strokeLinejoin="round" />
    <Path d="M45 31C36 22 24 16.5 16 19.5C24 22.5 34 28 45 33.5ZM55 31C64 22 76 16.5 84 19.5C76 22.5 66 28 55 33.5Z" fill={BLUSH.shade} fillOpacity={0.55} />
    <Path d={dotsPath([[18, 13.5, 1.5], [12, 28, 1.6], [24, 38, 1.5], [82, 13.5, 1.5], [88, 28, 1.6], [76, 38, 1.5]])} fill={WARM_WHITE} fillOpacity={0.75} />
    <Path d="M13 12.5C21 8.5 31 13 39 21M87 12.5C79 8.5 69 13 61 21" fill="none" stroke={BLUSH.light} strokeOpacity={0.85} strokeWidth={1.5} {...ROUND} />
    <Path d="M43 25.5Q50 22.5 57 25.5L58 39.5Q50 42.5 42 39.5Z" fill={u.url("knot")} stroke={BLUSH.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M46 27.5Q48 31 46.5 37" fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.2} {...ROUND} />
  </>
));

// ---- Daisy crown -----------------------------------------------------------------------------------------
// Worn like a headband: the vine follows the top of the skull a little in front of it, daisies largest at the
// crown and smaller toward the ears, so it sits on any head shape without a back arc to hide.

const PETAL = WARM_WHITE;
const PETAL_SHADE = mix(WARM_WHITE, calm.mid, 0.28);
const DAISY_HEART = ramp(play.mid, energy.strong, 0.45);
const LEAF_LIGHT = mix(body.mid, body.tint, 0.15);
const LEAF_DARK = mix(body.mid, body.strong, 0.45);
const CROWN_VINE: [Pt, Pt, Pt] = [{ x: 6, y: 42 }, { x: 50, y: -10 }, { x: 94, y: 42 }];

type Bloom = { x: number; y: number; r: number };

/** Direction of a quadratic at t, in degrees. */
function quadAngle(p: [Pt, Pt, Pt], t: number): number {
  const dx = 2 * (1 - t) * (p[1].x - p[0].x) + 2 * t * (p[2].x - p[1].x);
  const dy = 2 * (1 - t) * (p[1].y - p[0].y) + 2 * t * (p[2].y - p[1].y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

const DAISY_SPOTS = evenlyAlong((t) => quadAt(CROWN_VINE[0], CROWN_VINE[1], CROWN_VINE[2], t), 7, 0.04, 0.96);
// drawn from the ears inward so the crown daisy overlaps its neighbours
const DAISIES: Bloom[] = DAISY_SPOTS.map((p) => ({ x: p.x, y: p.y, r: 6.2 + 3 * (1 - Math.abs(2 * p.t - 1)) })).sort(
  (a, b) => Math.abs(b.x - 50) - Math.abs(a.x - 50)
);
const DAISY_LEAVES = DAISY_SPOTS.slice(0, -1).map((p, i) => {
  const next = DAISY_SPOTS[i + 1];
  const t = (p.t + next.t) / 2;
  const m = quadAt(CROWN_VINE[0], CROWN_VINE[1], CROWN_VINE[2], t);
  const along = quadAngle(CROWN_VINE, t);
  return { m, along, up: i % 2 === 0 };
});
const DAISY_LEAVES_LIGHT = DAISY_LEAVES.map(({ m, along, up }) => leafPath(m.x, m.y, along + (up ? -70 : 70), 8.5, 3)).join("");
const DAISY_LEAVES_DARK = DAISY_LEAVES.map(({ m, along, up }) => leafPath(m.x, m.y, along + (up ? 110 : -110), 6.5, 2.4)).join("");

function daisyShapes(b: Bloom, key: string) {
  return (
    <G key={key}>
      <Path d={petalsPath(b.x, b.y, 8, b.r * 0.2, b.r * 0.92, b.r * 0.46, -67.5)} fill={PETAL_SHADE} />
      <Path d={petalsPath(b.x, b.y, 8, b.r * 0.15, b.r, b.r * 0.44, -90)} fill={PETAL} stroke={PETAL_SHADE} strokeWidth={0.4} />
      <Circle cx={b.x} cy={b.y + b.r * 0.04} r={b.r * 0.3} fill={DAISY_HEART.base} stroke={DAISY_HEART.shade} strokeWidth={0.5} />
    </G>
  );
}

export const DaisyCrown = artComponent("DaisyCrown", 100, 50, () => (
  <>
    <Path d={DAISY_LEAVES_DARK} fill={LEAF_DARK} />
    <Path d="M6 42Q50 -10 94 42" fill="none" stroke={LEAF_DARK} strokeWidth={2.2} {...ROUND} />
    <Path d={DAISY_LEAVES_LIGHT} fill={LEAF_LIGHT} stroke={LEAF_DARK} strokeWidth={0.5} />
    {DAISIES.map((b, i) => daisyShapes(b, `d${i}`))}
    <Path d={dotsPath(DAISIES.map((b) => [b.x - b.r * 0.1, b.y - b.r * 0.08, b.r * 0.1] as const))} fill="#FFFFFF" fillOpacity={0.7} />
  </>
));

// ---- Wildflower halo -------------------------------------------------------------------------------------
// A ring of wildflowers floating just above the head (a halo, not a crown): seen from a little above, its back
// arc sits higher than its front one and neither crosses the face.

const HALO = { cx: 50, cy: 22, rx: 44, ry: 13 };
const HALO_PINK = ramp(cycle.mid, cycle.strong, 0.5);
const HALO_LILAC = ramp(calm.mid, calm.strong, 0.5);
const HALO_GOLD = ramp(play.mid, play.strong, 0.5);

type Wildflower = Bloom & { tone: "pink" | "lilac" | "cream" | "gold"; petals: number };

function onHalo(deg: number, r: number, tone: Wildflower["tone"], petals: number): Wildflower {
  const a = (deg * Math.PI) / 180;
  return { x: HALO.cx + HALO.rx * Math.cos(a), y: HALO.cy + HALO.ry * Math.sin(a), r, tone, petals };
}

// back arc first (small, behind), then the front from the sides in to the middle
const HALO_BLOOMS: Wildflower[] = [
  onHalo(205, 4, "gold", 6),
  onHalo(240, 4.4, "pink", 5),
  onHalo(272, 4.7, "lilac", 5),
  onHalo(304, 4.4, "cream", 6),
  onHalo(337, 4, "pink", 5),
  onHalo(172, 5.8, "lilac", 5),
  onHalo(8, 5.8, "gold", 6),
  onHalo(146, 6.6, "pink", 5),
  onHalo(34, 6.6, "lilac", 5),
  onHalo(118, 7.3, "cream", 6),
  onHalo(62, 7.3, "pink", 5),
  onHalo(90, 8.2, "pink", 5),
];
const HALO_LEAVES = [
  [192, 200], [222, 160], [256, 200], [288, 160], [320, 200], [352, 160],
  [158, 150], [132, 215], [104, 150], [76, 30], [48, -35], [20, 30],
].map(([deg, angle]) => {
  const p = onHalo(deg, 0, "pink", 5);
  return leafPath(p.x, p.y, angle, deg > 180 ? 6 : 8, deg > 180 ? 2.2 : 2.8);
}).join("");

const HALO_TONES = {
  pink: { petal: "pink", edge: HALO_PINK.edge, heart: HALO_GOLD.base },
  lilac: { petal: "lilac", edge: HALO_LILAC.edge, heart: HALO_GOLD.base },
  cream: { petal: "cream", edge: mix(WARM_WHITE, cycle.mid, 0.45), heart: HALO_PINK.shade },
  gold: { petal: "gold", edge: HALO_GOLD.edge, heart: mix(energy.mid, energy.strong, 0.35) },
} as const;

export const FlowerHalo = artComponent("FlowerHalo", 100, 50, (u) => (
  <>
    <Defs>
      {/* centre to tips: a deeper heart and paler tips, so one shape reads as two-tone petals */}
      <Radial id={u.id("pink")} cx={0.5} cy={0.5} r={0.5} stops={[[0, HALO_PINK.shade], [0.4, HALO_PINK.base], [1, HALO_PINK.light]]} />
      <Radial id={u.id("lilac")} cx={0.5} cy={0.5} r={0.5} stops={[[0, HALO_LILAC.shade], [0.4, HALO_LILAC.base], [1, HALO_LILAC.light]]} />
      <Radial id={u.id("cream")} cx={0.5} cy={0.5} r={0.5} stops={[[0, mix(WARM_WHITE, cycle.mid, 0.4)], [0.45, WARM_WHITE], [1, WARM_WHITE]]} />
      <Radial id={u.id("gold")} cx={0.5} cy={0.5} r={0.5} stops={[[0, HALO_GOLD.shade], [0.4, HALO_GOLD.base], [1, HALO_GOLD.light]]} />
    </Defs>
    <Path d="M6 22A44 13 0 0 1 94 22" fill="none" stroke={mix(LEAF_DARK, LEAF_LIGHT, 0.4)} strokeWidth={1.5} {...ROUND} />
    {HALO_BLOOMS.slice(0, 5).map((b, i) => (
      <G key={`b${i}`} opacity={0.88}>
        <Path d={petalsPath(b.x, b.y, b.petals, b.r * 0.12, b.r, b.r * (b.petals === 5 ? 0.78 : 0.62), -90 + i * 13)} fill={u.url(HALO_TONES[b.tone].petal)} />
        <Circle cx={b.x} cy={b.y} r={b.r * 0.26} fill={HALO_TONES[b.tone].heart} />
      </G>
    ))}
    <Path d="M6 22A44 13 0 0 0 94 22" fill="none" stroke={LEAF_DARK} strokeWidth={2.4} {...ROUND} />
    <Path d={HALO_LEAVES} fill={LEAF_LIGHT} stroke={LEAF_DARK} strokeWidth={0.5} />
    {HALO_BLOOMS.slice(5).map((b, i) => (
      <G key={`f${i}`}>
        <Path
          d={petalsPath(b.x, b.y, b.petals, b.r * 0.12, b.r, b.r * (b.petals === 5 ? 0.78 : 0.62), -90 + i * 11)}
          fill={u.url(HALO_TONES[b.tone].petal)}
          stroke={HALO_TONES[b.tone].edge}
          strokeOpacity={0.55}
          strokeWidth={0.45}
        />
        <Circle cx={b.x} cy={b.y} r={b.r * 0.26} fill={HALO_TONES[b.tone].heart} />
      </G>
    ))}
    <Path d={`${twinklePath(14, 6, 3.2)}${twinklePath(86, 4.5, 2.6)}${twinklePath(50, 2.6, 2)}`} fill={mix(play.mid, WARM_WHITE, 0.35)} />
  </>
));

// ---- Tiny gold crown -------------------------------------------------------------------------------------

const CROWN_GOLD = ramp(mix(play.mid, brand.gold, 0.4), play.strong, 0.55);
const CROWN_RUBY = ramp(connection.mid, connection.strong, 0.5);
const CROWN_TEAL = ramp(focus.mid, focus.strong, 0.5);
const CROWN_LILAC = ramp(calm.mid, calm.strong, 0.5);

export const GoldCrown = artComponent("GoldCrown", 100, 74, (u) => (
  <>
    <Defs>
      <Linear id={u.id("metal")} x2={1} y2={0} stops={[[0, CROWN_GOLD.light], [0.28, CROWN_GOLD.base], [0.5, CROWN_GOLD.light], [0.75, CROWN_GOLD.base], [1, CROWN_GOLD.shade]]} />
      <Linear id={u.id("band")} stops={[[0, CROWN_GOLD.light], [0.45, CROWN_GOLD.base], [1, CROWN_GOLD.shade]]} />
      <Radial id={u.id("ball")} stops={[[0, WARM_WHITE], [0.45, CROWN_GOLD.light], [1, CROWN_GOLD.shade]]} />
      <Radial id={u.id("ruby")} stops={[[0, CROWN_RUBY.light], [0.5, CROWN_RUBY.base], [1, CROWN_RUBY.edge]]} />
      <Radial id={u.id("teal")} stops={[[0, CROWN_TEAL.light], [0.5, CROWN_TEAL.base], [1, CROWN_TEAL.edge]]} />
      <Radial id={u.id("lilac")} stops={[[0, CROWN_LILAC.light], [0.5, CROWN_LILAC.base], [1, CROWN_LILAC.edge]]} />
    </Defs>
    <Path d="M10 54L6.5 19L28.5 37L50 9L71.5 37L93.5 19L90 54Z" fill={u.url("metal")} stroke={CROWN_GOLD.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M28.5 37L34 50M71.5 37L66 50M50 9L50 26" fill="none" stroke={CROWN_GOLD.shade} strokeOpacity={0.4} strokeWidth={1.2} {...ROUND} />
    <Path d="M11.5 24L13.5 48" fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.8} {...ROUND} />
    <Circle cx={6.5} cy={17} r={4.6} fill={u.url("ball")} stroke={CROWN_GOLD.edge} strokeWidth={0.9} />
    <Circle cx={50} cy={7} r={5.2} fill={u.url("ball")} stroke={CROWN_GOLD.edge} strokeWidth={0.9} />
    <Circle cx={93.5} cy={17} r={4.6} fill={u.url("ball")} stroke={CROWN_GOLD.edge} strokeWidth={0.9} />
    <Circle cx={50} cy={33} r={3.4} fill={u.url("lilac")} stroke={CROWN_LILAC.edge} strokeWidth={0.6} />
    <Path d="M8 51Q50 59 92 51L92 64Q50 73 8 64Z" fill={u.url("band")} stroke={CROWN_GOLD.edge} strokeWidth={1.1} strokeLinejoin="round" />
    <Path d="M10 54.5Q50 62.5 90 54.5" fill="none" stroke={CROWN_GOLD.light} strokeOpacity={0.8} strokeWidth={1} {...ROUND} />
    <Ellipse cx={50} cy={61.5} rx={5.4} ry={4.2} fill={u.url("ruby")} stroke={CROWN_RUBY.edge} strokeWidth={0.7} />
    <Circle cx={26} cy={58.6} r={3.3} fill={u.url("teal")} stroke={CROWN_TEAL.edge} strokeWidth={0.6} />
    <Circle cx={74} cy={58.6} r={3.3} fill={u.url("teal")} stroke={CROWN_TEAL.edge} strokeWidth={0.6} />
    <Path d={dotsPath([[48.4, 60, 1.2], [24.9, 57.5, 0.9], [72.9, 57.5, 0.9], [48.9, 31.9, 0.9], [5, 15.5, 1.3], [48.4, 5.3, 1.4], [92, 15.5, 1.3]])} fill="#FFFFFF" fillOpacity={0.85} />
    <Path d={dotsPath([[14, 60, 0.9], [38, 63.5, 0.9], [62, 63.5, 0.9], [86, 60, 0.9]])} fill={CROWN_GOLD.shade} />
  </>
));
