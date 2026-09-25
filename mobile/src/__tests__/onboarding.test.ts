import { firstStepFor, nextStep, paintingLine, previousStep, validatePetName, visibleSteps } from "../domain/onboarding";

describe("onboarding steps", () => {
  it("walks a new user welcome -> photo -> name -> painting -> meet -> first step", () => {
    const steps: string[] = [firstStepFor("first")];
    let step = steps[0] as any;
    while (step) {
      step = nextStep(step, "first", { hasName: false });
      if (step) steps.push(step);
    }
    expect(steps).toEqual(["welcome", "photo", "name", "painting", "meet", "firstStep"]);
    expect(visibleSteps("first")).toEqual(steps);
  });

  it("keeps the replace flow short and skips naming when the pet already has a name", () => {
    expect(firstStepFor("replace")).toBe("photo");
    expect(nextStep("photo", "replace", { hasName: true })).toBe("painting");
    expect(nextStep("photo", "replace", { hasName: false })).toBe("name");
    expect(nextStep("meet", "replace", { hasName: true })).toBeNull();
  });

  it("only allows going back before the photo is committed", () => {
    expect(previousStep("photo", "first")).toBe("welcome");
    expect(previousStep("photo", "replace")).toBeNull();
    expect(previousStep("name", "first")).toBe("photo");
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
