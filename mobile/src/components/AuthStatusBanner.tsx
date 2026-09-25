import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

type AuthStatusBannerProps = {
  message: string | null;
  onDismiss?: () => void;
};

export default function AuthStatusBanner({ message, onDismiss }: AuthStatusBannerProps) {
  if (!message) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
      {onDismiss ? (
        <Pressable style={styles.button} onPress={onDismiss}>
          <Text style={styles.buttonText}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 42,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f97316",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 18,
  },
  text: {
    color: "#fff7ed",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.3,
    flex: 1,
    marginRight: 10,
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff7ed",
    fontWeight: "700",
    fontSize: 12,
  },
});
