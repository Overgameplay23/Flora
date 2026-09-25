import { actForTask, celebrationLine, moodSentence, petMoodFromStores } from "../domain/petMood";

describe("actForTask", () => {
  it("maps task titles to something the pet can act out", () => {
    expect(actForTask("Drink water")).toBe("drink");
    expect(actForTask("Go outside / get sunlight")).toBe("walk");
    expect(actForTask("Took a slow breath")).toBe("breathe");
    expect(actForTask("Evening wind-down")).toBe("sleep");
    expect(actForTask("10-minute focus session")).toBe("stretch");
    expect(actForTask(null)).toBe("stretch");
  });

  it("matches whole words where the rule says so", () => {
    expect(actForTask("Cup of tea")).toBe("drink");
    expect(actForTask("Go to bed early")).toBe("sleep");
    expect(actForTask("Rest for ten minutes")).toBe("sleep");
    expect(actForTask("Take a nap")).toBe("sleep");
    expect(actForTask("Go for a run")).toBe("walk");
    expect(actForTask("Steady heartbeat")).toBe("stretch"); // "eat" inside "heartbeat" is not a meal
  });
});

describe("petMoodFromStores", () => {
  it("mirrors the live check-in slider first", () => {
    expect(petMoodFromStores({ liveState: "sad", dailyMood: "happy", hour: 12 })).toBe("sad");
    expect(petMoodFromStores({ liveState: "excited", dailyMood: "sad", hour: 23 })).toBe("excited");
    expect(petMoodFromStores({ liveState: "happy", dailyMood: null, hour: 3 })).toBe("happy");
  });

  it("falls back to the daily mood store, with sad winning over the clock", () => {
    expect(petMoodFromStores({ dailyMood: "sad", hour: 23 })).toBe("sad");
    expect(petMoodFromStores({ dailyMood: "happy", hour: 14 })).toBe("happy");
    expect(petMoodFromStores({ dailyMood: "neutral", hour: 14 })).toBe("calm");
    expect(petMoodFromStores({})).toBe("calm");
  });

  it("gets sleepy late at night unless something stronger is going on", () => {
    expect(petMoodFromStores({ dailyMood: "happy", hour: 22 })).toBe("sleepy");
    expect(petMoodFromStores({ dailyMood: null, hour: 5 })).toBe("sleepy");
    expect(petMoodFromStores({ dailyMood: null, hour: 6 })).toBe("calm");
    expect(petMoodFromStores({ liveState: "calm", dailyMood: null, hour: 23 })).toBe("sleepy");
  });
});

describe("copy helpers", () => {
  it("uses the pet's name", () => {
    expect(moodSentence("sad", "Biscuit")).toContain("Biscuit");
    expect(celebrationLine("Biscuit", 2, 7)).toMatch(/Biscuit|\+2/);
  });

  it("varies by seed and stays deterministic", () => {
    const a = celebrationLine("Biscuit", 2, 0);
    const b = celebrationLine("Biscuit", 2, 1);
    expect(a).not.toBe(b);
    expect(celebrationLine("Biscuit", 2, 5)).toBe(celebrationLine("Biscuit", 2, 5));
    expect(celebrationLine("Biscuit", 0, 3)).not.toContain("+0");
  });
});
