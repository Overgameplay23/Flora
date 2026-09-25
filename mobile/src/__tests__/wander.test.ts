import { nextWanderTarget, wanderDelay } from "../domain/wander";

const bounds = { min: -80, max: 60, minStep: 18 };

function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("nextWanderTarget", () => {
  it("stays inside the bounds and always takes a real step", () => {
    for (let n = 0; n < 500; n += 1) {
      const current = Math.round(-80 + Math.random() * 140);
      const plan = nextWanderTarget(current, bounds);
      if (!plan) continue;
      expect(plan.target).toBeGreaterThanOrEqual(bounds.min);
      expect(plan.target).toBeLessThanOrEqual(bounds.max);
      expect(Math.abs(plan.target - current)).toBeGreaterThanOrEqual(bounds.minStep);
      expect(plan.facing).toBe(plan.target < current ? "left" : "right");
      expect(plan.duration).toBeGreaterThanOrEqual(900);
      expect(plan.duration).toBeLessThanOrEqual(4200);
    }
  });

  it("heads home a third of the time", () => {
    const plan = nextWanderTarget(50, bounds, seq([0.1, 0.5]));
    expect(plan).not.toBeNull();
    expect(plan!.target).toBeLessThan(50);
    expect(plan!.target).toBeGreaterThanOrEqual(0);
    expect(plan!.facing).toBe("left");
  });

  it("gives up when there is no room to walk", () => {
    expect(nextWanderTarget(0, { min: -10, max: 10, minStep: 18 })).toBeNull();
  });

  it("waits a long, irregular while between walks", () => {
    expect(wanderDelay(() => 0)).toBe(14000);
    expect(wanderDelay(() => 1)).toBe(40000);
  });
});
