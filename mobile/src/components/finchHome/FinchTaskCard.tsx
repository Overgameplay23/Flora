import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

type FinchTaskCardProps = {
  title: string;
  reward: string;
  icon: string;
  completed?: boolean;
  saving?: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

function FinchTaskCard({ title, reward, icon, completed, saving, disabled, onToggle }: FinchTaskCardProps) {
  return (
    <View style={[styles.card, completed && styles.cardDone]}>
      <View style={styles.iconWrap}>
        <Feather name={icon as any} size={16} color="#e2e8f0" />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, completed && styles.titleDone]}>{title}</Text>
      </View>
      <Text style={[styles.reward, completed && styles.titleDone, saving && styles.rewardSaving]}>
        {saving ? "Saving..." : reward}
      </Text>
      <Pressable
        style={[styles.checkButton, completed && styles.checkButtonDone, disabled && styles.checkButtonDisabled]}
        disabled={disabled}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={completed ? `${title}, completed` : `Complete ${title}`}
        accessibilityState={{ disabled: !!disabled, checked: !!completed }}
      >
        <Feather name="check" size={14} color={completed ? "#0f172a" : "#35d07f"} />
      </Pressable>
    </View>
  );
}

export default React.memo(FinchTaskCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121826",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  cardDone: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(148,163,184,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  body: {
    flex: 1,
  },
  title: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "600",
  },
  titleDone: {
    color: "rgba(226,232,240,0.6)",
    textDecorationLine: "line-through",
  },
  reward: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 10,
  },
  rewardSaving: {
    color: "#fcd34d",
  },
  checkButton: {
    width: 30,
    height: 30,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(53,208,127,0.6)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkButtonDone: {
    backgroundColor: "#35d07f",
    borderColor: "#35d07f",
  },
  checkButtonDisabled: {
    opacity: 0.5,
  },
});
