// Device store for the care preferences gathered in onboarding (src/domain/carePrefs.ts). Per user, on
// this phone only.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_CARE_PREFS, normalizeCarePrefs, type CarePrefs } from "../domain/carePrefs";

const key = (userId: string) => `floura:care-prefs:${userId}`;

export async function loadCarePrefs(userId: string | null | undefined): Promise<CarePrefs> {
  if (!userId) return { ...DEFAULT_CARE_PREFS };
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? normalizeCarePrefs(raw) : { ...DEFAULT_CARE_PREFS };
  } catch {
    return { ...DEFAULT_CARE_PREFS };
  }
}

/** Merges `patch` into what is stored and returns the result; never throws. */
export async function saveCarePrefs(userId: string, patch: Partial<CarePrefs>): Promise<CarePrefs> {
  const current = await loadCarePrefs(userId);
  const next = normalizeCarePrefs({ ...current, ...patch });
  if (!userId) return next;
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(next));
  } catch (error) {
    console.warn("CARE_PREFS_SAVE_FAILED", (error as any)?.message || String(error));
  }
  return next;
}
