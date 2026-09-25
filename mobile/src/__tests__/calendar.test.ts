import { monthGrid, monthKey, shiftMonth } from "../domain/calendar";

describe("monthGrid", () => {
  it("lays September 2026 out Monday-first with leading and trailing days", () => {
    const weeks = monthGrid(2026, 8);
    expect(weeks).toHaveLength(5);
    expect(weeks[0].map((c) => c.day)).toEqual([31, 1, 2, 3, 4, 5, 6]);
    expect(weeks[0][0]).toEqual({ date: "2026-08-31", inMonth: false, day: 31 });
    expect(weeks[4].map((c) => c.day)).toEqual([28, 29, 30, 1, 2, 3, 4]);
    expect(weeks[4][3].inMonth).toBe(false);
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(30);
  });

  it("handles a month starting on Monday and a six-week month", () => {
    const june = monthGrid(2026, 5); // 1 June 2026 is a Monday
    expect(june[0][0]).toEqual({ date: "2026-06-01", inMonth: true, day: 1 });
    const august = monthGrid(2026, 7); // 1 Aug 2026 is a Saturday -> 6 rows
    expect(august).toHaveLength(6);
    expect(august.flat()).toHaveLength(42);
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(monthKey(2026, 8)).toBe("2026-09");
  });
});
