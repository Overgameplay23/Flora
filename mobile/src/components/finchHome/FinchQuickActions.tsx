import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import FinchSectionTitle from "./FinchSectionTitle";

type FinchQuickActionsProps = {
  onCheckIn: () => void;
  onHabits: () => void;
  title?: string;
  checkInLabel?: string;
  checkInIcon?: string;
  secondaryLabel?: string;
  secondaryIcon?: string;
  onSecondaryAction?: () => void;
};

function ActionCard({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return (
    <Pressable style={styles.actionCard} onPress={onPress}>
      <View style={styles.actionLeft}>
        <View style={styles.actionIcon}>
          <Feather name={icon as any} size={18} color="#e2e8f0" />
        </View>
        <Text style={styles.actionText}>{label}</Text>
      </View>
      <View style={styles.actionCheck}>
        <Feather name="check" size={14} color="#0f172a" />
      </View>
    </Pressable>
  );
}

function FinchQuickActions({
  onCheckIn,
  onHabits,
  title = "Quick Actions",
  checkInLabel = "Check-in",
  checkInIcon = "sunrise",
  secondaryLabel = "Habits",
  secondaryIcon = "check-square",
  onSecondaryAction,
}: FinchQuickActionsProps) {
  const secondaryAction = onSecondaryAction || onHabits;

  return (
    <View style={styles.card}>
      <FinchSectionTitle>{title}</FinchSectionTitle>
      <View style={styles.row}>
        <View style={[styles.actionWrap, styles.actionWrapLeft]}>
          <ActionCard label={checkInLabel} icon={checkInIcon} onPress={onCheckIn} />
        </View>
        <View style={styles.actionWrap}>
          <ActionCard label={secondaryLabel} icon={secondaryIcon} onPress={secondaryAction} />
        </View>
      </View>
    </View>
  );
}

export default React.memo(FinchQuickActions);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(18,24,38,0.95)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  row: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionWrap: {
    flex: 1,
  },
  actionWrapLeft: {
    marginRight: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: "#e2e8f0",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 10,
  },
  actionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#35d07f",
    alignItems: "center",
    justifyContent: "center",
  },
});
