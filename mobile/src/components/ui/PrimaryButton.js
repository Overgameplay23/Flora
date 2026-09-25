import React from "react";
import { Pressable, Text } from "react-native";

export default function PrimaryButton({ title, onPress, disabled, className }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 items-center ${disabled ? "bg-emerald-200" : "bg-emerald-500"} ${className ?? ""}`}
    >
      <Text className="text-white font-semibold">{title}</Text>
    </Pressable>
  );
}
