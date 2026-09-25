import React from "react";
import { View } from "react-native";

/**
 * Soft contact shadow on the ground. React Native has no blur, and a big borderRadius on a wide box
 * gives a pill, not an ellipse, so each layer is a circle squashed with scaleY; stacking a few from
 * wide-and-faint to tight-and-dark fakes the falloff.
 */
export default function GroundShadow({
  x,
  y,
  width,
  zIndex = 0,
  strength = 1,
}: {
  x: number;
  y: number;
  width: number;
  zIndex?: number;
  strength?: number;
}) {
  const layers = [
    { size: 1, opacity: 0.1 },
    { size: 0.8, opacity: 0.12 },
    { size: 0.6, opacity: 0.14 },
    { size: 0.4, opacity: 0.16 },
  ];
  return (
    <>
      {layers.map((layer) => {
        const d = width * layer.size;
        return (
          <View
            key={layer.size}
            pointerEvents="none"
            style={{
              position: "absolute",
              zIndex,
              left: x - d / 2,
              top: y - d / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: "#1c1408",
              opacity: layer.opacity * strength,
              transform: [{ scaleY: 0.2 }],
            }}
          />
        );
      })}
    </>
  );
}
