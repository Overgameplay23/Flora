// Local reminders on the device: settings in AsyncStorage, scheduling through expo-notifications.
// No server, no push tokens. Web has no scheduled notifications, so everything here is a no-op there
// and the settings screen says so. The module is loaded lazily so the web bundle never touches it.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { ReminderSettings, buildReminderPlan, normalizeReminderSettings, type ReminderContext } from "../domain/reminders";

const settingsKey = (userId: string) => `floura:reminders:${userId}`;
const LUNA_TAG = "luna-reminder";

export const remindersSupported = Platform.OS !== "web";

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeReminders(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifications(): any | null {
  if (!remindersSupported) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-notifications");
  } catch (error: any) {
    console.warn("REMINDERS_MODULE_UNAVAILABLE", { message: error?.message });
    return null;
  }
}

export async function loadReminderSettings(userId: string | null | undefined): Promise<ReminderSettings> {
  if (!userId) return normalizeReminderSettings(null);
  try {
    const raw = await AsyncStorage.getItem(settingsKey(userId));
    return normalizeReminderSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeReminderSettings(null);
  }
}

export async function saveReminderSettings(userId: string, settings: ReminderSettings): Promise<ReminderSettings> {
  const next = normalizeReminderSettings(settings);
  try {
    await AsyncStorage.setItem(settingsKey(userId), JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
  return next;
}

export type PermissionState = "granted" | "denied" | "undetermined" | "unsupported";

export async function getReminderPermission(): Promise<PermissionState> {
  const N = notifications();
  if (!N) return "unsupported";
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted || current.ios?.status === N.IosAuthorizationStatus?.PROVISIONAL) return "granted";
    return current.canAskAgain === false ? "denied" : "undetermined";
  } catch {
    return "unsupported";
  }
}

export async function requestReminderPermission(): Promise<PermissionState> {
  const N = notifications();
  if (!N) return "unsupported";
  try {
    const result = await N.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
    if (result.granted || result.ios?.status === N.IosAuthorizationStatus?.PROVISIONAL) return "granted";
    return result.canAskAgain === false ? "denied" : "undetermined";
  } catch (error: any) {
    console.warn("REMINDERS_PERMISSION_FAILED", { message: error?.message });
    return "unsupported";
  }
}

/** Removes every reminder Luna scheduled (never anything else the app might schedule). */
export async function cancelReminders(): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    const scheduled: any[] = await N.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item?.content?.data?.tag === LUNA_TAG)
        .map((item) => N.cancelScheduledNotificationAsync(item.identifier).catch(() => {}))
    );
  } catch (error: any) {
    console.warn("REMINDERS_CANCEL_FAILED", { message: error?.message });
  }
}

let lastSyncAt = 0;

/**
 * Rebuilds the next week of reminders from the saved settings and the current context. Cheap, so
 * it runs whenever Home comes into focus (rate-limited) and after settings change.
 */
export async function syncReminders(userId: string | null | undefined, ctx: ReminderContext, options?: { force?: boolean }): Promise<number> {
  if (!userId || !remindersSupported) return 0;
  const now = Date.now();
  if (!options?.force && now - lastSyncAt < 10 * 60 * 1000) return -1;
  lastSyncAt = now;

  const settings = await loadReminderSettings(userId);
  await cancelReminders();
  if (!settings.enabled) return 0;
  if ((await getReminderPermission()) !== "granted") return 0;

  const N = notifications();
  if (!N) return 0;
  const plan = buildReminderPlan(settings, ctx);
  let scheduled = 0;
  for (const item of plan) {
    try {
      await N.scheduleNotificationAsync({
        content: { title: item.title, body: item.body, sound: item.kind === "weekly" ? undefined : "default", data: { tag: LUNA_TAG, kind: item.kind, id: item.id } },
        trigger: { type: N.SchedulableTriggerInputTypes?.DATE ?? "date", date: item.fireAt },
      });
      scheduled += 1;
    } catch (error: any) {
      console.warn("REMINDERS_SCHEDULE_FAILED", { id: item.id, message: error?.message });
    }
  }
  return scheduled;
}

/** Which screen a tapped reminder should open. */
export function screenForReminder(data: unknown): "CheckIn" | "WeeklyReflection" | null {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (d.tag !== LUNA_TAG) return null;
  if (d.kind === "evening") return "CheckIn";
  if (d.kind === "weekly") return "WeeklyReflection";
  return null;
}
