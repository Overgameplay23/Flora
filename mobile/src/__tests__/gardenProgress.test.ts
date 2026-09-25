import { getNextUnlockProgress, getRequiredPointsForNextUnlock } from "../domain/gardenProgress";

describe("getRequiredPointsForNextUnlock", () => {
  it("escalates by 3 points per unlocked item from a base of 6", () => {
    expect(getRequiredPointsForNextUnlock(0)).toBe(6);
    expect(getRequiredPointsForNextUnlock(1)).toBe(9);
    expect(getRequiredPointsForNextUnlock(4)).toBe(18);
  });

  it("uses an explicit requirement from the item when present (snake or camel case)", () => {
    expect(getRequiredPointsForNextUnlock(3, { required_points: 20 })).toBe(20);
    expect(getRequiredPointsForNextUnlock(3, { requiredPoints: 7.9 })).toBe(7);
    expect(getRequiredPointsForNextUnlock(3, { required_points: 0 })).toBe(1);
  });

  it("ignores non-finite or negative unlocked counts", () => {
    expect(getRequiredPointsForNextUnlock(Number.NaN)).toBe(6);
    expect(getRequiredPointsForNextUnlock(-3)).toBe(6);
    expect(getRequiredPointsForNextUnlock(2.9, null)).toBe(12);
  });
});

describe("getNextUnlockProgress", () => {
  it("reports remaining points and readiness", () => {
    expect(getNextUnlockProgress({ earnedPoints: 5, requiredPoints: 9 })).toEqual({
      earnedPoints: 5,
      requiredPoints: 9,
      remaining: 4,
      isReady: false,
    });
    expect(getNextUnlockProgress({ earnedPoints: 9, requiredPoints: 9 }).isReady).toBe(true);
    expect(getNextUnlockProgress({ earnedPoints: 12, requiredPoints: 9 }).remaining).toBe(0);
  });

  it("clamps invalid inputs instead of producing NaN", () => {
    expect(getNextUnlockProgress({ earnedPoints: Number.NaN, requiredPoints: 0 })).toEqual({
      earnedPoints: 0,
      requiredPoints: 1,
      remaining: 1,
      isReady: false,
    });
    expect(getNextUnlockProgress({ earnedPoints: -2, requiredPoints: 3.7 }).requiredPoints).toBe(3);
  });
});
