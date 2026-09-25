// Pure rules for the first-run flow (and the "change pet" flow that reuses it).

export type OnboardingMode = "first" | "replace";
export type OnboardingStep = "welcome" | "photo" | "name" | "painting" | "meet" | "firstStep";

export const PET_NAME_MAX = 24;
export const NAME_SUGGESTIONS = ["Biscuit", "Mochi", "Pepper", "Luna", "Olive", "Ziggy", "Maple", "Pickle"];

export function firstStepFor(mode: OnboardingMode): OnboardingStep {
  return mode === "first" ? "welcome" : "photo";
}

/**
 * The step after `step`. In replace mode a pet that already has a name skips the name step and the flow
 * ends right after the reveal; a first-time user is walked through to their first small action.
 */
export function nextStep(step: OnboardingStep, mode: OnboardingMode, context: { hasName: boolean }): OnboardingStep | null {
  switch (step) {
    case "welcome":
      return "photo";
    case "photo":
      return mode === "replace" && context.hasName ? "painting" : "name";
    case "name":
      return "painting";
    case "painting":
      return "meet";
    case "meet":
      return mode === "first" ? "firstStep" : null;
    default:
      return null;
  }
}

export function previousStep(step: OnboardingStep, mode: OnboardingMode): OnboardingStep | null {
  switch (step) {
    case "photo":
      return mode === "first" ? "welcome" : null;
    case "name":
      return "photo";
    default:
      // painting, meet and firstStep cannot go back: the photo is already saved
      return null;
  }
}

/** Steps shown as progress dots, in order, for a mode. */
export function visibleSteps(mode: OnboardingMode): OnboardingStep[] {
  return mode === "first" ? ["welcome", "photo", "name", "painting", "meet", "firstStep"] : ["photo", "name", "painting", "meet"];
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
