import {
  BATTERY_OPTIONS,
  HARD_DAY_OPTIONS,
  NAME_SUGGESTIONS,
  QUIZ_STEPS,
  VOICE_OPTIONS,
  dailyCountFor,
  firstStepFor,
  isHardDayMinutes,
  isVoice,
  nameSuggestionsFor,
  nextStep,
  paintingLine,
  previousStep,
  revealReasons,
  stepProgress,
  validatePetName,
  visibleSteps,
} from "../domain/onboarding";
import { FOCUS_AREAS } from "../domain/plan/focusAreas";

function walk(mode: any, context: any) {
  const steps: string[] = [firstStepFor(mode)];
  let step = steps[0] as any;
  while (step) {
    step = nextStep(step, mode, context);
    if (step) steps.push(step);
  }
  return steps;
}

const QUIZ = ["quizAreas", "quizBattery", "quizHardDay", "quizVoice"];

describe("onboarding steps", () => {
  it("first run with photos: pet, then the quiz, then the reveal, reminder and one small thing; the painting is no step", () => {
    expect(walk("first", { hasName: false, hasPhoto: true })).toEqual(["welcome", "species", "photo", "name", ...QUIZ, "reveal", "reminder", "firstStep"]);
    expect(visibleSteps("first", "own", true)).toEqual(["welcome", "species", "photo", "name", ...QUIZ, "reveal", "reminder", "firstStep"]);
    expect(visibleSteps("first", "own", true)).not.toContain("painting");
    expect(previousStep("name", "first", "own", true)).toBe("photo");
  });

  it("falls back to the look editor without a photo", () => {
    expect(walk("first", { hasName: false, hasPhoto: false })).toEqual(["welcome", "species", "photo", "look", "name", ...QUIZ, "reveal", "reminder", "firstStep"]);
    expect(visibleSteps("first")).toContain("look");
  });

  it("asks the private cycle question only when the rhythm area was picked, and skips the reminder where there are none", () => {
    expect(walk("first", { hasName: false, hasPhoto: true, pickedCycle: true })).toEqual(["welcome", "species", "photo", "name", ...QUIZ, "quizCycle", "reveal", "reminder", "firstStep"]);
    expect(walk("first", { hasName: false, hasPhoto: true, remindersSupported: false })).toEqual(["welcome", "species", "photo", "name", ...QUIZ, "reveal", "firstStep"]);
    expect(visibleSteps("first", "own", true, { pickedCycle: true, remindersSupported: false })).toEqual(["welcome", "species", "photo", "name", ...QUIZ, "quizCycle", "reveal", "firstStep"]);
    expect(QUIZ_STEPS).toEqual([...QUIZ, "quizCycle"]);
  });

  it("suggests names only for a pet that has no photo", () => {
    expect(nameSuggestionsFor({ hasPhoto: true })).toEqual([]);
    expect(nameSuggestionsFor({ hasPhoto: false })).toEqual(NAME_SUGGESTIONS);
  });

  it("the adopt track skips the photo and the look editor for a shelter pick", () => {
    expect(walk("first", { hasName: false, hasPhoto: false, track: "adopt" })).toEqual(["welcome", "species", "shelter", "name", ...QUIZ, "reveal", "reminder", "firstStep"]);
    expect(visibleSteps("first", "adopt")).toEqual(["welcome", "species", "shelter", "name", ...QUIZ, "reveal", "reminder", "firstStep"]);
    expect(previousStep("shelter", "first", "adopt")).toBe("species");
    expect(previousStep("name", "first", "adopt")).toBe("shelter");
    expect(previousStep("name", "first", "own")).toBe("look");
    // the track only exists on the first run
    expect(nextStep("species", "look", { hasName: true, hasPhoto: false, track: "adopt" })).toBe("look");
  });

  it("keeps the new-photo flow short (with its explicit painting wait) and the look flow shorter", () => {
    expect(walk("replace", { hasName: true, hasPhoto: true })).toEqual(["photo", "painting", "meet"]);
    expect(nextStep("photo", "replace", { hasName: true, hasPhoto: false })).toBeNull();
    expect(walk("look", { hasName: true, hasPhoto: false })).toEqual(["species", "look"]);
    expect(visibleSteps("replace")).toEqual(["photo", "painting", "meet"]);
  });

  it("allows going back before the name is saved, and within the quiz, but not out of it", () => {
    expect(previousStep("species", "first")).toBe("welcome");
    expect(previousStep("species", "look")).toBeNull();
    expect(previousStep("look", "first")).toBe("photo");
    expect(previousStep("look", "look")).toBe("species");
    expect(previousStep("photo", "first")).toBe("species");
    expect(previousStep("photo", "replace")).toBeNull();
    expect(previousStep("name", "first")).toBe("look");
    expect(previousStep("quizAreas", "first")).toBeNull();
    expect(previousStep("quizBattery", "first")).toBe("quizAreas");
    expect(previousStep("quizHardDay", "first")).toBe("quizBattery");
    expect(previousStep("quizVoice", "first")).toBe("quizHardDay");
    expect(previousStep("quizCycle", "first")).toBe("quizVoice");
    expect(previousStep("reveal", "first")).toBeNull();
    expect(previousStep("reminder", "first")).toBeNull();
    expect(previousStep("painting", "replace")).toBeNull();
    expect(previousStep("meet", "replace")).toBeNull();
    expect(previousStep("firstStep", "first")).toBeNull();
  });

  it("reports progress as a 1-based position, treating the painting as the name step", () => {
    const steps = visibleSteps("first", "own", true);
    expect(stepProgress("welcome", steps)).toEqual({ index: 1, total: steps.length });
    expect(stepProgress("firstStep", steps)).toEqual({ index: steps.length, total: steps.length });
    expect(stepProgress("painting", visibleSteps("replace"))).toEqual({ index: 2, total: 3 });
    expect(stepProgress("painting", steps)).toEqual(stepProgress("name", steps));
  });
});

