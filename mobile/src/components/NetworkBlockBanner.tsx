import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { clearNetworkBlock, getNetworkBlockState, subscribeNetworkBlock } from "../utils/net";
import { isSupabaseUrlConfigured } from "../utils/env";
import { categories, fonts, ink } from "../theme/tokens";

/** The app paused its requests because the network looks blocked (VPN, captive Wi-Fi); one tap retries. */
export default function NetworkBlockBanner() {
  const [block, setBlock] = React.useState(getNetworkBlockState());

  React.useEffect(() => subscribeNetworkBlock(setBlock), []);

  if (!block) return null;

  const handleRetry = () => {
    clearNetworkBlock(block.url);
  };

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Text style={styles.text}>Can't reach the network. Check VPN or Wi-Fi.</Text>
      <Pressable style={styles.button} onPress={handleRetry} accessibilityRole="button" accessibilityLabel="Retry the connection">
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
    backgroundColor: categories.energy.mid,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 19,
  },
  text: {
    color: ink.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.2,
    flex: 1,
    marginRight: 10,
  },
  button: {
    backgroundColor: "rgba(46,40,56,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  buttonText: {
    color: ink.primary,
    fontFamily: fonts.bodyHeavy,
    fontSize: 12,
  },
});
