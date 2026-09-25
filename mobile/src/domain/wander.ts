// Where the pet ambles next in its garden. Pure so the timing and bounds can be tested; the stage
// animates the result. Offsets are in pixels relative to the pet's home ground point.

export type WanderBounds = {
  /** furthest the pet may stand to the left of home (negative or zero) */
  min: number;
  /** furthest to the right of home (positive or zero) */
  max: number;
  /** a step shorter than this is not worth the walk */
  minStep: number;
};

export type WanderPlan = {
  target: number;
  facing: "left" | "right";
  /** how long the walk takes, in ms, at a small-pet pace */
  duration: number;
};

/** Picks the next spot: a real step (at least minStep) that stays inside the bounds, drifting home now and then. */
export function nextWanderTarget(current: number, bounds: WanderBounds, random: () => number = Math.random): WanderPlan | null {
  const min = Math.min(0, bounds.min);
  const max = Math.max(0, bounds.max);
  const span = max - min;
  if (span < bounds.minStep * 2) return null;

  // a third of the time the pet heads back towards home; otherwise anywhere in range
  const homeward = random() < 0.34 && Math.abs(current) > bounds.minStep;
  let target: number;
  if (homeward) {
    target = current > 0 ? Math.max(0, current - bounds.minStep - random() * bounds.minStep * 2) : Math.min(0, current + bounds.minStep + random() * bounds.minStep * 2);
  } else {
    target = min + random() * span;
    if (Math.abs(target - current) < bounds.minStep) {
      target = current + (target >= current ? bounds.minStep : -bounds.minStep);
    }
  }
  target = Math.max(min, Math.min(max, Math.round(target)));
  if (Math.abs(target - current) < bounds.minStep) return null;

  const distance = Math.abs(target - current);
  return {
    target,
    facing: target < current ? "left" : "right",
    duration: Math.round(Math.max(900, Math.min(4200, distance * 22))),
  };
}

/** Pause between walks: long and irregular, so the pet mostly just lives there. */
export function wanderDelay(random: () => number = Math.random): number {
  return Math.round(14000 + random() * 26000);
}
