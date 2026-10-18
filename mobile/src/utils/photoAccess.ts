// After someone taps "Don't Allow" on the photos or camera prompt, iOS never asks again: the only way back is the
// Settings app. So the denied path explains that and offers to open Luna's page there, the way the Reminders screen
// does for notifications. (The TestFlight audit found the old "Permission needed" alert was a dead end.)
import { Linking, Platform } from "react-native";
import { confirmAsync, notify } from "./confirm";

export type PhotoSource = "camera" | "library";

export function photoAccessCopy(source: PhotoSource): { title: string; message: string } {
  return source === "camera"
    ? { title: "Luna can't use the camera", message: "To take a photo of your pet, allow Camera access for Luna in Settings." }
    : { title: "Luna can't see your photos", message: "To choose pictures of your pet, allow Photos access for Luna in Settings." };
}

/** Explains a denied photos/camera permission and, on a phone, offers "Open Settings". */
export async function explainPhotoAccessDenied(source: PhotoSource): Promise<void> {
  const { title, message } = photoAccessCopy(source);
  if (Platform.OS === "web") {
    notify(title, message);
    return;
  }
  const open = await confirmAsync({ title, message, confirmText: "Open Settings", cancelText: "Not now" });
  if (open) await Linking.openSettings().catch(() => {});
}
