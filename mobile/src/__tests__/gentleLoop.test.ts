import { HIBERNATION_DAYS, daysBefore, nextLastSeen, returnGreeting, returnStatus } from "../domain/hibernation";
import { ENERGY_WORDS, REFLECTION_PROMPTS, reflectionPrompt } from "../domain/reflection";

describe("returnStatus", () => {
  const today = "2026-09-25";
  it("recognises a first visit, the same day, a short gap and hibernation", () => {
    expect(returnStatus(null, today)).toEqual({ kind: "first" });
    expect(returnStatus("junk", today)).toEqual({ kind: "first" });
    expect(returnStatus(today, today)).toEqual({ kind: "same-day" });
    expect(returnStatus(daysBefore(today, 1), today)).toEqual({ kind: "back", daysAway: 1 });
    expect(returnStatus(daysBefore(today, HIBERNATION_DAYS - 1), today)).toEqual({ kind: "back", daysAway: 4 });
    expect(returnStatus(daysBefore(today, HIBERNATION_DAYS), today)).toEqual({ kind: "hibernation", daysAway: 5 });
    expect(returnStatus(daysBefore(today, 40), today)).toEqual({ kind: "hibernation", daysAway: 40 });
  });

  it("greets without guilt and only when it matters", () => {
    expect(returnGreeting({ kind: "same-day" }, "Biscuit")).toBeNull();
    expect(returnGreeting({ kind: "back", daysAway: 1 }, "Biscuit")).toBeNull();
    expect(returnGreeting({ kind: "back", daysAway: 3 }, "Biscuit")?.subtitle).toContain("Biscuit");
    const back = returnGreeting({ kind: "hibernation", daysAway: 12 }, "Biscuit")!;
    expect(back.title).toBe("You're back!");
    expect(back.subtitle).not.toMatch(/streak|missed \d|lost/);
  });

  it("moves last-seen forward only", () => {
    expect(nextLastSeen(null, today)).toBe(today);
    expect(nextLastSeen("2026-09-20", today)).toBe(today);
    expect(nextLastSeen("2026-09-30", today)).toBe("2026-09-30");
  });
});

describe("reflectionPrompt", () => {
  it("is stable for a day and varies across days", () => {
    expect(reflectionPrompt("2026-09-25")).toBe(reflectionPrompt("2026-09-25"));
    const week = Array.from({ length: 7 }, (_, i) => reflectionPrompt(daysBefore("2026-09-25", i)));
    expect(new Set(week).size).toBe(7);
    expect(REFLECTION_PROMPTS).toContain(reflectionPrompt("2026-01-01"));
    expect(REFLECTION_PROMPTS).toContain(reflectionPrompt("not a date"));
    expect(ENERGY_WORDS[1]).toBe("Exhausted");
    expect(ENERGY_WORDS[5]).toBe("Energized");
  });
});
