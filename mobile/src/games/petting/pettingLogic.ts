// "Pet the pet": one calm minute of slow strokes (docs/ROADMAP.md, Play: "Pet the Pet (calm, haptic,
// breathing-paced)"). Pure rules, no timers or gestures here. Slow, steady strokes fill the pet's contentment;
// frantic rubbing barely counts; stopping lets it ease back a little, but never below the last quarter
// reached. There is no way to lose: the round ends when the pet is fully content or the minute is up.

export const PETTING_ROUND_MS = 60_000;
export const CALM_TARGET = 100;
/** a stroke this soon after the last one is frantic and counts for little */
export const FRANTIC_MS = 220;
/** strokes between these are the slow, steady rhythm the pet loves */
export const STEADY_MIN_MS = 400;
export const STEADY_MAX_MS = 1600;
/** idle this long before contentment starts easing back */
export const IDLE_MS = 2500;
/** contentment eases back this much per second while idle */
export const DECAY_PER_SECOND = 2;

export type PettingRound = {
  startedAt: number;
  /** 0-100 */
  calm: number;
  strokes: number;
  /** steady strokes in a row, now and at best */
  flow: number;
  longestFlow: number;
  lastStrokeAt: number | null;
  /** quarters of contentment reached (25, 50, 75, 100): each one is a purr */
  quartersReached: number;
  endedAt: number | null;
};

export function newPettingRound(now: number): PettingRound {
  return { startedAt: now, calm: 0, strokes: 0, flow: 0, longestFlow: 0, lastStrokeAt: null, quartersReached: 0, endedAt: null };
}

/** How much one stroke adds, from the gap since the last one. */
export function strokeGain(msSinceLast: number | null): number {
  if (msSinceLast == null) return 4;
  if (msSinceLast < FRANTIC_MS) return 1;
  if (msSinceLast <= STEADY_MAX_MS && msSinceLast >= STEADY_MIN_MS) return 6;
  return 3;
}

export function isSteady(msSinceLast: number | null): boolean {
  return msSinceLast != null && msSinceLast >= STEADY_MIN_MS && msSinceLast <= STEADY_MAX_MS;
}

function quartersOf(calm: number): number {
  return Math.min(4, Math.floor(calm / 25));
}

/** One stroke lands. `purr` is true when a new quarter of contentment was reached. */
export function recordStroke(round: PettingRound, now: number): { round: PettingRound; purr: boolean; gain: number } {
  if (round.endedAt != null) return { round, purr: false, gain: 0 };
  const since = round.lastStrokeAt == null ? null : now - round.lastStrokeAt;
  const gain = strokeGain(since);
  const calm = Math.min(CALM_TARGET, round.calm + gain);
  const flow = isSteady(since) ? round.flow + 1 : since != null && since < FRANTIC_MS ? 0 : round.flow;
  const quarters = quartersOf(calm);
  const purr = quarters > round.quartersReached;
  return {
    gain,
    purr,
    round: {
      ...round,
      calm,
      strokes: round.strokes + 1,
      flow,
      longestFlow: Math.max(round.longestFlow, flow),
      lastStrokeAt: now,
      quartersReached: Math.max(round.quartersReached, quarters),
    },
  };
}

/** Time passing without a stroke: contentment eases back a little, never below the last quarter reached. */
export function easeCalm(round: PettingRound, now: number, lastTickAt: number): PettingRound {
  if (round.endedAt != null || round.lastStrokeAt == null) return round;
  if (now - round.lastStrokeAt < IDLE_MS) return round;
  const seconds = Math.max(0, now - Math.max(lastTickAt, round.lastStrokeAt + IDLE_MS)) / 1000;
  if (seconds <= 0) return round;
  const floor = round.quartersReached * 25;
  const calm = Math.max(floor, round.calm - seconds * DECAY_PER_SECOND);
  return calm === round.calm ? round : { ...round, calm };
}

export function pettingSecondsLeft(round: PettingRound, now: number): number {
  return Math.max(0, Math.ceil((PETTING_ROUND_MS - (now - round.startedAt)) / 1000));
}

export function isPettingOver(round: PettingRound, now: number): boolean {
  return round.endedAt != null || round.calm >= CALM_TARGET || now - round.startedAt >= PETTING_ROUND_MS;
}

export function endPettingRound(round: PettingRound, now: number): PettingRound {
  return round.endedAt != null ? round : { ...round, endedAt: now };
}

/** Contentment plus a little for a steady rhythm; 0-125. */
export function pettingScore(round: PettingRound): number {
  return Math.round(round.calm) + Math.min(25, round.longestFlow);
}

/** How the pet carries itself as it fills up. */
export function pettingMood(calm: number): "calm" | "happy" | "sleepy" {
  if (calm >= 85) return "sleepy";
  if (calm >= 30) return "happy";
  return "calm";
}

export function pettingSummary(round: PettingRound, petName: string): string {
  if (round.strokes === 0) return `${petName} sat with you anyway. That counts as company.`;
  if (round.calm >= CALM_TARGET) return `${petName} melted into a puddle of content. Slow hands, happy pet.`;
  if (round.longestFlow >= 12) return `${petName} loved that rhythm. ${Math.round(round.calm)}% content and half asleep.`;
  if (round.calm >= 50) return `${petName} leaned right into your hand. ${Math.round(round.calm)}% content.`;
  return `${petName} liked that. Slower strokes next time, and they'll melt.`;
}
