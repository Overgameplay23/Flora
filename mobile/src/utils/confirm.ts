// Cross-platform confirmation. React Native Web's Alert.alert is a no-op, so every "are you sure?"
// silently did nothing on web; here the web falls back to the browser's own confirm/alert dialogs.
import { Alert, Platform } from "react-native";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

export function confirmAsync({ title, message, confirmText = "OK", cancelText = "Cancel", destructive = false }: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === "web") {
    const w = globalThis as any;
    if (typeof w.confirm === "function") return Promise.resolve(!!w.confirm(message ? `${title}\n\n${message}` : title));
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: "cancel", onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    const w = globalThis as any;
    if (typeof w.alert === "function") w.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
