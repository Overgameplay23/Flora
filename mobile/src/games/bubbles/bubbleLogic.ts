// Pure rules for Bubbles: bubbles drift up through the garden, tap them before they float away.

export const BUBBLES_ROUND_MS = 30_000;
const SPAWN_START_MS = 950;
const SPAWN_END_MS = 420;
const MIN_SIZE = 38;
const MAX_SIZE = 66;
const MIN_SPEED = 55; // px/s
const MAX_SPEED = 125;

export type Bubble = {
  id: number;
  /** 0..1 across the field */
  xRatio: number;
  size: number;
  /** px per second upwards */
  speed: number;
  /** slight sideways drift, px over the whole rise */
  drift: number;
  spawnedAt: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Delay before the next bubble; the round gets busier as it goes on. */
export function nextSpawnDelayMs(elapsedMs: number): number {
  const t = clamp(elapsedMs / BUBBLES_ROUND_MS, 0, 1);
  return Math.round(SPAWN_START_MS + (SPAWN_END_MS - SPAWN_START_MS) * t);
}

/**
 * Creates a bubble from a random number in [0, 1). Deterministic for a given random value so tests can
 * pin it down; the screen passes Math.random().
 */
export function spawnBubble(id: number, random: number, now: number): Bubble {
  const r = clamp(Number.isFinite(random) ? random : 0.5, 0, 0.999999);
  // spread three independent-ish values out of one number
  const a = r;
  const b = (r * 7919) % 1;
  const c = (r * 104729) % 1;
  return {
    id,
    xRatio: 0.1 + a * 0.8,
    size: Math.round(MIN_SIZE + b * (MAX_SIZE - MIN_SIZE)),
    speed: Math.round(MIN_SPEED + (1 - b) * (MAX_SPEED - MIN_SPEED)), // small bubbles rise faster
    drift: Math.round((c - 0.5) * 80),
    spawnedAt: now,
  };
}

/** ms for a bubble to cross the field from below the bottom edge to above the top edge. */
export function riseDurationMs(bubble: Bubble, fieldHeight: number): number {
  const travel = Math.max(1, fieldHeight + bubble.size * 2);
  return Math.round((travel / Math.max(1, bubble.speed)) * 1000);
}

export type BubblesRound = {
  score: number;
  popped: number;
  missed: number;
  /** consecutive pops without a miss */
  streak: number;
  bestStreak: number;
  startedAt: number;
  endedAt: number | null;
};

export function newBubblesRound(now: number): BubblesRound {
  return { score: 0, popped: 0, missed: 0, streak: 0, bestStreak: 0, startedAt: now, endedAt: null };
}

/** Points for a pop: small bubbles are worth more, and every fifth pop in a row is a bonus. */
export function popPoints(bubble: Bubble, streakAfterPop: number): number {
  const sizeBonus = bubble.size <= MIN_SIZE + (MAX_SIZE - MIN_SIZE) * 0.35 ? 2 : 1;
  return sizeBonus + (streakAfterPop > 0 && streakAfterPop % 5 === 0 ? 3 : 0);
}

export function recordPop(round: BubblesRound, bubble: Bubble): BubblesRound {
  if (round.endedAt != null) return round;
  const streak = round.streak + 1;
  return {
    ...round,
    popped: round.popped + 1,
    streak,
    bestStreak: Math.max(round.bestStreak, streak),
    score: round.score + popPoints(bubble, streak),
  };
}

export function recordMiss(round: BubblesRound): BubblesRound {
  if (round.endedAt != null) return round;
  return { ...round, missed: round.missed + 1, streak: 0 };
}

export function isRoundOver(round: BubblesRound, now: number): boolean {
  return round.endedAt != null || now - round.startedAt >= BUBBLES_ROUND_MS;
}

export function endBubblesRound(round: BubblesRound, now: number): BubblesRound {
  return round.endedAt == null ? { ...round, endedAt: now } : round;
}

export function bubblesSecondsLeft(round: BubblesRound, now: number): number {
  return Math.max(0, Math.ceil((BUBBLES_ROUND_MS - (now - round.startedAt)) / 1000));
}

/** The pet cheers on every fifth pop in a row. */
export function shouldCheer(streak: number): boolean {
  return streak > 0 && streak % 5 === 0;
}

export function bubblesSummary(round: BubblesRound, petName: string): string {
  if (round.popped === 0) return `${petName} watched the bubbles drift away. They were pretty, to be fair.`;
  if (round.bestStreak >= 10) return `${round.popped} bubbles, a streak of ${round.bestStreak}. ${petName} could not stop bouncing.`;
  if (round.missed === 0) return `Every bubble popped. ${petName} is very impressed.`;
  return `${round.popped} popped, ${round.missed} floated off. ${petName} had a lovely time.`;
}
