import {
  FETCH_MAX_THROWS,
  FETCH_ROUND_MS,
  canThrow,
  computeThrow,
  fetchSummary,
  newRound,
  recordFetch,
  recordThrow,
  runDurationMs,
  secondsLeft,
} from "../games/fetch/fetchLogic";
import {
  BUBBLES_ROUND_MS,
  bubblesSecondsLeft,
  bubblesSummary,
  endBubblesRound,
  isRoundOver,
  newBubblesRound,
  nextSpawnDelayMs,
  popPoints,
  recordMiss,
  recordPop,
  riseDurationMs,
  shouldCheer,
  spawnBubble,
} from "../games/bubbles/bubbleLogic";
import { applySession, isPlayTask, normalizePlayStats, playTaskTitle } from "../games/playStatsLogic";

const field = { width: 390, height: 600, groundTop: 300, groundBottom: 520, sideMargin: 30 };
const from = { x: 120, y: 480 };

describe("fetch: computeThrow", () => {
  it("ignores taps and tiny nudges", () => {
    expect(computeThrow(from, 3, -2, 40, field)).toBeNull();
    expect(computeThrow(from, Number.NaN, 0, 40, field)).toBeNull();
  });

  it("throws further and longer for a faster flick, always landing on the ground band", () => {
    const soft = computeThrow(from, 40, -30, 200, field)!;
    const hard = computeThrow(from, 200, -120, 60, field)!;
    expect(hard.landing.x).toBeGreaterThan(soft.landing.x);
    expect(hard.flightMs).toBeGreaterThan(soft.flightMs);
    for (const t of [soft, hard]) {
      expect(t.landing.x).toBeGreaterThanOrEqual(field.sideMargin);
      expect(t.landing.x).toBeLessThanOrEqual(field.width - field.sideMargin);
      expect(t.landing.y).toBeGreaterThanOrEqual(field.groundTop);
      expect(t.landing.y).toBeLessThanOrEqual(field.groundBottom);
    }
  });

  it("scores long throws double", () => {
    const hard = computeThrow(from, 260, -60, 30, field)!;
    expect(hard.longThrow).toBe(true);
    expect(hard.points).toBe(2);
    const soft = computeThrow(from, 30, -5, 400, field)!;
    expect(soft.longThrow).toBe(false);
    expect(soft.points).toBe(1);
  });

  it("caps the run speed so the pet neither teleports nor crawls", () => {
    expect(runDurationMs(0)).toBe(380);
    expect(runDurationMs(160)).toBe(500);
    expect(runDurationMs(10_000)).toBe(1500);
  });
});

describe("fetch: round", () => {
  it("ends after the last throw is fetched or when time runs out", () => {
    let round = newRound(1000);
    const t = computeThrow(from, 200, -80, 60, field)!;
    expect(canThrow(round, 1000)).toBe(true);
    for (let i = 0; i < FETCH_MAX_THROWS; i++) {
      round = recordThrow(round, t);
      round = recordFetch(round, t, 2000 + i);
    }
    expect(round.fetches).toBe(FETCH_MAX_THROWS);
    expect(round.endedAt).not.toBeNull();
    expect(canThrow(round, 3000)).toBe(false);

    const late = newRound(0);
    expect(canThrow(late, FETCH_ROUND_MS + 1)).toBe(false);
    expect(secondsLeft(late, 0)).toBe(60);
    expect(secondsLeft(late, FETCH_ROUND_MS + 5000)).toBe(0);
  });

  it("summaries mention the pet and the outcome", () => {
    expect(fetchSummary(newRound(0), "Biscuit")).toContain("Biscuit");
    const t = computeThrow(from, 260, -60, 30, field)!;
    let round = newRound(0);
    for (let i = 0; i < 3; i++) round = recordFetch(recordThrow(round, t), t, 10);
    expect(fetchSummary(round, "Biscuit")).toMatch(/long/);
  });
});

