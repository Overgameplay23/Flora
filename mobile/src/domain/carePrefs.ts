// What the person told us about themselves in onboarding, beyond the plan settings: their usual battery,
// how much a hard day allows, and how the pet should talk to them. Kept on the device
// (src/services/carePrefs.ts); nothing here is clinical and nothing leaves the phone.
import type { Energy } from "./plan/types";
import { type HardDayMinutes, type Voice, isHardDayMinutes, isVoice } from "./onboarding";

export type CarePrefs = {
  version: 1;
  /** how most days feel, from the quiz; today's battery is asked separately on Home */
  usualBattery: Energy | null;
  hardDayMinutes: HardDayMinutes | null;
  voice: Voice;
  /** ISO time the first-run flow finished on this device; null until then */
  completedAt: string | null;
};

const ENERGIES: Energy[] = ["exhausted", "anxious", "calm", "energized"];

export const DEFAULT_CARE_PREFS: CarePrefs = { version: 1, usualBattery: null, hardDayMinutes: null, voice: "warm", completedAt: null };

/** Defensive parse for whatever storage hands back; unknown values fall back to the defaults. */
export function normalizeCarePrefs(raw: unknown): CarePrefs {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  const record = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const completedAt = typeof record.completedAt === "string" && !Number.isNaN(new Date(record.completedAt).getTime()) ? record.completedAt : null;
  return {
    version: 1,
    usualBattery: ENERGIES.includes(record.usualBattery as Energy) ? (record.usualBattery as Energy) : null,
    hardDayMinutes: isHardDayMinutes(record.hardDayMinutes) ? record.hardDayMinutes : null,
    voice: isVoice(record.voice) ? record.voice : DEFAULT_CARE_PREFS.voice,
    completedAt,
  };
}
