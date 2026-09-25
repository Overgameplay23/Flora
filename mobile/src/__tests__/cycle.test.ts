import {
  EMPTY_CYCLE_DATA,
  averageCycleLength,
  averagePeriodLength,
  cycleStatus,
  daysBetween,
  isPeriodDay,
  logPeriodDay,
  normalizeCycleData,
  phaseLine,
  predictedPeriodDays,
  unlogPeriodDay,
  upsertDayLog,
} from "../domain/cycle";

const data = normalizeCycleData({
  entries: [
    { start: "2026-06-03", end: "2026-06-07" },
    { start: "2026-07-01", end: "2026-07-05" },
    { start: "2026-07-30", end: "2026-08-03" },
    { start: "2026-08-28", end: "2026-09-01" },
  ],
});

describe("cycle data", () => {
  it("normalises, sorts and merges overlapping entries and drops junk", () => {
    const messy = normalizeCycleData({
      entries: [
        { start: "2026-08-05", end: "2026-08-07" },
        { start: "2026-08-03", end: "2026-08-05" },
        { start: "not a date" },
        { start: "2026-09-01", end: "2026-08-20" },
      ],
      days: [{ date: "2026-08-04", flow: "heavy", symptoms: ["cramps", 5] }, { date: "2026-08-04", flow: "light" }, { date: "bad" }],
    });
    expect(messy.entries).toEqual([
      { start: "2026-08-03", end: "2026-08-07" },
      { start: "2026-09-01", end: null },
    ]);
    expect(messy.days).toEqual([{ date: "2026-08-04", flow: "heavy", symptoms: ["cramps"], note: null }]);
  });

  it("computes averages with bounds", () => {
    expect(daysBetween("2026-08-28", "2026-09-01")).toBe(4);
    expect(averageCycleLength(data.entries)).toEqual({ days: 29, sample: 3 });
    expect(averagePeriodLength(data.entries)).toBe(5);
    expect(averageCycleLength([])).toEqual({ days: 28, sample: 0 });
    expect(averagePeriodLength([{ start: "2026-01-01", end: null }])).toBe(5);
  });
});

describe("cycleStatus", () => {
  it("knows the phase and the next period from the history", () => {
    const onPeriod = cycleStatus(data, "2026-08-30");
    expect(onPeriod.phase).toBe("period");
    expect(onPeriod.cycleDay).toBe(3);
    expect(onPeriod.nextPeriodStart).toBe("2026-09-26");

    const mid = cycleStatus(data, "2026-09-12");
    expect(mid.phase).toBe("fertile");
    expect(mid.fertileWindow).toEqual({ start: "2026-09-06", end: "2026-09-12" });

    const late = cycleStatus(data, "2026-09-20");
    expect(late.phase).toBe("luteal");
    expect(late.daysUntilNextPeriod).toBe(6);

    const overdue = cycleStatus(data, "2026-09-29");
    expect(overdue.phase).toBe("late");
    expect(overdue.daysUntilNextPeriod).toBe(-3);
  });

  it("handles no data and an ongoing period", () => {
    expect(cycleStatus(EMPTY_CYCLE_DATA, "2026-09-24").phase).toBe("unknown");
    const ongoing = normalizeCycleData({ entries: [{ start: "2026-09-22", end: null }] });
    const status = cycleStatus(ongoing, "2026-09-24");
    expect(status.phase).toBe("period");
    expect(status.ongoing).toEqual({ start: "2026-09-22", end: null });
    expect(status.cycleLength).toBe(28);
  });
});

describe("logging days", () => {
  it("starts a new period, extends it on adjacent days and removes days cleanly", () => {
    let d = logPeriodDay(EMPTY_CYCLE_DATA, "2026-09-20");
    expect(d.entries).toEqual([{ start: "2026-09-20", end: "2026-09-20" }]);
    d = logPeriodDay(d, "2026-09-21");
    d = logPeriodDay(d, "2026-09-22");
    expect(d.entries).toEqual([{ start: "2026-09-20", end: "2026-09-22" }]);
    d = logPeriodDay(d, "2026-09-19");
    expect(d.entries[0].start).toBe("2026-09-19");
    expect(isPeriodDay(d, "2026-09-21")).toBe(true);
    expect(isPeriodDay(d, "2026-09-25")).toBe(false);

    d = unlogPeriodDay(d, "2026-09-21");
    expect(d.entries).toEqual([
      { start: "2026-09-19", end: "2026-09-20" },
      { start: "2026-09-22", end: "2026-09-22" },
    ]);
    d = unlogPeriodDay(d, "2026-09-22");
    expect(d.entries).toEqual([{ start: "2026-09-19", end: "2026-09-20" }]);

    const far = logPeriodDay(d, "2026-10-18");
    expect(far.entries).toHaveLength(2);
  });

  it("stores and clears day logs", () => {
    let d = upsertDayLog(EMPTY_CYCLE_DATA, { date: "2026-09-24", flow: "medium", symptoms: ["cramps"] });
    expect(d.days).toEqual([{ date: "2026-09-24", flow: "medium", symptoms: ["cramps"], note: null }]);
    d = upsertDayLog(d, { date: "2026-09-24", flow: null, symptoms: [] });
    expect(d.days).toEqual([]);
  });

  it("predicts period days for the calendar", () => {
    const predicted = predictedPeriodDays(data, "2026-09-10", 2);
    expect(predicted.has("2026-09-26")).toBe(true);
    expect(predicted.has("2026-09-30")).toBe(true);
    expect(predicted.has("2026-10-01")).toBe(false);
    expect(predicted.has("2026-10-25")).toBe(true);
    expect(predictedPeriodDays(EMPTY_CYCLE_DATA, "2026-09-10").size).toBe(0);
  });

  it("speaks gently through the pet", () => {
    expect(phaseLine(cycleStatus(data, "2026-08-30"), "Biscuit")).toContain("Biscuit");
    expect(phaseLine(cycleStatus(EMPTY_CYCLE_DATA, "2026-08-30"), "")).toContain("Your pet");
    expect(phaseLine(cycleStatus(data, "2026-09-24"), "Biscuit")).toMatch(/expected in about 2 days/);
  });
});
