import { addDaysToDateKey, getISOWeekKey, getLocalDateKey, parseDateKey } from "../utils/dateKeys";

describe("getLocalDateKey", () => {
  it("formats a local calendar date as YYYY-MM-DD with zero padding", () => {
    expect(getLocalDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(getLocalDateKey(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31");
  });

  it("uses the local calendar day, not the UTC day", () => {
    // 00:30 local on the 2nd is still the 2nd regardless of UTC offset.
    expect(getLocalDateKey(new Date(2026, 6, 2, 0, 30))).toBe("2026-07-02");
  });
});

describe("parseDateKey", () => {
  it("parses a valid key to local midnight", () => {
    const parsed = parseDateKey("2026-03-08");
    expect(parsed).not.toBeNull();
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(2);
    expect(parsed!.getDate()).toBe(8);
    expect(parsed!.getHours()).toBe(0);
  });

  it("rejects malformed keys and impossible dates", () => {
    expect(parseDateKey("2026-3-8")).toBeNull();
    expect(parseDateKey("20260308")).toBeNull();
    expect(parseDateKey("2026-02-30")).toBeNull();
    expect(parseDateKey("2025-02-29")).toBeNull();
    expect(parseDateKey("")).toBeNull();
  });

  it("accepts leap days", () => {
    expect(parseDateKey("2024-02-29")?.getDate()).toBe(29);
  });
});

describe("addDaysToDateKey", () => {
  it("crosses month, year, and leap boundaries", () => {
    expect(addDaysToDateKey("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysToDateKey("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDaysToDateKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("is stable across the spring-forward and fall-back days", () => {
    // US DST 2026: starts Mar 8, ends Nov 1. Calendar arithmetic must be unaffected.
    expect(addDaysToDateKey("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysToDateKey("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDaysToDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateKey("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDaysToDateKey("2026-03-08", -7)).toBe("2026-03-01");
  });

  it("returns the input unchanged when it is not a date key", () => {
    expect(addDaysToDateKey("not-a-date", 3)).toBe("not-a-date");
  });
});

describe("getISOWeekKey", () => {
  it("matches the ISO-8601 week definition at year boundaries", () => {
    // 2026-01-01 is a Thursday, so it belongs to week 1 of 2026.
    expect(getISOWeekKey("2026-01-01")).toBe("2026-W01");
    // The Monday before it is also 2026-W01.
    expect(getISOWeekKey("2025-12-29")).toBe("2026-W01");
    // 2025-01-01 is a Wednesday: week 1 of 2025 starts on Monday 2024-12-30.
    expect(getISOWeekKey("2024-12-30")).toBe("2025-W01");
    // 2021-01-03 is a Sunday that still belongs to 2020's week 53.
    expect(getISOWeekKey("2021-01-03")).toBe("2020-W53");
    expect(getISOWeekKey("2021-01-04")).toBe("2021-W01");
  });

  it("is correct in the middle of the year, including weeks inside daylight-saving time", () => {
    // In 2026 every Thursday's day-of-year is congruent to 1 mod 7, which makes
    // local-time millisecond arithmetic across a DST shift land one week early.
    expect(getISOWeekKey("2026-03-09")).toBe("2026-W11"); // Monday after US spring-forward
    expect(getISOWeekKey("2026-07-02")).toBe("2026-W27"); // Thursday, deep in DST
    expect(getISOWeekKey("2026-09-16")).toBe("2026-W38");
    expect(getISOWeekKey("2026-11-02")).toBe("2026-W45"); // Monday after fall-back
  });

  it("accepts Date instances and treats them by local calendar date", () => {
    expect(getISOWeekKey(new Date(2026, 8, 16, 23, 30))).toBe("2026-W38");
  });

  it("falls back to 1970-W01 for unparseable input", () => {
    expect(getISOWeekKey("garbage")).toBe("1970-W01");
  });
});
