import { isRecord, safeJsonParse } from "../utils/guards";

describe("isRecord", () => {
  it("accepts plain objects only", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON and reports failures without throwing", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(safeJsonParse("  [1,2]  ")).toEqual({ ok: true, value: [1, 2] });
    expect(safeJsonParse("nope")).toEqual({ ok: false, value: null });
    expect(safeJsonParse("")).toEqual({ ok: false, value: null });
    expect(safeJsonParse(42 as unknown as string)).toEqual({ ok: false, value: null });
  });
});
