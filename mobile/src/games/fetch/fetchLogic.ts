// Pure rules for Fetch: throw a ball, the pet runs for it, brings it back.
// Everything here is unit-testable; the screen only animates what these functions decide.

export type Point = { x: number; y: number };

export type Field = {
  width: number;
  height: number;
  /** the band of ground the ball may land on (y grows downwards) */
  groundTop: number;
  groundBottom: number;
  /** horizontal margin so the ball never lands under the HUD or off-screen */
  sideMargin: number;
};

export type Throw = {
  /** where the ball lands */
  landing: Point;
  /** how long the ball is in the air, ms */
  flightMs: number;
  /** peak height of the arc above the straight line, px */
  arcHeight: number;
  /** 0..1 of the field width */
  distanceRatio: number;
  points: number;
  longThrow: boolean;
};

export const FETCH_ROUND_MS = 60_000;
export const FETCH_MAX_THROWS = 8;
const MIN_SPEED = 260; // px/s: a tiny flick still counts as a throw
const MAX_SPEED = 1500;
const MIN_DRAG = 12; // px: below this it was a tap, not a throw

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Turns a drag gesture (displacement over time) into a throw. A gesture shorter than MIN_DRAG is not a
 * throw (returns null). Speed is clamped so the ball always lands inside the ground band.
 */
export function computeThrow(from: Point, dx: number, dy: number, dtMs: number, field: Field): Throw | null {
  const drag = Math.hypot(dx, dy);
  if (!Number.isFinite(drag) || drag < MIN_DRAG) return null;
  const dt = Math.max(16, Number.isFinite(dtMs) ? dtMs : 16) / 1000;
  const rawSpeed = drag / dt;
  const speed = clamp(rawSpeed, MIN_SPEED, MAX_SPEED);
  const ux = dx / drag;
  const uy = dy / drag;
  // flight time grows with speed, so a hard flick travels further as well as faster
  const flightSec = clamp(0.45 + speed / 1500, 0.5, 1.4);
  const travel = speed * flightSec * 0.55;
  const minX = field.sideMargin;
  const maxX = field.width - field.sideMargin;
  const landing = {
    x: clamp(from.x + ux * travel, minX, maxX),
    y: clamp(from.y + uy * travel * 0.35, field.groundTop, field.groundBottom),
  };
  const distance = Math.hypot(landing.x - from.x, landing.y - from.y);
  const distanceRatio = clamp(distance / Math.max(1, field.width), 0, 1);
  const longThrow = distanceRatio >= 0.55;
  return {
    landing,
    flightMs: Math.round(flightSec * 1000),
    arcHeight: clamp(distance * 0.28, 24, 160),
    distanceRatio,
    points: longThrow ? 2 : 1,
    longThrow,
  };
}

/** How long the pet takes to run a distance, ms; never so fast it teleports, never so slow it drags. */
export function runDurationMs(distancePx: number): number {
  const d = Math.max(0, Number.isFinite(distancePx) ? distancePx : 0);
  return Math.round(clamp(d / 0.32, 380, 1500));
}

export type FetchRound = {
  score: number;
  throws: number;
  fetches: number;
  longThrows: number;
  startedAt: number;
  endedAt: number | null;
};

export function newRound(now: number): FetchRound {
  return { score: 0, throws: 0, fetches: 0, longThrows: 0, startedAt: now, endedAt: null };
}

export function canThrow(round: FetchRound, now: number): boolean {
  if (round.endedAt != null) return false;
  if (round.throws >= FETCH_MAX_THROWS) return false;
  return now - round.startedAt < FETCH_ROUND_MS;
}

export function recordThrow(round: FetchRound, t: Throw): FetchRound {
  return { ...round, throws: round.throws + 1, longThrows: round.longThrows + (t.longThrow ? 1 : 0) };
}

/** Called when the pet has brought the ball back: the fetch counts. */
export function recordFetch(round: FetchRound, t: Throw, now: number): FetchRound {
  const next = { ...round, fetches: round.fetches + 1, score: round.score + t.points };
  const outOfThrows = next.throws >= FETCH_MAX_THROWS;
  const outOfTime = now - next.startedAt >= FETCH_ROUND_MS;
  return outOfThrows || outOfTime ? { ...next, endedAt: now } : next;
}

export function endRound(round: FetchRound, now: number): FetchRound {
  return round.endedAt == null ? { ...round, endedAt: now } : round;
}

export function secondsLeft(round: FetchRound, now: number): number {
  return Math.max(0, Math.ceil((FETCH_ROUND_MS - (now - round.startedAt)) / 1000));
}

/** A line for the end card; varies with how the round went. */
export function fetchSummary(round: FetchRound, petName: string): string {
  if (round.fetches === 0) return `${petName} waited by the ball. Next time, give it a proper flick.`;
  if (round.longThrows >= 3) return `${petName} chased ${round.fetches} throws, ${round.longThrows} of them long ones. Tired and happy.`;
  if (round.fetches >= FETCH_MAX_THROWS) return `${petName} brought every single ball back. Best day ever.`;
  return `${petName} fetched ${round.fetches} ${round.fetches === 1 ? "time" : "times"} and would happily go again.`;
}
