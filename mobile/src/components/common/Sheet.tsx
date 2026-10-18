import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PetMascot from "../pet/PetMascot";
import type { PetMood } from "../pet/PetPortrait";
import { useTheme } from "../../theme/theme";
import { radius, type } from "../../theme/tokens";

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string | null;
  subtitle?: string | null;
  /** the pet sits beside the title */
  pet?: { mood?: PetMood; size?: number } | null;
  /** pinned under the scrolling content (the sheet's buttons) */
  footer?: React.ReactNode;
  /** block closing by the backdrop / back button (while saving) */
  locked?: boolean;
  children?: React.ReactNode;
};

/** A paper bottom sheet over a soft plum scrim, with the pet beside the title when it helps. */
export default function Sheet({ visible, onClose, title, subtitle, pet, footer, locked = false, children }: SheetProps) {
  const { surface } = useTheme();
  const insets = useSafeAreaInsets();
  const close = () => {
    if (!locked) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { backgroundColor: surface.canvas, paddingBottom: insets.bottom + 16, boxShadow: surface.shadowRaised }]}>
          <View style={[styles.grabber, { backgroundColor: surface.track }]} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {title || pet ? (
              // with the pet beside the title, keep room above it inside the scroll view for a hat it wears
              <View style={[styles.header, pet ? { paddingTop: Math.ceil(0.3 * (pet.size ?? 72)) } : null]}>
                <View style={styles.headerText}>
                  {title ? (
                    <Text style={[type.title, { color: surface.text }]} accessibilityRole="header">
                      {title}
                    </Text>
                  ) : null}
                  {subtitle ? <Text style={[type.callout, styles.subtitle, { color: surface.textSecondary }]}>{subtitle}</Text> : null}
                </View>
                {pet ? <PetMascot size={pet.size ?? 72} mood={pet.mood ?? "happy"} showShadow={false} /> : null}
              </View>
            ) : null}
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(32,24,40,0.42)",
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: "continuous",
    paddingTop: 8,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
  },
  subtitle: {
    marginTop: 6,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 4,
  },
});
