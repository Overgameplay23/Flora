import { getTaskPoints } from "../domain/taskPoints";

describe("getTaskPoints", () => {
  it("prefers an explicit points value, rounded and floored at 1", () => {
    expect(getTaskPoints({ points: 5 })).toBe(5);
    expect(getTaskPoints({ points: 2.4 })).toBe(2);
    expect(getTaskPoints({ points: 2.5 })).toBe(3);
    expect(getTaskPoints({ points: 0 })).toBe(1);
    expect(getTaskPoints({ points: -4 })).toBe(1);
  });

  it("falls back to the keyword heuristic when points are missing or not numeric", () => {
    expect(getTaskPoints({ title: "Drink water" })).toBe(2);
    expect(getTaskPoints({ title: "Deep work block", points: null })).toBe(3);
    expect(getTaskPoints({ title: "Stretch", difficulty: "HARD" })).toBe(3);
    expect(getTaskPoints({ title: "Walk", category: "outside" })).toBe(3);
    expect(getTaskPoints({ title: "Walk", type: "focus session" })).toBe(3);
    expect(getTaskPoints({ title: "Read", points: Number.NaN })).toBe(2);
  });

  it("treats blank strings as absent", () => {
    expect(getTaskPoints({ title: "   ", difficulty: "" })).toBe(2);
  });
});
