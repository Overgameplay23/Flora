// When a reminder is tapped, open the screen it was about (check-in for the evening nudge, the
// weekly recap on Sundays). Morning hellos just open the app. No-op on web.
import { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { remindersSupported, screenForReminder } from "../services/reminders";

export function useReminderTaps() {
  const navigation = useNavigation<any>();
  useEffect(() => {
    if (!remindersSupported) return undefined;
    let N: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      N = require("expo-notifications");
    } catch {
      return undefined;
    }
    const open = (response: any) => {
      const target = screenForReminder(response?.notification?.request?.content?.data);
      if (target) navigation.navigate(target);
    };
    // a tap that launched the app arrives here too
    N.getLastNotificationResponseAsync?.()
      .then((response: any) => response && open(response))
      .catch(() => {});
    const subscription = N.addNotificationResponseReceivedListener(open);
    return () => subscription?.remove?.();
  }, [navigation]);
}
