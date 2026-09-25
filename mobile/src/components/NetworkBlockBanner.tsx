import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { clearNetworkBlock, getNetworkBlockState, subscribeNetworkBlock } from "../utils/net";
import { isSupabaseUrlConfigured } from "../utils/env";

export default function NetworkBlockBanner() {
  const [block, setBlock] = React.useState(getNetworkBlockState());

  React.useEffect(() => subscribeNetworkBlock(setBlock), []);

  if (!block) return null;

  const handleRetry = () => {
    clearNetworkBlock(block.url);
  };

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Network blocked: check VPN/Wi-Fi</Text>
      <Pressable style={styles.button} onPress={handleRetry}>
        <Text style={styles.buttonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: __DEV__ && !isSupabaseUrlConfigured() ? 44 : 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f59e0b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 19,
  },
  text: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  button: {
    backgroundColor: "rgba(15,23,42,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buttonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 12,
  },
});
