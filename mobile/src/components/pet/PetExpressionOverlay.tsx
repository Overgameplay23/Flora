import React from "react";
import { StyleSheet, View } from "react-native";

export type PetExpression = "sad" | "neutral" | "happy";

type PetExpressionOverlayProps = {
  expression: PetExpression;
};

export default function PetExpressionOverlay({ expression }: PetExpressionOverlayProps) {
  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={styles.eyesRow}>
        <View style={styles.eye} />
        <View style={styles.eye} />
      </View>
      <View style={[styles.mouthBase, getMouthStyle(expression)]} />
    </View>
  );
}

function getMouthStyle(expression: PetExpression) {
  if (expression === "happy") return styles.mouthHappy;
  if (expression === "sad") return styles.mouthSad;
  return styles.mouthNeutral;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  eyesRow: {
    width: "44%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "10%",
  },
  eye: {
    width: "20%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.58)",
  },
  mouthBase: {
    width: "34%",
    marginTop: "16%",
  },
  mouthHappy: {
    height: "14%",
    borderBottomWidth: 2,
    borderBottomColor: "rgba(15,23,42,0.56)",
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
  },
  mouthNeutral: {
    height: 2,
    backgroundColor: "rgba(15,23,42,0.5)",
    borderRadius: 999,
  },
  mouthSad: {
    height: "14%",
    borderTopWidth: 2,
    borderTopColor: "rgba(15,23,42,0.56)",
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
});
