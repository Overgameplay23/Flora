import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import { PetLook } from "../../../domain/petLook";
import type { PetMood, PetReaction } from "../PetPortrait";
import {
  BOX,
  GROUND_Y,
  bodyGeometry,
  earInnerPath,
  earPath,
  headGeometry,
  mouthPath,
  palette,
  pivots,
  stripePaths,
  tailPath,
  toOrigin,
  whiskerLines,
} from "./petParts";

export type PetAct = "drink" | "stretch" | "breathe" | "sleep" | "walk";

type PetRigProps = {
  look: PetLook;
  /** box size in layout units (the rig is square) */
  size: number;
  mood?: PetMood;
  reaction?: PetReaction | null;
  onReactionEnd?: () => void;
  /** a short acted-out routine (drinking, stretching…), cleared through onActEnd */
  act?: PetAct | null;
  onActEnd?: () => void;
  reducedMotion?: boolean;
};

const OUTLINE_W = 2.6;

/**
 * The illustrated pet: a handful of SVG layers (tail, body, ears, head, eyes) that each animate on
 * their own pivot. Breathing, blinking, tail wags and ear twitches run by mood; reactions and acts
 * are one-shot sequences. Nothing here needs a native module, so it runs in Expo Go and on web.
 */
export default function PetRig({ look, size, mood = "calm", reaction = null, onReactionEnd, act = null, onActEnd, reducedMotion = false }: PetRigProps) {
  const p = useMemo(() => palette(look), [look]);
  const head = useMemo(() => headGeometry(look), [look]);
  const body = useMemo(() => bodyGeometry(look), [look]);
  const piv = useMemo(() => pivots(look), [look]);
  const tail = useMemo(() => tailPath(look), [look]);
  const stripes = useMemo(() => stripePaths(look), [look]);
  const whiskers = useMemo(() => whiskerLines(look), [look]);

  const breath = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const wag = useRef(new Animated.Value(0)).current;
  const earTwitch = useRef(new Animated.Value(0)).current;
  const headTilt = useRef(new Animated.Value(0)).current;
  const headNod = useRef(new Animated.Value(0)).current;
  const stretch = useRef(new Animated.Value(0)).current;
  const still = reducedMotion;

  // ---- breathing --------------------------------------------------------------------------------------
  useEffect(() => {
    if (still) {
      breath.setValue(0);
      return undefined;
    }
    const ms = mood === "excited" ? 700 : mood === "happy" ? 1200 : mood === "sleepy" ? 3200 : mood === "sad" ? 2800 : 2200;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath, mood, still]);

  // ---- blinking (random, occasionally a double blink) ---------------------------------------------------
  useEffect(() => {
    if (still) {
      blink.setValue(mood === "sleepy" ? 0.6 : 1);
      return undefined;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const open = mood === "sleepy" ? 0.6 : 1;
    blink.setValue(open);
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        const once = Animated.sequence([
          Animated.timing(blink, { toValue: 0.08, duration: 70, useNativeDriver: true }),
          Animated.timing(blink, { toValue: open, duration: 110, useNativeDriver: true }),
        ]);
        const double = Math.random() < 0.25;
        (double ? Animated.sequence([once, Animated.delay(120), Animated.sequence([
          Animated.timing(blink, { toValue: 0.08, duration: 70, useNativeDriver: true }),
          Animated.timing(blink, { toValue: open, duration: 110, useNativeDriver: true }),
        ])]) : once).start(() => alive && schedule());
      }, 2400 + Math.random() * 3200);
    };
    schedule();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [blink, mood, still]);

  // ---- tail -------------------------------------------------------------------------------------------
  useEffect(() => {
    if (still || mood === "sad") {
      wag.setValue(mood === "sad" ? -1 : 0);
      return undefined;
    }
    const ms = mood === "excited" ? 170 : mood === "happy" ? 300 : mood === "sleepy" ? 2200 : 1300;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wag, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(wag, { toValue: -1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [mood, still, wag]);

  // ---- ear twitch (cats often, dogs now and then) --------------------------------------------------------
  useEffect(() => {
    if (still) return undefined;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        Animated.sequence([
          Animated.timing(earTwitch, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(earTwitch, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]).start(() => alive && schedule());
      }, (look.species === "cat" ? 3500 : 6500) + Math.random() * 5000);
    };
    schedule();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [earTwitch, look.species, still]);

  // ---- reactions: head tilt for hearts, ear flap for cheer ----------------------------------------------
  useEffect(() => {
    if (!reaction) return undefined;
    const tilt = reaction === "love" ? 1 : 0;
    const animation = still
      ? Animated.timing(headTilt, { toValue: 0, duration: 10, useNativeDriver: true })
      : Animated.sequence([
          Animated.timing(headTilt, { toValue: tilt, duration: 220, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
          Animated.delay(reaction === "love" ? 700 : 150),
          Animated.timing(headTilt, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]);
    animation.start();
    if (reaction === "cheer" && !still) {
      Animated.sequence([
        Animated.timing(earTwitch, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(earTwitch, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(earTwitch, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(earTwitch, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction]);

  // ---- acts: the pet does the thing the person just logged --------------------------------------------
  useEffect(() => {
    if (!act) return undefined;
    const fast = still ? 0.2 : 1;
    let animation: Animated.CompositeAnimation;
    if (act === "drink") {
      // nose down to the bowl twice
      animation = Animated.sequence([
        Animated.timing(headNod, { toValue: 1, duration: 320 * fast, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(headNod, { toValue: 0.7, duration: 200 * fast, useNativeDriver: true }),
        Animated.timing(headNod, { toValue: 1, duration: 200 * fast, useNativeDriver: true }),
        Animated.timing(headNod, { toValue: 0.7, duration: 200 * fast, useNativeDriver: true }),
        Animated.timing(headNod, { toValue: 1, duration: 200 * fast, useNativeDriver: true }),
        Animated.delay(200),
        Animated.timing(headNod, { toValue: 0, duration: 360 * fast, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]);
    } else if (act === "stretch") {
      animation = Animated.sequence([
        Animated.timing(stretch, { toValue: 1, duration: 600 * fast, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(stretch, { toValue: 0, duration: 500 * fast, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]);
    } else if (act === "sleep") {
      animation = Animated.sequence([
        Animated.timing(blink, { toValue: 0.08, duration: 500 * fast, useNativeDriver: true }),
        Animated.timing(headTilt, { toValue: -0.6, duration: 600 * fast, useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(headTilt, { toValue: 0, duration: 400 * fast, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 300 * fast, useNativeDriver: true }),
      ]);
    } else if (act === "walk") {
      animation = Animated.sequence([
        Animated.timing(stretch, { toValue: -1, duration: 160 * fast, useNativeDriver: true }),
        Animated.timing(stretch, { toValue: 0, duration: 160 * fast, useNativeDriver: true }),
        Animated.timing(stretch, { toValue: -1, duration: 160 * fast, useNativeDriver: true }),
        Animated.timing(stretch, { toValue: 0, duration: 160 * fast, useNativeDriver: true }),
        Animated.timing(stretch, { toValue: -1, duration: 160 * fast, useNativeDriver: true }),
        Animated.timing(stretch, { toValue: 0, duration: 160 * fast, useNativeDriver: true }),
      ]);
    } else {
      // breathe: one long, visible breath
      animation = Animated.sequence([
        Animated.timing(stretch, { toValue: 0.6, duration: 1400 * fast, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(stretch, { toValue: 0, duration: 1600 * fast, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]);
    }
    animation.start(({ finished }) => finished && onActEnd?.());
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act]);

  // ---- derived transforms ------------------------------------------------------------------------------
  const bodyScaleY = Animated.add(
    breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }),
    stretch.interpolate({ inputRange: [-1, 0, 1], outputRange: [-0.06, 0, 0.08] })
  );
  const bodyScaleX = stretch.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.04, 1, 0.97] });
  const bodyHop = stretch.interpolate({ inputRange: [-1, 0, 1], outputRange: [-size * 0.05, 0, 0] });
  const headY = Animated.add(
    breath.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.008] }),
    Animated.add(
      headNod.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.06] }),
      stretch.interpolate({ inputRange: [-1, 0, 1], outputRange: [-size * 0.05, 0, -size * 0.02] })
    )
  );
  const headRotate = Animated.add(
    headTilt.interpolate({ inputRange: [-1, 0, 1], outputRange: [-14, 0, 12] }),
    headNod.interpolate({ inputRange: [0, 1], outputRange: [0, 18] })
  ).interpolate({ inputRange: [-30, 30], outputRange: ["-30deg", "30deg"] });
  const sadTilt = mood === "sad" ? "-5deg" : "0deg";
  const tailRotate = wag.interpolate({
    inputRange: [-1, 0, 1],
    outputRange:
      mood === "sad" ? ["-38deg", "-20deg", "0deg"] : mood === "excited" ? ["-32deg", "0deg", "32deg"] : mood === "happy" ? ["-24deg", "0deg", "24deg"] : ["-9deg", "0deg", "9deg"],
  });
  const earRotL = earTwitch.interpolate({ inputRange: [0, 1], outputRange: ["0deg", look.ears === "floppy" ? "-12deg" : "-9deg"] });
  const earRotR = earTwitch.interpolate({ inputRange: [0, 1], outputRange: ["0deg", look.ears === "floppy" ? "12deg" : "9deg"] });
  const eyeScaleY = blink;

  const mouthMood = mood === "sad" ? "sad" : mood === "excited" ? "open" : mood === "calm" || mood === "neutral" || mood === "sleepy" ? "neutral" : "happy";
  const layer = { position: "absolute" as const, left: 0, top: 0, width: size, height: size };
  const svgProps = { width: size, height: size, viewBox: `0 0 ${BOX} ${BOX}` };
  const legTop = body.cy + 4;
  const legBottom = GROUND_Y;
  const paws = look.marking === "socks" || look.marking === "tuxedo";

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {/* tail */}
      <Animated.View style={[layer, { transformOrigin: toOrigin(piv.tail), transform: [{ rotate: tailRotate }] }]}>
        <Svg {...svgProps}>
          <Path d={tail.d} stroke={p.outline} strokeWidth={tail.width + OUTLINE_W * 2} fill="none" strokeLinecap="round" />
          <Path d={tail.d} stroke={look.tail === "fluffy" ? p.coatDark : p.coat} strokeWidth={tail.width} fill="none" strokeLinecap="round" />
          {look.tail === "fluffy" || look.marking === "socks" ? (
            <Path d={tail.d} stroke={p.secondary} strokeWidth={Math.max(3, tail.width * 0.45)} fill="none" strokeLinecap="round" strokeDasharray={`${tail.width * 1.2} 200`} strokeDashoffset={-56} />
          ) : null}
        </Svg>
      </Animated.View>

      {/* body + legs */}
      <Animated.View style={[layer, { transformOrigin: toOrigin(piv.body), transform: [{ translateY: bodyHop }, { scaleY: bodyScaleY }, { scaleX: bodyScaleX }] }]}>
        <Svg {...svgProps}>
          <Ellipse cx={body.cx} cy={body.cy} rx={body.rx} ry={body.ry} fill={p.coat} stroke={p.outline} strokeWidth={OUTLINE_W} />
          {/* chest / belly */}
          {look.marking === "tuxedo" ? (
            <Path d={`M ${body.cx - 16} ${body.cy - body.ry + 6} C ${body.cx - 26} ${body.cy}, ${body.cx - 22} ${body.cy + 26}, ${body.cx} ${body.cy + body.ry - 2} C ${body.cx + 22} ${body.cy + 26}, ${body.cx + 26} ${body.cy}, ${body.cx + 16} ${body.cy - body.ry + 6} Z`} fill={p.secondary} />
          ) : (
            <Ellipse cx={body.cx} cy={body.cy + 10} rx={body.rx * 0.55} ry={body.ry * 0.6} fill={look.marking === "none" ? p.coatLight : p.secondary} opacity={look.marking === "none" ? 0.55 : 1} />
          )}
          {stripes.body.map((d, i) => (
            <Path key={i} d={d} stroke={p.stripe} strokeWidth={4} fill="none" strokeLinecap="round" />
          ))}
          {/* front legs */}
          {[-1, 1].map((s) => {
            const x = body.cx + s * body.legX - body.legW / 2;
            return (
              <G key={s}>
                <Rect x={x} y={legTop} width={body.legW} height={legBottom - legTop} rx={body.legW / 2} fill={p.coat} stroke={p.outline} strokeWidth={OUTLINE_W} />
                <Ellipse cx={x + body.legW / 2} cy={legBottom - 3} rx={body.legW / 2 + 2} ry={5.5} fill={paws ? p.secondary : p.coatLight} stroke={p.outline} strokeWidth={OUTLINE_W * 0.8} />
              </G>
            );
          })}
        </Svg>
      </Animated.View>

      {/* ears (behind the head) */}
      <Animated.View style={[layer, { transformOrigin: toOrigin(piv.earLeft), transform: [{ rotate: earRotL }] }]}>
        <Svg {...svgProps}>
          <Path d={earPath(look, -1)} fill={p.ear} stroke={p.outline} strokeWidth={OUTLINE_W} strokeLinejoin="round" />
          {earInnerPath(look, -1) ? <Path d={earInnerPath(look, -1)} fill={p.earInner} /> : null}
        </Svg>
      </Animated.View>
      <Animated.View style={[layer, { transformOrigin: toOrigin(piv.earRight), transform: [{ rotate: earRotR }] }]}>
        <Svg {...svgProps}>
          <Path d={earPath(look, 1)} fill={p.ear} stroke={p.outline} strokeWidth={OUTLINE_W} strokeLinejoin="round" />
          {earInnerPath(look, 1) ? <Path d={earInnerPath(look, 1)} fill={p.earInner} /> : null}
        </Svg>
      </Animated.View>

      {/* head + face */}
      <Animated.View style={[layer, { transformOrigin: toOrigin(piv.head), transform: [{ translateY: headY }, { rotate: headRotate }, { rotate: sadTilt }] }]}>
        <Svg {...svgProps}>
          <Ellipse cx={head.cx} cy={head.cy} rx={head.rx} ry={head.ry} fill={p.coat} stroke={p.outline} strokeWidth={OUTLINE_W} />
          {look.marking === "mask" ? (
            look.species === "cat" ? (
              <Path d={`M ${head.cx - 22} ${head.cy + 2} C ${head.cx - 10} ${head.cy - 24}, ${head.cx + 10} ${head.cy - 24}, ${head.cx + 22} ${head.cy + 2} C ${head.cx + 12} ${head.cy + 22}, ${head.cx - 12} ${head.cy + 22}, ${head.cx - 22} ${head.cy + 2} Z`} fill={p.mask} opacity={0.9} />
            ) : (
              <Path d={`M ${head.cx - head.rx + 4} ${head.cy - 6} C ${head.cx - head.rx + 2} ${head.cy - 30}, ${head.cx + head.rx - 2} ${head.cy - 30}, ${head.cx + head.rx - 4} ${head.cy - 6} C ${head.cx + 20} ${head.cy - 12}, ${head.cx - 20} ${head.cy - 12}, ${head.cx - head.rx + 4} ${head.cy - 6} Z`} fill={p.mask} />
            )
          ) : null}
          {look.marking === "patch" ? <Circle cx={head.cx + 16} cy={head.cy - 2} r={17} fill={p.patch} /> : null}
          {stripes.head.map((d, i) => (
            <Path key={i} d={d} stroke={p.stripe} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          ))}
          {/* cheeks */}
          <Circle cx={head.cx - 25} cy={head.cy + 12} r={6} fill={p.cheek} opacity={0.4} />
          <Circle cx={head.cx + 25} cy={head.cy + 12} r={6} fill={p.cheek} opacity={0.4} />
          {/* muzzle, nose, mouth */}
          {look.species === "cat" ? (
            <G>
              <Circle cx={head.cx - 6} cy={head.cy + 10} r={7.5} fill={p.secondary} opacity={0.9} />
              <Circle cx={head.cx + 6} cy={head.cy + 10} r={7.5} fill={p.secondary} opacity={0.9} />
              <Path d={`M ${head.cx - 4} ${head.cy + 4} L ${head.cx + 4} ${head.cy + 4} L ${head.cx} ${head.cy + 9} Z`} fill={p.nose} />
              {whiskers.map(([x1, y1, x2, y2], i) => (
                <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={p.mouth} strokeWidth={1.4} strokeLinecap="round" opacity={0.75} />
              ))}
            </G>
          ) : (
            <G>
              <Ellipse cx={head.cx} cy={head.cy + 16} rx={19} ry={13} fill={p.secondary} opacity={0.95} />
              <Path d={`M ${head.cx - 7} ${head.cy + 8} Q ${head.cx} ${head.cy + 4} ${head.cx + 7} ${head.cy + 8} Q ${head.cx + 4} ${head.cy + 16} ${head.cx} ${head.cy + 17} Q ${head.cx - 4} ${head.cy + 16} ${head.cx - 7} ${head.cy + 8} Z`} fill={p.nose} />
              <Circle cx={head.cx - 3} cy={head.cy + 9} r={1.6} fill="#ffffff" opacity={0.7} />
            </G>
          )}
          <Path d={mouthPath(look, mouthMood)} stroke={p.mouth} strokeWidth={2.2} fill="none" strokeLinecap="round" />
          {mouthMood === "open" ? <Ellipse cx={head.cx} cy={head.cy + (look.species === "cat" ? 15 : 22)} rx={4.5} ry={3.5} fill="#f47c8f" /> : null}
          {mood === "sad" ? (
            <G>
              <Path d={`M ${head.cx - 24} ${head.cy - 16} L ${head.cx - 12} ${head.cy - 11}`} stroke={p.mouth} strokeWidth={2} strokeLinecap="round" />
              <Path d={`M ${head.cx + 24} ${head.cy - 16} L ${head.cx + 12} ${head.cy - 11}`} stroke={p.mouth} strokeWidth={2} strokeLinecap="round" />
            </G>
          ) : null}
        </Svg>
      </Animated.View>

      {/* eyes (blink) */}
      <Animated.View style={[layer, { transformOrigin: toOrigin(piv.eyes), transform: [{ translateY: headY }, { rotate: headRotate }, { rotate: sadTilt }, { scaleY: eyeScaleY }] }]}>
        <Svg {...svgProps}>
          {[-1, 1].map((s) => {
            const ex = head.cx + s * 16;
            const ey = head.cy + 2;
            return look.species === "cat" ? (
              <G key={s}>
                <Ellipse cx={ex} cy={ey} rx={7} ry={8} fill={p.eye} stroke={p.outline} strokeWidth={1.4} />
                <Ellipse cx={ex} cy={ey} rx={mood === "excited" ? 4.5 : 2.6} ry={6.2} fill="#1a1720" />
                <Circle cx={ex - 2.2} cy={ey - 3} r={2} fill="#ffffff" />
              </G>
            ) : (
              <G key={s}>
                <Circle cx={ex} cy={ey} r={8} fill={p.eyeDark} stroke={p.outline} strokeWidth={1.2} />
                <Circle cx={ex} cy={ey + 0.5} r={5.2} fill={p.eye} opacity={0.55} />
                <Circle cx={ex - 2.6} cy={ey - 2.8} r={2.6} fill="#ffffff" />
                <Circle cx={ex + 2.4} cy={ey + 2.6} r={1.2} fill="#ffffff" opacity={0.8} />
              </G>
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
}

export const petRigStyles = StyleSheet.create({});
