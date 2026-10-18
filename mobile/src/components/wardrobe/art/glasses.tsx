// Face-slot accessories (glasses), front view. Each pair is drawn with both lens centres on the eye line at the
// height of the registry anchor (the bridge), and lenses about twice the size of a painted pet's eye, so the eyes
// stay readable through clear glass. Sunglasses are tinted but never fully opaque.

import React from "react";
import { Circle, Defs, Path } from "react-native-svg";
import { brand, categories } from "../../../theme/tokens";
import { Linear, Radial, ROUND, WARM_WHITE, artComponent, heartPath, mix, ramp, starPath, twinklePath } from "./kit";

const { calm, connection, focus, play } = categories;

// ---- Round reading glasses -------------------------------------------------------------------------------

const TEAL = ramp(mix(focus.strong, focus.mid, 0.22), focus.strong, 0.5);
const GLASS_SHEEN = "M15.5 28L27 15.5M20 31L30 20M69.5 28L81 15.5M74 31L84 20";

export const RoundGlasses = artComponent("RoundGlasses", 100, 46, (u) => (
  <>
    <Defs>
      <Radial id={u.id("glass")} cx={0.5} cy={0.5} r={0.5} stops={[[0, "#FFFFFF", 0.04], [0.75, focus.tint, 0.16], [1, focus.mid, 0.3]]} />
      <Linear id={u.id("frame")} stops={[[0, TEAL.light], [0.5, TEAL.base], [1, TEAL.edge]]} />
    </Defs>
    <Circle cx={23} cy={23} r={16} fill={u.url("glass")} />
    <Circle cx={77} cy={23} r={16} fill={u.url("glass")} />
    <Path d={GLASS_SHEEN} fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.6} {...ROUND} />
    <Path d="M5.4 18.6L1 16.8M94.6 18.6L99 16.8" fill="none" stroke={u.url("frame")} strokeWidth={3} {...ROUND} />
    <Path d="M40.6 19.6Q50 12.6 59.4 19.6" fill="none" stroke={u.url("frame")} strokeWidth={3} {...ROUND} />
    <Circle cx={23} cy={23} r={17.4} fill="none" stroke={u.url("frame")} strokeWidth={3.2} />
    <Circle cx={77} cy={23} r={17.4} fill="none" stroke={u.url("frame")} strokeWidth={3.2} />
    <Path d="M8.6 17.6A15 15 0 0 1 20.2 8.4M62.6 17.6A15 15 0 0 1 74.2 8.4" fill="none" stroke={TEAL.light} strokeOpacity={0.85} strokeWidth={0.9} {...ROUND} />
  </>
));

// ---- Heart sunglasses ------------------------------------------------------------------------------------

const HEART_FRAME = ramp(mix(connection.mid, connection.strong, 0.42), connection.strong, 0.5);
const HEART_LEFT = heartPath(25, 23, 38, 34);
const HEART_RIGHT = heartPath(75, 23, 38, 34);

export const HeartSunnies = artComponent("HeartSunnies", 100, 46, (u) => (
  <>
    <Defs>
      <Linear id={u.id("lens")} stops={[[0, mix(connection.strong, brand.plum, 0.35), 0.9], [0.55, connection.strong, 0.82], [1, connection.mid, 0.74]]} />
      <Linear id={u.id("frame")} stops={[[0, HEART_FRAME.light], [0.5, HEART_FRAME.base], [1, HEART_FRAME.edge]]} />
    </Defs>
    <Path d="M6.2 15.8L1 14M93.8 15.8L99 14" fill="none" stroke={u.url("frame")} strokeWidth={3} {...ROUND} />
    <Path d="M43.6 16.6Q50 12 56.4 16.6" fill="none" stroke={u.url("frame")} strokeWidth={3} {...ROUND} />
    <Path d={`${HEART_LEFT}${HEART_RIGHT}`} fill={u.url("lens")} stroke={u.url("frame")} strokeWidth={3} strokeLinejoin="round" />
    <Path d="M12 17Q14.5 12 20 11.4M62 17Q64.5 12 70 11.4" fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2} {...ROUND} />
    <Path d="M16 22.5L16.4 22.2M66 22.5L66.4 22.2" fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} {...ROUND} />
    <Path d="M33 31Q30 34.5 26.5 36.4M83 31Q80 34.5 76.5 36.4" fill="none" stroke={mix(connection.mid, WARM_WHITE, 0.4)} strokeOpacity={0.5} strokeWidth={1.2} {...ROUND} />
  </>
));

// ---- Starry glasses --------------------------------------------------------------------------------------

const STAR_FRAME = ramp(mix(calm.mid, calm.strong, 0.45), calm.strong, 0.5);
const STAR_LEFT = starPath(24, 26, 21, 11.5);
const STAR_RIGHT = starPath(76, 26, 21, 11.5);

export const StarGlasses = artComponent("StarGlasses", 100, 50, (u) => (
  <>
    <Defs>
      <Radial id={u.id("lens")} cx={0.5} cy={0.55} r={0.55} stops={[[0, "#FFFFFF", 0.06], [0.7, calm.tint, 0.22], [1, calm.mid, 0.4]]} />
      <Linear id={u.id("frame")} stops={[[0, STAR_FRAME.light], [0.5, STAR_FRAME.base], [1, STAR_FRAME.edge]]} />
    </Defs>
    <Path d="M4.6 19.5L0.9 18M95.4 19.5L99.1 18" fill="none" stroke={u.url("frame")} strokeWidth={2.8} {...ROUND} />
    <Path d="M44 19.6Q50 14.6 56 19.6" fill="none" stroke={u.url("frame")} strokeWidth={2.8} {...ROUND} />
    <Path d={`${STAR_LEFT}${STAR_RIGHT}`} fill={u.url("lens")} stroke={u.url("frame")} strokeWidth={2.8} strokeLinejoin="round" />
    <Path d="M16 21L21.5 15.5M68 21L73.5 15.5" fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1.6} {...ROUND} />
    <Path d={`${twinklePath(93, 6.5, 4.4)}${twinklePath(86.5, 1.9, 1.8)}${twinklePath(6, 42.5, 2.8)}`} fill={mix(play.mid, WARM_WHITE, 0.25)} stroke={mix(play.mid, play.strong, 0.4)} strokeWidth={0.4} />
  </>
));
