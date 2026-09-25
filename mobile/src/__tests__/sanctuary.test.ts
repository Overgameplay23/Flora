import { sanctuaryCopy, sanctuaryFor, stageWord } from "../domain/sanctuary";

describe("sanctuary", () => {
  it("cats live in the window nook, everyone else in the garden", () => {
    expect(sanctuaryFor("cat")).toBe("nook");
    expect(sanctuaryFor("Cat")).toBe("nook");
    expect(sanctuaryFor("dog")).toBe("garden");
    expect(sanctuaryFor(null)).toBe("garden");
    expect(sanctuaryFor(undefined)).toBe("garden");
  });

  it("keeps one voice per place", () => {
    expect(sanctuaryCopy("nook").calmLine("Mochi")).toBe("Mochi is calm, watching the window.");
    expect(sanctuaryCopy("garden").calmLine("Biscuit")).toBe("Biscuit is calm, watching the garden.");
    expect(sanctuaryCopy("nook").plantVerb).toBe("Pot");
    expect(sanctuaryCopy("garden").tabTitle).toBe("Your garden");
  });

  it("names the growth stages", () => {
    expect(stageWord(null, "garden")).toBe("Not planted yet");
    expect(stageWord(null, "nook")).toBe("Not potted yet");
    expect(stageWord("seed", "garden")).toBe("Just planted");
    expect(stageWord("bloom", "nook")).toBe("In bloom");
  });
});
