// On-device storage for the optional cycle tracker.
//
// Cycle data is health data. It is kept ONLY on this device (AsyncStorage, per user id), it is never
// sent to Supabase or to any provider, and the person can delete it in one tap. If a synced option is
// ever wanted it must be an explicit opt-in with its own consent screen; nothing here should be reused
// for that without the owner's decision.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CycleData, EMPTY_CYCLE_DATA, normalizeCycleData } from "../domain/cycle";

const dataKey = (userId: string) => `floura:cycle:${userId}`;
const enabledKey = (userId: string) => `floura:cycle-enabled:${userId}`;

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((listener) => listener());
}

/** Screens that show cycle info subscribe so an edit on the Cycle screen refreshes the Home card. */
export function subscribeCycle(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadCycleEnabled(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    return (await AsyncStorage.getItem(enabledKey(userId))) === "1";
  } catch {
    return false;
  }
}

export async function setCycleEnabled(userId: string, enabled: boolean) {
  try {
    await AsyncStorage.setItem(enabledKey(userId), enabled ? "1" : "0");
  } catch {}
  notify();
}

export async function loadCycleData(userId: string | null | undefined): Promise<CycleData> {
  if (!userId) return EMPTY_CYCLE_DATA;
  try {
    const raw = await AsyncStorage.getItem(dataKey(userId));
    return raw ? normalizeCycleData(JSON.parse(raw)) : EMPTY_CYCLE_DATA;
  } catch {
    return EMPTY_CYCLE_DATA;
  }
}

export async function saveCycleData(userId: string, data: CycleData) {
  const normalized = normalizeCycleData(data);
  try {
    await AsyncStorage.setItem(dataKey(userId), JSON.stringify(normalized));
  } catch {}
  notify();
  return normalized;
}

/** Removes every trace of cycle tracking for this user from the device. */
export async function clearCycleData(userId: string) {
  try {
    await AsyncStorage.multiRemove([dataKey(userId), enabledKey(userId)]);
  } catch {}
  notify();
}
