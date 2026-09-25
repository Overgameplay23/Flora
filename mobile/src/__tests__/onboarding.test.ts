import { firstStepFor, nextStep, paintingLine, previousStep, validatePetName, visibleSteps } from "../domain/onboarding";

function walk(mode: any, context: any) {
  const steps: string[] = [firstStepFor(mode)];
  let step = steps[0] as any;
  while (step) {
    step = nextStep(step, mode, context);
    if (step) steps.push(step);
  }
  return steps;
}

describe("onboarding steps", () => {
  it("walks a new user through species and look, skipping painting without a photo", () => {
    expect(walk("first", { hasName: false, hasPhoto: false })).toEqual(["welcome", "species", "photo", "look", "name", "meet", "firstStep"]);
    expect(walk("first", { hasName: false, hasPhoto: true })).toEqual(["welcome", "species", "photo", "look", "name", "painting", "meet", "firstStep"]);
    expect(visibleSteps("first")).not.toContain("painting");
  });

  it("the adopt track skips the photo and the look editor for a shelter pick", () => {
    expect(walk("first", { hasName: false, hasPhoto: false, track: "adopt" })).toEqual(["welcome", "species", "shelter", "name", "meet", "firstStep"]);
    expect(visibleSteps("first", "adopt")).toEqual(["welcome", "species", "shelter", "name", "meet", "firstStep"]);
    expect(previousStep("shelter", "first", "adopt")).toBe("species");
    expect(previousStep("name", "first", "adopt")).toBe("shelter");
    expect(previousStep("name", "first", "own")).toBe("look");
    // the track only exists on the first run
    expect(nextStep("species", "look", { hasName: true, hasPhoto: false, track: "adopt" })).toBe("look");
  });

  it("keeps the new-photo flow short and the look flow shorter", () => {
    expect(walk("replace", { hasName: true, hasPhoto: true })).toEqual(["photo", "painting", "meet"]);
    expect(nextStep("photo", "replace", { hasName: true, hasPhoto: false })).toBeNull();
    expect(walk("look", { hasName: true, hasPhoto: false })).toEqual(["species", "look"]);
  });

  it("only allows going back before anything is committed", () => {
    expect(previousStep("species", "first")).toBe("welcome");
    expect(previousStep("species", "look")).toBeNull();
    expect(previousStep("look", "first")).toBe("photo");
    expect(previousStep("look", "look")).toBe("species");
    expect(previousStep("photo", "first")).toBe("species");
    expect(previousStep("photo", "replace")).toBeNull();
    expect(previousStep("name", "first")).toBe("look");
    expect(previousStep("painting", "first")).toBeNull();
    expect(previousStep("meet", "first")).toBeNull();
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
