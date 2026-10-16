// Device store for Days Together milestones (src/domain/milestones.ts): which thresholds were reached and
// when. Per user, on this phone.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type MilestoneDays, type MilestoneRecord, normalizeMilestoneRecord, reconcileMilestones } from "../domain/milestones";

const key = (userId: string) => `floura:milestones:${userId}`;

export async function loadMilestones(userId: string | null | undefined): Promise<MilestoneRecord> {
  if (!userId) return {};
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? normalizeMilestoneRecord(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Compares Days Together with what was already celebrated, writes the record, and returns the one milestone
 * (if any) to celebrate right now.
 */
export async function reconcileMilestonesForUser(userId: string, days: number, today: string): Promise<MilestoneDays | null> {
  if (!userId) return null;
  const current = await loadMilestones(userId);
  const { record, celebrate } = reconcileMilestones(current, days, today);
  if (celebrate != null) {
    try {
      await AsyncStorage.setItem(key(userId), JSON.stringify(record));
    } catch (error) {
      console.warn("MILESTONES_SAVE_FAILED", (error as any)?.message || String(error));
    }
  }
  return celebrate;
}
