// Pure rules for the first-run flow and its two shorter cousins ("new photo", "change look").

export type OnboardingMode = "first" | "replace" | "look";
export type OnboardingStep = "welcome" | "species" | "shelter" | "look" | "photo" | "name" | "painting" | "meet" | "firstStep";
/** "own": bring a real pet to life; "adopt": no pet, adopt an illustrated companion (report edge case) */
export type OnboardingTrack = "own" | "adopt";

export const PET_NAME_MAX = 24;
export const NAME_SUGGESTIONS = ["Biscuit", "Mochi", "Pepper", "Luna", "Olive", "Ziggy", "Maple", "Pickle"];
/** How many photos of the real pet the portrait is painted from. */
export const PET_PHOTO_MIN = 1;
export const PET_PHOTO_MAX = 3;

export type StepContext = { hasName: boolean; hasPhoto: boolean; track?: OnboardingTrack };

export function firstStepFor(mode: OnboardingMode): OnboardingStep {
  if (mode === "look") return "species";
  return mode === "first" ? "welcome" : "photo";
}

/**
 * Name ideas are for a pet that does not exist yet (an adopted companion, or a look chosen without a
 * photo). A real pet in a photo already has a name, so nothing is suggested.
 */
export function nameSuggestionsFor(context: { hasPhoto: boolean }): string[] {
  return context.hasPhoto ? [] : NAME_SUGGESTIONS;
}

/**
 * The step after `step`. First run: welcome -> species -> photos (1-3) -> name -> painting -> meet ->
 * one small thing. The portrait is painted from the photos alone, so the look editor is only visited
 * when no photo was added (welcome -> species -> photo -> look -> name -> meet -> firstStep).
 * "replace" is photo -> painting -> meet. "look" is species -> look and ends there.
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
      // with photos the portrait comes from the photos; nothing to pick by hand
      return context.hasPhoto ? "name" : "look";
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

export function previousStep(step: OnboardingStep, mode: OnboardingMode, track: OnboardingTrack = "own", hasPhoto = false): OnboardingStep | null {
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
      if (mode === "first" && track === "adopt") return "shelter";
      return hasPhoto ? "photo" : "look";
    default:
      // painting, meet and firstStep cannot go back: the photo is already saved
      return null;
  }
}

/** Steps shown as progress dots, in order, for a mode. */
export function visibleSteps(mode: OnboardingMode, track: OnboardingTrack = "own", hasPhoto = false): OnboardingStep[] {
  if (mode === "look") return ["species", "look"];
  if (mode === "replace") return ["photo", "painting", "meet"];
  if (track === "adopt") return ["welcome", "species", "shelter", "name", "meet", "firstStep"];
  if (hasPhoto) return ["welcome", "species", "photo", "name", "meet", "firstStep"];
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
