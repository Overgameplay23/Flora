// Pure rules for the first-run flow and its two shorter cousins ("new photo", "change look").

export type OnboardingMode = "first" | "replace" | "look";
export type OnboardingStep = "welcome" | "species" | "shelter" | "look" | "photo" | "name" | "painting" | "meet" | "firstStep";
/** "own": bring a real pet to life; "adopt": no pet, adopt an illustrated companion (report edge case) */
export type OnboardingTrack = "own" | "adopt";

export const PET_NAME_MAX = 24;
export const NAME_SUGGESTIONS = ["Biscuit", "Mochi", "Pepper", "Luna", "Olive", "Ziggy", "Maple", "Pickle"];

export type StepContext = { hasName: boolean; hasPhoto: boolean; track?: OnboardingTrack };

export function firstStepFor(mode: OnboardingMode): OnboardingStep {
  if (mode === "look") return "species";
  return mode === "first" ? "welcome" : "photo";
}

/**
 * The step after `step`. First run: welcome -> species -> photo (optional) -> look (seeded from the
 * photo) -> name -> painting (only with a photo) -> meet -> one small thing. "replace" is
 * photo -> painting -> meet. "look" is species -> look and ends there.
 */
export function nextStep(step: OnboardingStep, mode: OnboardingMode, context: StepContext): OnboardingStep | null {
  const adopt = mode === "first" && context.track === "adopt";
  switch (step) {
    case "welcome":
      return "species";
    case "species":
      if (mode === "look") return "look";
      return adopt ? "shelter" : "photo";
    case "shelter":
      return "name";
    case "look":
      return mode === "look" ? null : "name";
    case "photo":
      if (mode === "replace") return context.hasPhoto ? "painting" : null;
      return "look";
    case "name":
      return context.hasPhoto ? "painting" : "meet";
    case "painting":
      return "meet";
    case "meet":
      return mode === "first" ? "firstStep" : null;
    default:
      return null;
  }
}

export function previousStep(step: OnboardingStep, mode: OnboardingMode, track: OnboardingTrack = "own"): OnboardingStep | null {
  switch (step) {
    case "species":
      return mode === "first" ? "welcome" : null;
    case "shelter":
      return "species";
    case "look":
      return mode === "look" ? "species" : "photo";
    case "photo":
      return mode === "first" ? "species" : null;
    case "name":
      return mode === "first" && track === "adopt" ? "shelter" : "look";
    default:
      // painting, meet and firstStep cannot go back: the photo is already saved
      return null;
  }
}

/** Steps shown as progress dots, in order, for a mode. */
export function visibleSteps(mode: OnboardingMode, track: OnboardingTrack = "own"): OnboardingStep[] {
  if (mode === "look") return ["species", "look"];
  if (mode === "replace") return ["photo", "painting", "meet"];
  if (track === "adopt") return ["welcome", "species", "shelter", "name", "meet", "firstStep"];
  return ["welcome", "species", "photo", "look", "name", "meet", "firstStep"];
}

export function validatePetName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: "Give them a name, even a silly one." };
  if (name.length > PET_NAME_MAX) return { ok: false, error: `Keep it to ${PET_NAME_MAX} characters.` };
  return { ok: true, name };
}

/** Rotating status lines while the portrait is painted; index by elapsed seconds. */
export function paintingLine(elapsedSeconds: number, name: string): string {
  const lines = [
    `Looking closely at ${name}…`,
    "Sketching the outline…",
    "Mixing the colours…",
    "Adding the soft edges…",
    `Almost there. ${name} is nearly ready.`,
  ];
  const index = Math.min(lines.length - 1, Math.floor(Math.max(0, elapsedSeconds) / 6));
  return lines[index];
}
