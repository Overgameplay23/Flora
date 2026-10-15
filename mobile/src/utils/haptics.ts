import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// One place for haptics, tied strictly to cause and effect (docs/design-system.md): a soft tap when
// something is ticked, one success pulse when the day's care is done, a selection tick for pickers.
// Never on a missed task, never for a plain button press. Silent on web and wherever the module is absent.

const enabled = Platform.OS === "ios" || Platform.OS === "android";

function run(effect: () => Promise<void>) {
  if (!enabled) return;
  try {
    void effect().catch(() => {});
  } catch (_error) {}
}

/** A task or care act was ticked. */
export function tapSoft() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
}

/** Petting the pet; callers throttle it. */
export function tapLight() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Everything for today is done; once per day. */
export function success() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** A picker or option changed. */
export function selection() {
  run(() => Haptics.selectionAsync());
}

/** Something could not be saved. */
export function warning() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
