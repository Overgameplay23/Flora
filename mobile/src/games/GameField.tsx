import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { computeSceneFrame } from "../domain/gardenScene";
import { SCENE, SCENE_BACKGROUND } from "../components/garden/sceneAssets";
import PressableScale from "../components/common/PressableScale";
import { useTheme } from "../theme/theme";
import { fonts, radius, type } from "../theme/tokens";

export type FieldSize = { width: number; height: number };

export function useReducedMotionFlag() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduced(!!value))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => setReduced(!!value));
    return () => {
      alive = false;
      subscription?.remove?.();
    };
  }, []);
  return reduced;
}

type GameFieldProps = {
  title: string;
  /** left HUD stat, e.g. score */
  stat: string;
  /** right HUD stat, e.g. time left */
  secondary: string;
  onClose: () => void;
  children: (size: FieldSize) => React.ReactNode;
  /** optional caption under the HUD (instructions) */
  hint?: string | null;
};

/**
 * The garden as a playing field: the painting framed on its lawn, a small HUD, and a render prop that
 * receives the field size so games can place things in pixels.
 */
export default function GameField({ title, stat, secondary, onClose, children, hint }: GameFieldProps) {
  const insets = useSafeAreaInsets();
  const { surface } = useTheme();
  // the HUD is paper laid over the painting: a soft pill with a warm shadow and ink text
  const pill = { backgroundColor: surface.paperOverScene, boxShadow: surface.shadow };
  const [size, setSize] = useState<FieldSize>({ width: 0, height: 0 });
  const fieldRef = useRef<any>(null);

  // On web the field is an overflow-hidden box whose sprites (transforms count as overflow) make it
  // scrollable in principle; focusing a button then lets the browser scroll it sideways and the whole
  // lawn shifts. Snap it back whenever that happens.
  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    const node = fieldRef.current;
    if (!node || typeof node.addEventListener !== "function") return undefined;
    const reset = () => {
      if (node.scrollLeft !== 0) node.scrollLeft = 0;
      if (node.scrollTop !== 0) node.scrollTop = 0;
    };
    node.addEventListener("scroll", reset);
    return () => node.removeEventListener("scroll", reset);
  }, []);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0 && (Math.abs(width - size.width) > 0.5 || Math.abs(height - size.height) > 0.5)) {
      setSize({ width, height });
    }
  };
  const frame =
    size.width > 0 ? computeSceneFrame(size.width, size.height, SCENE.image.width, SCENE.image.height, { u: 0.5, v: 0.8 }, 1.1) : null;

  return (
    <View style={styles.screen}>
      <View ref={fieldRef} style={styles.field} onLayout={onLayout}>
        {frame ? (
          <Image
            source={SCENE_BACKGROUND}
            style={{ position: "absolute", left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
            resizeMode="stretch"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <View pointerEvents="none" style={styles.wash} />
        {size.width > 0 ? children(size) : null}
        <View style={[styles.hud, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={[styles.hudPill, pill]}>
            <Text style={[type.meta, styles.hudTitle, { color: surface.textSecondary }]}>{title}</Text>
            <Text style={[styles.hudStat, { color: surface.text }]}>{stat}</Text>
          </View>
          <View style={styles.hudRight}>
            <View style={[styles.hudPill, pill]}>
              <Text style={[styles.hudStat, { color: surface.text }]}>{secondary}</Text>
            </View>
            <PressableScale
              onPress={onClose}
              style={[styles.closeButton, pill]}
              hitSlop={10}
              pressedScale={0.9}
              accessibilityRole="button"
              accessibilityLabel="Leave the game"
            >
              <Ionicons name="close" size={20} color={surface.text} />
            </PressableScale>
          </View>
        </View>
        {hint ? (
          <View style={[styles.hintWrap, { top: insets.top + 60 }]} pointerEvents="none">
            <View style={[styles.hintPill, pill]}>
              <Text style={[type.meta, styles.hint, { color: surface.text }]}>{hint}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1d2a1c", overflow: "hidden" },
  field: { flex: 1, overflow: "hidden" },
  wash: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(23,42,30,0.12)" },
  hud: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hudRight: { flexDirection: "row", alignItems: "center" },
  hudPill: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginRight: 8,
  },
  hudTitle: { marginRight: 8 },
  hudStat: { fontFamily: fonts.bodyHeavy, fontSize: 15, lineHeight: 20 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  hintWrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  hintPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  hint: { textAlign: "center" },
});
