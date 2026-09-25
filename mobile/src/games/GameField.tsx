import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { computeSceneFrame } from "../domain/gardenScene";
import { SCENE, SCENE_BACKGROUND } from "../components/garden/sceneAssets";

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
          <View style={styles.hudPill}>
            <Text style={styles.hudTitle}>{title}</Text>
            <Text style={styles.hudStat}>{stat}</Text>
          </View>
          <View style={styles.hudRight}>
            <View style={styles.hudPill}>
              <Text style={styles.hudStat}>{secondary}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Leave the game">
              <Feather name="x" size={18} color="#f8fafc" />
            </Pressable>
          </View>
        </View>
        {hint ? (
          <View style={[styles.hintWrap, { top: insets.top + 60 }]} pointerEvents="none">
            <Text style={styles.hint}>{hint}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1d2a1c", overflow: "hidden" },
  field: { flex: 1, overflow: "hidden" },
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(23,42,30,0.12)" },
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    marginRight: 8,
  },
  hudTitle: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", marginRight: 8 },
  hudStat: { color: "#f8fafc", fontSize: 15, fontWeight: "800" },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  hintWrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  hint: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.55)",
    overflow: "hidden",
  },
});
