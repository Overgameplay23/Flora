import React from "react";
import { Modal } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import BreathingSession from "../breathing/BreathingSession";

type BreathingModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * The breathing minute over the current screen (check-in on a hard day, the memorial's quiet minute, Home's
 * memorial card). Same session as the Breathing route; it starts fresh each time it opens.
 */
export default function BreathingModal({ visible, onClose }: BreathingModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      {/* a Modal is a new native root: give it its own safe-area context */}
      <SafeAreaProvider>{visible ? <BreathingSession onClose={onClose} /> : null}</SafeAreaProvider>
    </Modal>
  );
}
