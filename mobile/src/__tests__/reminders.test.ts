import { DEFAULT_REMINDERS, buildReminderPlan, formatTime, normalizeReminderSettings, remindersSummary } from "../domain/reminders";

const on = { ...DEFAULT_REMINDERS, enabled: true };
const TODAY = "2026-09-25"; // Friday
const NOON = new Date(2026, 8, 25, 12, 0, 0);

describe("reminder settings", () => {
  it("are off until opted in, and clamp junk times", () => {
    expect(normalizeReminderSettings(null).enabled).toBe(false);
    expect(normalizeReminderSettings({ enabled: true, morning: { enabled: true, time: { hour: 99, minute: 0 } } }).morning.time).toEqual({ hour: 8, minute: 30 });
    expect(normalizeReminderSettings({ enabled: true, evening: { enabled: false, time: { hour: 21, minute: 0 } } }).evening).toEqual({ enabled: false, time: { hour: 21, minute: 0 } });
    expect(formatTime({ hour: 8, minute: 5 })).toBe("08:05");
  });

  it("summarises in words", () => {
    expect(remindersSummary(DEFAULT_REMINDERS)).toBe("Off");
    expect(remindersSummary(on)).toBe("Morning 08:30 · Evening 20:30 · Sunday recap");
    expect(remindersSummary({ ...on, morning: { ...on.morning, enabled: false }, weekly: { ...on.weekly, enabled: false } })).toBe("Evening 20:30");
  });
});

describe("buildReminderPlan", () => {
  it("plans a week ahead in the pet's voice, only in the future", () => {
    const plan = buildReminderPlan(on, { petName: "Biscuit", species: "dog", today: TODAY, now: NOON, days: 7 });
    // today: evening only (the morning has passed); then 6 full days; one Sunday recap
    const kinds = plan.map((p) => p.kind);
    expect(kinds.filter((k) => k === "morning")).toHaveLength(6);
    expect(kinds.filter((k) => k === "evening")).toHaveLength(7);
    expect(kinds.filter((k) => k === "weekly")).toHaveLength(1);
    expect(plan[0].kind).toBe("evening");
    expect(plan[0].fireAt.getHours()).toBe(20);
    expect(plan.every((p) => p.fireAt > NOON)).toBe(true);
    expect(plan.every((p) => p.title === "Biscuit")).toBe(true);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    const sunday = plan.find((p) => p.kind === "weekly")!;
    expect(sunday.fireAt.getDay()).toBe(0);
    expect(sunday.body).toContain("put together your week");
  });

  it("skips tonight when the person already checked in, and varies the copy by day", () => {
    const plan = buildReminderPlan(on, { petName: "Biscuit", today: TODAY, now: NOON, days: 3, checkedInToday: true });
    expect(plan.find((p) => p.id === "evening:2026-09-25")).toBeUndefined();
    expect(plan.find((p) => p.id === "evening:2026-09-26")).toBeDefined();
    const mornings = plan.filter((p) => p.kind === "morning").map((p) => p.body);
    expect(new Set(mornings).size).toBe(mornings.length);
  });

  it("speaks from the window for cats and says nothing during a memorial or when off", () => {
    const cat = buildReminderPlan(on, { petName: "Mochi", species: "cat", today: TODAY, now: NOON, days: 7 });
    expect(cat.some((p) => /sill|window|sunbeam/.test(p.body))).toBe(true);
    expect(cat.some((p) => /garden/.test(p.body))).toBe(false);
    expect(buildReminderPlan(on, { petName: "Mochi", today: TODAY, now: NOON, memorial: true })).toEqual([]);
    expect(buildReminderPlan(DEFAULT_REMINDERS, { petName: "Mochi", today: TODAY, now: NOON })).toEqual([]);
  });
});
