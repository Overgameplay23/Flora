// The cat's window nook, drawn as vectors so it needs no painting and can follow the clock: the sky in
// the window, a sunbeam across the floor by day, the lamp on at night. Same calm palette as the garden.
import React from "react";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { DayPhase } from "../../domain/timeOfDay";
import { NOOK_H, NOOK_W } from "./nookScene";

const SKY: Record<DayPhase, [string, string]> = {
  dawn: ["#f6c3ad", "#fbe9d4"],
  morning: ["#bfe0f5", "#eaf6fb"],
  day: ["#9fd0f0", "#dff1fa"],
  golden: ["#f5b478", "#fde4bd"],
  dusk: ["#6f63a8", "#d9a1a0"],
  night: ["#141c46", "#2a3570"],
};

const WINDOW_STARS = [
  [380, 175, 3], [430, 230, 2], [520, 160, 2.5], [590, 250, 2], [660, 170, 3], [720, 300, 2], [820, 190, 2.5], [850, 280, 2], [470, 300, 2], [770, 240, 2],
];

type Props = { phase: DayPhase; left: number; top: number; width: number; height: number; resting?: boolean };

function NookBackdrop({ phase, left, top, width, height, resting = false }: Props) {
  const [skyTop, skyBottom] = SKY[phase];
  const dark = phase === "night" || phase === "dusk";
  const beam = !dark && !resting;
  const sunY = phase === "dawn" ? 430 : phase === "golden" ? 390 : 215;
  const sunColor = phase === "dawn" ? "#ffd7b8" : phase === "golden" ? "#ffb35c" : "#fff4bf";

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${NOOK_W} ${NOOK_H}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", left, top }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={skyTop} />
          <Stop offset="1" stopColor={skyBottom} />
        </LinearGradient>
        <LinearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff1c2" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#fff1c2" stopOpacity="0" />
        </LinearGradient>
        <RadialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#ffd28a" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#ffd28a" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#cfa57c" />
          <Stop offset="1" stopColor="#b88c66" />
        </LinearGradient>
      </Defs>

      {/* wall, rail, skirting, floor */}
      <Rect x={0} y={0} width={NOOK_W} height={745} fill="#efe3d2" />
      <Rect x={0} y={0} width={NOOK_W} height={70} fill="#e9dbc7" />
      <Rect x={0} y={640} width={NOOK_W} height={105} fill="#e5d4bd" />
      <Rect x={0} y={636} width={NOOK_W} height={8} fill="#d6c1a4" />
      <Rect x={0} y={730} width={NOOK_W} height={16} fill="#f4eee3" />
      <Rect x={0} y={745} width={NOOK_W} height={NOOK_H - 745} fill="url(#floor)" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => (
        <Line key={i} x1={i * 86} y1={745} x2={i * 86 - 40} y2={NOOK_H} stroke="#a97f5c" strokeWidth={3} opacity={0.35} />
      ))}

      {/* picture on the wall */}
      <Rect x={120} y={235} width={135} height={105} rx={6} fill="#f8f3ea" stroke="#a97c56" strokeWidth={8} />
      <Path d="M132 318 Q 175 262 214 296 T 243 300 L243 328 L132 328 Z" fill="#9ec48a" />
      <Circle cx={160} cy={268} r={9} fill="#ffd166" />

      {/* curtain rod and curtains */}
      <Rect x={250} y={84} width={700} height={9} rx={4} fill="#8a6a4a" />
      <Circle cx={250} cy={88} r={9} fill="#8a6a4a" />
      <Circle cx={950} cy={88} r={9} fill="#8a6a4a" />
      <Path d="M262 92 L322 92 Q 336 340 306 610 L258 610 Q 286 340 262 92 Z" fill="#d9a5a0" />
      <Path d="M878 92 L938 92 Q 914 340 942 610 L894 610 Q 864 340 878 92 Z" fill="#d9a5a0" />
      <Path d="M282 92 Q 300 340 284 600" stroke="#c98f8a" strokeWidth={4} fill="none" opacity={0.6} />
      <Path d="M918 92 Q 900 340 916 600" stroke="#c98f8a" strokeWidth={4} fill="none" opacity={0.6} />

      {/* window: frame, sky, the world outside */}
      <Rect x={300} y={100} width={600} height={480} rx={26} fill="#f8f3ea" stroke="#d8c8b4" strokeWidth={4} />
      <Rect x={330} y={130} width={540} height={420} rx={12} fill="url(#sky)" />
      {dark ? (
        <G>
          {WINDOW_STARS.map(([x, y, r], i) => (
            <Circle key={i} cx={x} cy={y} r={r} fill="#fff8e1" opacity={phase === "night" ? 0.85 : 0.45} />
          ))}
          <Circle cx={740} cy={215} r={36} fill="#fff6d6" opacity={0.95} />
          <Circle cx={756} cy={204} r={30} fill={skyTop} />
        </G>
      ) : (
        <Circle cx={740} cy={sunY} r={36} fill={sunColor} opacity={0.95} />
      )}
      <Path d="M330 480 Q 420 400 520 452 T 720 430 T 870 452 L870 550 L330 550 Z" fill={dark ? "#4d6a52" : "#b9d6a4"} />
      <Path d="M330 505 Q 470 440 600 490 T 870 490 L870 550 L330 550 Z" fill={dark ? "#3f5a45" : "#9ec48a"} />
      <Rect x={760} y={410} width={16} height={70} rx={6} fill={dark ? "#4a3a30" : "#8a6a4a"} />
      <Circle cx={768} cy={395} r={48} fill={dark ? "#3c5a40" : "#7fb573"} />
      <Rect x={594} y={130} width={12} height={420} fill="#f8f3ea" />
      <Rect x={330} y={334} width={540} height={12} fill="#f8f3ea" />

      {/* sunbeam on the floor */}
      {beam ? <Path d="M330 612 L870 612 L1060 965 L175 965 Z" fill="url(#beam)" /> : null}

      {/* sill */}
      <Rect x={280} y={578} width={640} height={32} rx={6} fill="#f1e8da" stroke="#d8c8b4" strokeWidth={3} />
      <Rect x={286} y={610} width={628} height={10} fill="#d9c9b3" />

      {/* side table with the lamp */}
      <Rect x={975} y={714} width={12} height={125} fill="#8f6746" />
      <Rect x={1100} y={714} width={12} height={125} fill="#8f6746" />
      <Rect x={958} y={700} width={166} height={16} rx={6} fill="#a97c56" />
      {dark ? <Circle cx={1000} cy={640} r={150} fill="url(#lamp)" /> : null}
      <Rect x={985} y={660} width={30} height={42} rx={4} fill="#8f6746" />
      <Path d="M955 600 L1045 600 L1063 662 L937 662 Z" fill={dark ? "#ffe3b3" : "#f2d9b8"} stroke="#d9bd97" strokeWidth={3} />

      {/* rug */}
      <Ellipse cx={470} cy={882} rx={335} ry={80} fill="#d9a5a0" />
      <Ellipse cx={470} cy={882} rx={300} ry={62} fill="none" stroke="#e8c1bb" strokeWidth={6} />
      <Ellipse cx={470} cy={882} rx={240} ry={44} fill="#e4b7b1" />

      {/* cushion and a ball of yarn */}
      <Ellipse cx={150} cy={915} rx={98} ry={36} fill="#a9c1a0" />
      <Ellipse cx={150} cy={903} rx={78} ry={24} fill="#bcd0b2" />
      <Circle cx={150} cy={903} r={6} fill="#8fa886" />
      <Circle cx={805} cy={938} r={24} fill="#e88c9a" />
      <Path d="M786 928 Q 805 918 824 930 M784 940 Q 805 930 826 944 M790 952 Q 806 942 822 954" stroke="#d26f80" strokeWidth={3} fill="none" />
      <Path d="M828 940 Q 870 950 900 935" stroke="#e88c9a" strokeWidth={4} fill="none" />
    </Svg>
  );
}

export default React.memo(NookBackdrop);