describe("the quiz", () => {
  it("offers the four batteries from Home, three hard-day sizes and three voices, each with a sample line", () => {
    expect(BATTERY_OPTIONS.map((o) => o.id)).toEqual(["exhausted", "anxious", "calm", "energized"]);
    expect(HARD_DAY_OPTIONS.map((o) => o.id)).toEqual([1, 5, 15]);
    expect(VOICE_OPTIONS.map((o) => o.id)).toEqual(["gentle", "warm", "plain"]);
    for (const option of VOICE_OPTIONS) expect(option.sample("Biscuit").length).toBeGreaterThan(10);
    expect(isVoice("warm")).toBe(true);
    expect(isVoice("loud")).toBe(false);
    expect(isHardDayMinutes(5)).toBe(true);
    expect(isHardDayMinutes(10)).toBe(false);
  });

  it("starts drained and anxious people on three tasks, and only grows a bright day with a real hard-day budget", () => {
    expect(dailyCountFor("exhausted", 15)).toBe(3);
    expect(dailyCountFor("anxious", 5)).toBe(3);
    expect(dailyCountFor("calm", 1)).toBe(3);
    expect(dailyCountFor("calm", 5)).toBe(4);
    expect(dailyCountFor("calm", 15)).toBe(4);
    expect(dailyCountFor("energized", 5)).toBe(4);
    expect(dailyCountFor("energized", 15)).toBe(5);
    expect(dailyCountFor(null, null)).toBe(4);
  });

  it("turns the answers into short 'because you said' chips, areas first and in order", () => {
    const labels = Object.fromEntries(FOCUS_AREAS.map((area) => [area.id, area.label]));
    expect(revealReasons({ areas: ["sleep", "calm_mind"], areaLabels: labels, battery: "exhausted", hardDay: 1 })).toEqual([
      "Sleep and wind down",
      "Quiet my anxious mind",
      "Small days by default",
      "Hard days: one tiny thing",
    ]);
    expect(revealReasons({ areas: [], areaLabels: labels, battery: null, hardDay: null })).toEqual([]);
    expect(revealReasons({ areas: ["burnout"], areaLabels: labels, battery: "energized", hardDay: 15 })).toHaveLength(3);
  });
});

describe("validatePetName", () => {
  it("trims and collapses whitespace", () => {
    expect(validatePetName("  Sir   Biscuit ")).toEqual({ ok: true, name: "Sir Biscuit" });
  });
  it("rejects empty and overlong names", () => {
    expect(validatePetName("   ").ok).toBe(false);
    expect(validatePetName(null).ok).toBe(false);
    expect(validatePetName("a".repeat(25)).ok).toBe(false);
    expect(validatePetName("a".repeat(24)).ok).toBe(true);
  });
});

describe("paintingLine", () => {
  it("advances with time and never runs past the last line", () => {
    expect(paintingLine(0, "Biscuit")).toContain("Biscuit");
    expect(paintingLine(7, "Biscuit")).not.toBe(paintingLine(0, "Biscuit"));
    expect(paintingLine(500, "Biscuit")).toBe(paintingLine(30, "Biscuit"));
    expect(paintingLine(-5, "Biscuit")).toBe(paintingLine(0, "Biscuit"));
  });
});
