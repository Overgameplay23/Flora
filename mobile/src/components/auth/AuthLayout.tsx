import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GardenStage from "../garden/GardenStage";
import SceneOverlay from "../garden/SceneOverlay";
import { useTheme, useThemeHour } from "../../theme/theme";
import { radius } from "../../theme/tokens";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

/**
 * Sign-in and sign-up: the painted sanctuary of the hour, empty and waiting for a pet, with a warm paper
 * sheet holding the form (the same composition as Home).
 */
export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const { surface, sky } = useTheme();
  const hour = useThemeHour();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sceneHeight = Math.round(Math.min(380, Math.max(260, height * 0.4)));
  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: surface.canvas }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.fill} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <GardenStage height={sceneHeight} variant="hero" theme="garden" hour={hour} hidePet accessibilityLabel="A painted garden at this time of day">
          <SceneOverlay sky={sky} topInset={insets.top} title={title} subtitle={subtitle} />
        </GardenStage>
        <View style={[styles.sheet, { backgroundColor: surface.canvas, paddingBottom: insets.bottom + 28 }]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  sheet: {
    flexGrow: 1,
    marginTop: -30,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: "continuous",
    paddingTop: 26,
    paddingHorizontal: 24,
    gap: 12,
  },
});
