import {
  MEMORIAL_REFLECTIONS,
  addMemory,
  makeMemorial,
  memorialGreeting,
  memorialPrompt,
  memorialReflection,
  milestones,
  normalizeMemorial,
  normalizeMemories,
  removeMemory,
} from "../domain/memorial";

describe("memorial state", () => {
  it("normalises and rejects junk", () => {
    expect(normalizeMemorial(null)).toBeNull();
    expect(normalizeMemorial({ since: "nope" })).toBeNull();
    expect(normalizeMemorial({ since: "2026-09-20", note: "  best boy  " })).toEqual({ since: "2026-09-20", note: "best boy" });
    expect(normalizeMemorial({ since: "2026-09-20", note: "" })).toEqual({ since: "2026-09-20", note: null });
  });

  it("never sets a future date and trims the note", () => {
    expect(makeMemorial("2030-01-01", null, "2026-09-25")).toEqual({ since: "2026-09-25", note: null });
    expect(makeMemorial("2026-09-01", "x".repeat(400), "2026-09-25").note).toHaveLength(280);
    expect(makeMemorial(undefined, undefined, "2026-09-25").since).toBe("2026-09-25");
  });
});

describe("memories", () => {
  it("adds newest first, drops empties and duplicates, removes by id", () => {
    let list = addMemory([], "  The way he sighed when he lay down.  ", "2026-09-25", "a");
    list = addMemory(list, "", "2026-09-25", "b");
    list = addMemory(list, "First walk in the snow.", "2026-09-26", "c");
    expect(list.map((m) => m.id)).toEqual(["c", "a"]);
    expect(list[1].text).toBe("The way he sighed when he lay down.");
    expect(normalizeMemories([{ id: "a", date: "2026-09-25", text: "x" }, { id: "a", date: "2026-09-25", text: "y" }, { id: "z", date: "bad", text: "q" }])).toHaveLength(1);
    expect(removeMemory(list, "a").map((m) => m.id)).toEqual(["c"]);
  });
});

describe("copy", () => {
  it("rotates reflections by day and stays gentle", () => {
    expect(MEMORIAL_REFLECTIONS).toContain(memorialReflection("2026-09-25"));
    const week = new Set(Array.from({ length: 7 }, (_, i) => memorialReflection(`2026-09-${String(20 + i).padStart(2, "0")}`)));
    expect(week.size).toBe(7);
    for (const line of MEMORIAL_REFLECTIONS) expect(line).not.toMatch(/streak|task|points|should/i);
    expect(memorialGreeting("Biscuit").title).toBe("Remembering Biscuit");
    expect(memorialPrompt("Biscuit")).toContain("Biscuit");
  });

  it("lists only milestones with data", () => {
    const lines = milestones({ petName: "Biscuit", togetherSince: "2026-09-01T10:00:00Z", memorialSince: "2026-09-25", plantsGrown: 3, gamesPlayed: 0, checkins: 12, tasksCompleted: 40 });
    expect(lines[0]).toBe("25 days together in Luna");
    expect(lines).toHaveLength(4);
    expect(lines.some((l) => l.includes("games"))).toBe(false);
    expect(milestones({ petName: "B", memorialSince: "2026-09-25" })).toEqual([]);
  });
});
