import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/theme";
import { space } from "../../theme/tokens";

type ScreenProps = {
  children?: React.ReactNode;
  /** a scrolling page (default) or a fixed one */
  scroll?: boolean;
  /** tab screens have no header, so they keep clear of the status bar themselves */
  topInset?: boolean;
  /** horizontal gutter; off for full-bleed scenes */
  padded?: boolean;
  /** center the content (loading, empty and message states) */
  centered?: boolean;
  /** extra room under the content (tab bar, floating toast) */
  bottomPad?: number;
  /** lift the page above the keyboard on forms */
  keyboard?: boolean;
  refreshControl?: React.ReactElement<any>;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

/** The page every screen sits on: the time-of-day canvas, the gutter, and sensible scrolling. */
export default function Screen({
  children,
  scroll = true,
  topInset = false,
  padded = true,
  centered = false,
  bottomPad = 40,
  keyboard = false,
  refreshControl,
  contentStyle,
  style,
}: ScreenProps) {
  const { surface } = useTheme();
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = {
    paddingHorizontal: padded ? space.gutter : 0,
    paddingTop: (topInset ? insets.top : 0) + (padded ? 16 : 0),
    paddingBottom: bottomPad,
  };
  const body = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[pad, centered && styles.centeredScroll, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, pad, centered && styles.centered, contentStyle]}>{children}</View>
  );
  const page = <View style={[styles.fill, { backgroundColor: surface.canvas }, style]}>{body}</View>;
  if (!keyboard) return page;
  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: surface.canvas }]} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      {page}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  centeredScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
