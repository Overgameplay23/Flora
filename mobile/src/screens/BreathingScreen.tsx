import React from "react";
import { useNavigation } from "@react-navigation/native";
import BreathingSession from "../components/breathing/BreathingSession";

/**
 * The "Breathing" route (Home's "Breathe together", breathing tasks from the plan, the Pet tab). The same
 * session as BreathingModal, so there is one breathing experience everywhere. Home ticks a breathing task
 * when the person comes back from here.
 */
export default function BreathingScreen() {
  const navigation = useNavigation();
  return <BreathingSession onClose={() => navigation.goBack()} />;
}
