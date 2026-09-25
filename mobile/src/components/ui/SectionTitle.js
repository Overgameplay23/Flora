import React from "react";
import { Text } from "react-native";

export default function SectionTitle({ children, className }) {
  return (
    <Text className={`text-lg font-semibold text-slate-900 ${className ?? ""}`}>
      {children}
    </Text>
  );
}
