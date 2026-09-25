// Pure exports of the daily-loop and task-completion services. The Supabase
// client and native modules are mocked so no network or device APIs are touched.
jest.mock("../lib/supabase", () => ({ supabase: {} }));
jest.mock("../services/habitsService", () => ({
  DEFAULT_HABITS: ["Drink water", "Move your body", "Fresh air break", "Kind message", "Tidy a corner"],
  getHabits: jest.fn(async () => []),
}));
jest.mock("../services/retention", () => ({
  logTaskCreated: jest.fn(async () => undefined),
  logTaskCompleted: jest.fn(async () => undefined),
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("@react-native-community/netinfo", () => require("@react-native-community/netinfo/jest/netinfo-mock.js"));

import { DAILY_LOOP_CONSTANTS, determinePetMood, isDayComplete, todayKey, yesterdayKey } from "../services/dailyLoop";
import { utcDateKey } from "../services/taskCompletion";

describe("determinePetMood", () => {
  it("is neutral when there is no mood score", () => {
    expect(determinePetMood(null, 1)).toBe("neutral");
    expect(determinePetMood(Number.NaN, 0)).toBe("neutral");
  });

  it("is happy on a high mood or a high completion rate", () => {
    expect(determinePetMood(4, 0)).toBe("happy");
    expect(determinePetMood(5, 0.1)).toBe("happy");
    expect(determinePetMood(1, 0.75)).toBe("happy");
  });

  it("is sad only when the mood is low AND completion is low (protected behaviour)", () => {
    expect(determinePetMood(2, 0.34)).toBe("sad");
    expect(determinePetMood(1, 0)).toBe("sad");
    expect(determinePetMood(2, 0.35)).toBe("neutral");
    expect(determinePetMood(3, 0)).toBe("neutral");
  });
});

describe("isDayComplete", () => {
  const habits = (completed: number) =>
    Array.from({ length: 5 }, (_, i) => ({ id: i + 1, title: `h${i}`, active: true, completed: i < completed }));

  it("requires a check-in and at least the configured number of completed habits", () => {
    expect(DAILY_LOOP_CONSTANTS.HABIT_COMPLETION_THRESHOLD).toBe(2);
    const checkIn = { date: "2026-09-16", mood_score: 3 };
    expect(isDayComplete(checkIn, habits(2))).toBe(true);
    expect(isDayComplete(checkIn, habits(1))).toBe(false);
    expect(isDayComplete(null, habits(5))).toBe(false);
  });
});

describe("date keys used by the loop", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("todayKey uses the local calendar date", () => {
    expect(todayKey(new Date(2026, 2, 1, 0, 5))).toBe("2026-03-01");
  });

  it("yesterdayKey steps back one local day across month boundaries", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 2, 1, 12, 0));
    expect(yesterdayKey()).toBe("2026-02-28");
  });

  it("utcDateKey uses the UTC calendar date (the task and retention day basis)", () => {
    expect(utcDateKey(new Date(Date.UTC(2026, 6, 2, 0, 30)))).toBe("2026-07-02");
    expect(utcDateKey(new Date(Date.UTC(2026, 6, 1, 23, 30)))).toBe("2026-07-01");
  });
});
