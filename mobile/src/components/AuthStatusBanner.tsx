import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { brand, fonts } from "../theme/tokens";

type AuthStatusBannerProps = {
  message: string | null;
  onDismiss?: () => void;
};

/** A line from the auth layer (the service is briefly unavailable, a session could not refresh), dismissible.
 * Stacked with the other app-wide banners under the notch by RootNavigator. */
export default function AuthStatusBanner({ message, onDismiss }: AuthStatusBannerProps) {
  if (!message) return null;

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{message}</Text>
      {onDismiss ? (
        <Pressable style={styles.button} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Text style={styles.buttonText}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: brand.plum,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  text: {
    color: brand.cream,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.2,
    flex: 1,
    marginRight: 10,
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  buttonText: {
    color: brand.cream,
    fontFamily: fonts.bodyHeavy,
    fontSize: 12,
  },
});
