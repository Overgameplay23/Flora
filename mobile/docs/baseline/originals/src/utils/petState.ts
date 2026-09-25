export type MirroredPetState = "sad" | "calm" | "happy" | "excited";

export function derivePetState(mood: number): MirroredPetState {
  const normalizedMood = Math.max(1, Math.min(5, Math.round(mood)));
  if (normalizedMood <= 2) return "sad";
  if (normalizedMood === 3) return "calm";
  if (normalizedMood === 4) return "happy";
  return "excited";
}
