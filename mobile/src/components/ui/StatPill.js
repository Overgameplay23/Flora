import React from "react";
import { View, Text } from "react-native";

export default function StatPill({ label, value, className }) {
  return (
    <View className={`bg-emerald-50 rounded-full px-3 py-2 ${className ?? ""}`}>
      <Text className="text-xs uppercase tracking-wide text-emerald-700">{label}</Text>
      <Text className="text-base font-semibold text-emerald-900">{value}</Text>
    </View>
  );
}