describe("bubbles", () => {
  it("spawns faster as the round goes on", () => {
    expect(nextSpawnDelayMs(0)).toBe(950);
    expect(nextSpawnDelayMs(BUBBLES_ROUND_MS)).toBe(420);
    expect(nextSpawnDelayMs(BUBBLES_ROUND_MS / 2)).toBeLessThan(950);
    expect(nextSpawnDelayMs(-100)).toBe(950);
  });

  it("makes bubbles inside the field with sensible sizes and speeds", () => {
    for (const r of [0, 0.1, 0.33, 0.5, 0.77, 0.999]) {
      const b = spawnBubble(1, r, 0);
      expect(b.xRatio).toBeGreaterThanOrEqual(0.1);
      expect(b.xRatio).toBeLessThanOrEqual(0.9);
      expect(b.size).toBeGreaterThanOrEqual(38);
      expect(b.size).toBeLessThanOrEqual(66);
      expect(b.speed).toBeGreaterThanOrEqual(55);
      expect(b.speed).toBeLessThanOrEqual(125);
      expect(riseDurationMs(b, 500)).toBeGreaterThan(3000);
    }
    expect(spawnBubble(1, 0.4, 0)).toEqual(spawnBubble(1, 0.4, 0));
  });

  it("scores small bubbles higher and gives a streak bonus every five pops", () => {
    const small = { ...spawnBubble(1, 0, 0), size: 40 };
    const big = { ...spawnBubble(2, 0, 0), size: 64 };
    expect(popPoints(small, 1)).toBe(2);
    expect(popPoints(big, 1)).toBe(1);
    expect(popPoints(big, 5)).toBe(4);
    expect(shouldCheer(5)).toBe(true);
    expect(shouldCheer(6)).toBe(false);
  });

  it("tracks pops, misses and streaks, and ends on time", () => {
    let round = newBubblesRound(0);
    const b = { ...spawnBubble(1, 0, 0), size: 64 };
    for (let i = 0; i < 6; i++) round = recordPop(round, b);
    expect(round.popped).toBe(6);
    expect(round.bestStreak).toBe(6);
    round = recordMiss(round);
    expect(round.streak).toBe(0);
    expect(round.missed).toBe(1);
    expect(isRoundOver(round, 1000)).toBe(false);
    expect(isRoundOver(round, BUBBLES_ROUND_MS)).toBe(true);
    round = endBubblesRound(round, 5000);
    expect(recordPop(round, b)).toBe(round);
    expect(bubblesSecondsLeft(newBubblesRound(0), 12_000)).toBe(18);
    expect(bubblesSummary(round, "Biscuit")).toContain("Biscuit");
  });
});

describe("play stats", () => {
  it("normalises corrupt storage and forgets yesterday's session count", () => {
    const stats = normalizePlayStats({ best: { fetch: "7", bubbles: -3 }, sessions: "2", lastPlayedDay: "2026-09-23", sessionsToday: 4 }, "2026-09-24");
    expect(stats).toEqual({ best: { fetch: 7 }, sessions: 2, lastPlayedDay: "2026-09-23", sessionsToday: 0 });
    expect(normalizePlayStats(null, "2026-09-24").best).toEqual({});
  });

  it("applies a session and reports a beaten best", () => {
    const start = normalizePlayStats(null, "2026-09-24");
    const first = applySession(start, "fetch", 5, "2026-09-24");
    expect(first.bestBeaten).toBe(true);
    expect(first.stats.sessionsToday).toBe(1);
    const second = applySession(first.stats, "fetch", 3, "2026-09-24");
    expect(second.bestBeaten).toBe(false);
    expect(second.stats.best.fetch).toBe(5);
    expect(second.stats.sessionsToday).toBe(2);
    const tomorrow = applySession(second.stats, "bubbles", 9, "2026-09-25");
    expect(tomorrow.stats.sessionsToday).toBe(1);
    expect(tomorrow.stats.best).toEqual({ fetch: 5, bubbles: 9 });
  });

  it("recognises the play task by title", () => {
    expect(playTaskTitle("Biscuit")).toBe("Play with Biscuit");
    expect(isPlayTask("play with Mochi")).toBe(true);
    expect(isPlayTask("Drink water")).toBe(false);
  });
});
