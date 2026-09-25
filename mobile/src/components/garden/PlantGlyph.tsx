// A small vector plant at one of the four growth stages: potted for the window nook (drawn in the
// scene and on the cards) or in a mound of soil for the garden's cards.
import React from "react";
import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";
import type { PlantStage } from "../../domain/gardenScene";

type Props = { stage: PlantStage | null; potted: boolean; width: number; height: number; style?: any };

const LEAF = "#6fae62";
const LEAF_DARK = "#5a9650";

function leaf(x: number, y: number, dir: 1 | -1, size: number, key: string) {
  const dx = dir * size;
  return <Path key={key} d={`M${x} ${y} Q ${x + dx * 0.6} ${y - size * 0.9} ${x + dx} ${y - size * 0.15} Q ${x + dx * 0.55} ${y + size * 0.25} ${x} ${y} Z`} fill={dir > 0 ? LEAF : LEAF_DARK} />;
}

function PlantGlyph({ stage, potted, width, height, style }: Props) {
  const cx = 65;
  const base = potted ? 150 : 178;
  const stemTop = stage === "seed" ? base - 22 : stage === "sproutSmall" ? base - 52 : stage === "sprout" ? base - 96 : base - 128;

  return (
    <Svg width={width} height={height} viewBox="0 0 130 200" preserveAspectRatio="none" style={style} pointerEvents="none">
      {potted ? (
        <>
          <Path d="M36 156 L94 156 L87 198 L43 198 Z" fill="#c8734f" />
          <Rect x={30} y={144} width={70} height={18} rx={6} fill="#d98a63" />
          <Ellipse cx={cx} cy={150} rx={26} ry={6} fill="#6b4a3a" />
        </>
      ) : (
        <Ellipse cx={cx} cy={base + 6} rx={40} ry={12} fill="#7a5a44" />
      )}
      {stage ? (
        <>
          <Line x1={cx} y1={base} x2={cx} y2={stemTop} stroke={LEAF_DARK} strokeWidth={stage === "seed" ? 3 : 4.5} strokeLinecap="round" />
          {stage === "seed" ? (
            <>
              {leaf(cx, stemTop + 4, -1, 12, "a")}
              {leaf(cx, stemTop + 4, 1, 12, "b")}
            </>
          ) : null}
          {stage === "sproutSmall" ? (
            <>
              {leaf(cx, stemTop + 10, -1, 22, "a")}
              {leaf(cx, stemTop + 10, 1, 22, "b")}
              {leaf(cx, stemTop + 32, 1, 14, "c")}
            </>
          ) : null}
          {stage === "sprout" ? (
            <>
              {leaf(cx, stemTop + 8, -1, 26, "a")}
              {leaf(cx, stemTop + 8, 1, 26, "b")}
              {leaf(cx, stemTop + 38, -1, 30, "c")}
              {leaf(cx, stemTop + 42, 1, 24, "d")}
              {leaf(cx, stemTop + 68, 1, 30, "e")}
            </>
          ) : null}
          {stage === "bloom" ? (
            <>
              {leaf(cx, stemTop + 30, -1, 28, "a")}
              {leaf(cx, stemTop + 36, 1, 28, "b")}
              {leaf(cx, stemTop + 66, -1, 32, "c")}
              {leaf(cx, stemTop + 74, 1, 26, "d")}
              {leaf(cx, stemTop + 100, 1, 30, "e")}
              {[0, 72, 144, 216, 288].map((deg) => {
                const r = (deg * Math.PI) / 180;
                return <Circle key={deg} cx={cx + Math.cos(r) * 13} cy={stemTop - 2 + Math.sin(r) * 13} r={9} fill="#f2a2b5" />;
              })}
              <Circle cx={cx} cy={stemTop - 2} r={7} fill="#ffd166" />
            </>
          ) : null}
        </>
      ) : null}
    </Svg>
  );
}

export default React.memo(PlantGlyph);
