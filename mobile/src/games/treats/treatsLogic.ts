// Treat Catch: treats fall from the top of the lawn and the person slides the pet left and right along the
// ground to catch them (docs/ROADMAP.md, Play). Forty-five seconds; there is no way to lose, a missed treat
// just floats off. Pure rules, no timers or gestures; the screen animates what these decide.

export const TREATS_ROUND_MS = 45_000;
export const TREAT_SIZE = 34;
/** how far (px) a treat may land from the pet's centre and still be caught, as a share of the pet's width */
export const CATCH_RADIUS_RATIO = 0.55;
export const GOLDEN_SHARE = 0.15;

export type TreatKind = "biscuit" | "golden";

export type Treat = {
  id: number;
  /** 0..1 of the field width */
  xRatio: number;
  kind: TreatKind;
  /** time to fall from the top to the ground, ms */
  fallMs: number;
  spawnedAt: number;
};

export type TreatsRound = {
  startedAt: number;
  score: number;
  caught: number;
  missed: number;
  golden: number;
  streak: number;
  bestStreak: number;
  endedAt: number | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const frac = (v: number) => v - Math.floor(v);

export function newTreatsRound(now: number): TreatsRound {
  return { startedAt: now, score: 0, caught: 0, missed: 0, golden: 0, streak: 0, bestStreak: 0, endedAt: null };
}

/** Treats come a little faster as the round goes on: about every 1.1 s at the start, every 0.65 s at the end. */
export function nextTreatDelayMs(elapsedMs: number): number {
  const t = clamp((Number.isFinite(elapsedMs) ? elapsedMs : 0) / TREATS_ROUND_MS, 0, 1);
  return Math.round(1100 - 450 * t);
}

/** How long a treat takes to fall; quicker later in the round. */
export function fallDurationMs(elapsedMs: number): number {
  const t = clamp((Number.isFinite(elapsedMs) ? elapsedMs : 0) / TREATS_ROUND_MS, 0, 1);
  return Math.round(2800 - 1000 * t);
}

/** One treat from one random number in [0, 1): where it falls, whether it is golden, how fast. */
export function spawnTreat(id: number, random: number, elapsedMs: number, now: number): Treat {
  const r = clamp(Number.isFinite(random) ? random : 0, 0, 0.999999);
  const xRatio = 0.12 + frac(r * 13.37) * 0.76;
  const kind: TreatKind = frac(r * 31.7) < GOLDEN_SHARE ? "golden" : "biscuit";
  return { id, xRatio, kind, fallMs: fallDurationMs(elapsedMs), spawnedAt: now };
}

export function treatPoints(kind: TreatKind): number {
  return kind === "golden" ? 3 : 1;
}

/** Where the pet may stand: inside the side margins. */
export function clampPetX(x: number, fieldWidth: number, margin: number): number {
  const lo = margin;
  const hi = Math.max(margin, fieldWidth - margin);
  return clamp(Number.isFinite(x) ? x : lo, lo, hi);
}

/** Caught when the treat lands within the catch radius of the pet's centre. */
export function isCaught(treatX: number, petX: number, catchRadius: number): boolean {
  return Math.abs(treatX - petX) <= Math.max(0, catchRadius);
}

export function recordCatch(round: TreatsRound, treat: Treat): TreatsRound {
  if (round.endedAt != null) return round;
  const streak = round.streak + 1;
  return {
    ...round,
    score: round.score + treatPoints(treat.kind),
    caught: round.caught + 1,
    golden: round.golden + (treat.kind === "golden" ? 1 : 0),
    streak,
    bestStreak: Math.max(round.bestStreak, streak),
  };
}

/** A missed treat floats off: nothing is taken away, the streak just starts over. */
export function recordTreatMiss(round: TreatsRound): TreatsRound {
  if (round.endedAt != null) return round;
  return { ...round, missed: round.missed + 1, streak: 0 };
}

export function shouldCheerTreats(streak: number): boolean {
  return streak > 0 && streak % 5 === 0;
}

export function treatsSecondsLeft(round: TreatsRound, now: number): number {
  return Math.max(0, Math.ceil((TREATS_ROUND_MS - (now - round.startedAt)) / 1000));
}

export function isTreatsOver(round: TreatsRound, now: number): boolean {
  return round.endedAt != null || now - round.startedAt >= TREATS_ROUND_MS;
}

export function endTreatsRound(round: TreatsRound, now: number): TreatsRound {
  return round.endedAt != null ? round : { ...round, endedAt: now };
}

export function treatsSummary(round: TreatsRound, petName: string): string {
  if (round.caught === 0) return `${petName} watched the treats land and ate them off the grass. No harm done.`;
  if (round.golden >= 3) return `${round.caught} treats, ${round.golden} of them golden. ${petName} is beside themselves.`;
  if (round.bestStreak >= 10) return `${round.caught} treats and a run of ${round.bestStreak} in a row. ${petName} could not be happier.`;
  if (round.missed === 0) return `Every single treat caught. ${petName} is in awe of you.`;
  return `${round.caught} ${round.caught === 1 ? "treat" : "treats"} caught. ${petName} is full and happy.`;
}
