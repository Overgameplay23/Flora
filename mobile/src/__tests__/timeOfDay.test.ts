import { dayPhase, phaseGreeting, phaseWash, showStars } from "../domain/timeOfDay";

describe("dayPhase", () => {
  it("splits the day into gentle phases and wraps odd hours", () => {
    expect(dayPhase(5)).toBe("dawn");
    expect(dayPhase(8)).toBe("morning");
    expect(dayPhase(13)).toBe("day");
    expect(dayPhase(18)).toBe("golden");
    expect(dayPhase(20)).toBe("dusk");
    expect(dayPhase(23)).toBe("night");
    expect(dayPhase(2)).toBe("night");
    expect(dayPhase(25)).toBe("night");
    expect(dayPhase(Number.NaN)).toBe("day");
  });

  it("darkens at night and keeps the day almost untouched", () => {
    expect(phaseWash("night")).toContain("0.42");
    expect(phaseWash("day")).toContain("0.14");
    expect(showStars("night")).toBe(true);
    expect(showStars("morning")).toBe(false);
    expect(phaseGreeting("morning")).toBe("Good morning");
  });
});
