// The battery check on Home (product strategy: "Energy slider: Exhausted | Anxious | Calm | Energized; pet
// posture mirrors it"). One tap, no score; it shapes today's plan and the pet's mood. Kept on the device.

import type { Energy } from "./plan/types";
import type { PetMood } from "./petMood";

export type EnergyOption = {
  id: Energy;
  label: string;
  /** Ionicons glyph */
  icon: string;
  /** care category whose colours the option uses */
  category: "rest" | "calm" | "focus" | "play";
  /** how the pet carries itself once this is picked */
  petMood: PetMood;
};

export const ENERGY_OPTIONS: EnergyOption[] = [
  { id: "exhausted", label: "Drained", icon: "battery-dead-outline", category: "rest", petMood: "sleepy" },
  { id: "anxious", label: "On edge", icon: "pulse-outline", category: "calm", petMood: "calm" },
  { id: "calm", label: "Steady", icon: "leaf-outline", category: "focus", petMood: "happy" },
  { id: "energized", label: "Bright", icon: "sunny-outline", category: "play", petMood: "excited" },
];

export function energyOption(energy: Energy | null | undefined): EnergyOption | null {
  return ENERGY_OPTIONS.find((option) => option.id === energy) ?? null;
}

/** Drained or on edge: the day gets smaller and softer (fewer, gentler tasks; no upsell; breathing first). */
export function isGentleEnergy(energy: Energy | null | undefined): boolean {
  return energy === "exhausted" || energy === "anxious";
}
