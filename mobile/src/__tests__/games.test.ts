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

// ---------- pet the pet ----------
import {
  CALM_TARGET,
  FRANTIC_MS,
  IDLE_MS,
  PETTING_ROUND_MS,
  easeCalm,
  endPettingRound,
  isPettingOver,
  newPettingRound,
  pettingMood,
  pettingScore,
  pettingSecondsLeft,
  pettingSummary,
  recordStroke,
  strokeGain,
} from "../games/petting/pettingLogic";
import { GAME_IDS } from "../games/playStatsLogic";

describe("pet the pet", () => {
  it("rewards slow, steady strokes and barely counts frantic ones", () => {
    expect(strokeGain(null)).toBe(4);
    expect(strokeGain(100)).toBe(1);
    expect(strokeGain(800)).toBe(6);
    expect(strokeGain(3000)).toBe(3);
    let round = newPettingRound(0);
    let t = 0;
    for (let i = 0; i < 10; i++) {
      t += 700;
      round = recordStroke(round, t).round;
    }
    expect(round.strokes).toBe(10);
    expect(round.longestFlow).toBe(9);
    expect(round.calm).toBe(4 + 9 * 6);
    const frantic = recordStroke(round, t + FRANTIC_MS - 50);
    expect(frantic.gain).toBe(1);
    expect(frantic.round.flow).toBe(0);
  });

  it("purrs at each quarter, fills to full, and cannot be lost", () => {
    let round = newPettingRound(0);
    let purrs = 0;
    let t = 0;
    while (!isPettingOver(round, t)) {
      t += 600;
      const result = recordStroke(round, t);
      round = result.round;
      if (result.purr) purrs += 1;
    }
    expect(round.calm).toBe(CALM_TARGET);
    expect(purrs).toBe(4);
    expect(round.quartersReached).toBe(4);
    expect(pettingMood(round.calm)).toBe("sleepy");
    expect(pettingMood(10)).toBe("calm");
    expect(pettingMood(50)).toBe("happy");
    expect(pettingScore(round)).toBeGreaterThanOrEqual(100);
    expect(pettingSummary(round, "Maple")).toMatch(/Maple/);
    const ended = endPettingRound(round, t);
    expect(recordStroke(ended, t + 700).gain).toBe(0);
  });

  it("eases back while idle, never below the last quarter reached", () => {
    let round = newPettingRound(0);
    let t = 0;
    for (let i = 0; i < 6; i++) {
      t += 700;
      round = recordStroke(round, t).round;
    }
    expect(round.calm).toBe(34);
    expect(round.quartersReached).toBe(1);
    // nothing happens before the idle grace
    expect(easeCalm(round, t + IDLE_MS - 100, t)).toBe(round);
    const later = easeCalm(round, t + IDLE_MS + 2000, t + IDLE_MS);
    expect(later.calm).toBeCloseTo(30, 5);
    const muchLater = easeCalm(later, t + IDLE_MS + 60_000, t + IDLE_MS + 2000);
    expect(muchLater.calm).toBe(25);
  });

  it("runs for a minute at most and knows its game id", () => {
    const round = newPettingRound(1000);
    expect(pettingSecondsLeft(round, 1000)).toBe(60);
    expect(isPettingOver(round, 1000 + PETTING_ROUND_MS)).toBe(true);
    expect(isPettingOver(round, 1000 + PETTING_ROUND_MS - 1)).toBe(false);
    expect(pettingSummary(round, "Maple")).toMatch(/company/);
    expect(GAME_IDS).toContain("petting");
    const stats = applySession(normalizePlayStats(null, "2026-10-16"), "petting", 88, "2026-10-16");
    expect(stats.stats.best.petting).toBe(88);
    expect(normalizePlayStats({ best: { petting: 12 } }, "2026-10-16").best.petting).toBe(12);
  });
});

// ---------- treat catch ----------
import {
  CATCH_RADIUS_RATIO,
  GOLDEN_SHARE,
  TREATS_ROUND_MS,
  clampPetX,
  endTreatsRound,
  fallDurationMs,
  isCaught,
  isTreatsOver,
  newTreatsRound,
  nextTreatDelayMs,
  recordCatch,
  recordTreatMiss,
  shouldCheerTreats,
  spawnTreat,
  treatPoints,
  treatsSecondsLeft,
  treatsSummary,
} from "../games/treats/treatsLogic";

describe("treat catch", () => {
  it("spawns treats inside the lawn, about one in seven golden, faster as the round goes on", () => {
    let golden = 0;
    for (let i = 0; i < 400; i++) {
      const treat = spawnTreat(i, i / 400, 0, 1000);
      expect(treat.xRatio).toBeGreaterThanOrEqual(0.12);
      expect(treat.xRatio).toBeLessThanOrEqual(0.88);
      if (treat.kind === "golden") golden += 1;
    }
    expect(golden / 400).toBeGreaterThan(GOLDEN_SHARE - 0.06);
    expect(golden / 400).toBeLessThan(GOLDEN_SHARE + 0.06);
    expect(spawnTreat(1, 0.3, 0, 0)).toEqual(spawnTreat(1, 0.3, 0, 0));
    expect(nextTreatDelayMs(0)).toBe(1100);
    expect(nextTreatDelayMs(TREATS_ROUND_MS)).toBe(650);
    expect(nextTreatDelayMs(TREATS_ROUND_MS * 5)).toBe(650);
    expect(fallDurationMs(0)).toBe(2800);
    expect(fallDurationMs(TREATS_ROUND_MS)).toBe(1800);
    expect(spawnTreat(2, Number.NaN, Number.NaN, 0).xRatio).toBeGreaterThanOrEqual(0.12);
  });

  it("keeps the pet inside the margins and catches within the radius", () => {
    expect(clampPetX(-50, 390, 44)).toBe(44);
    expect(clampPetX(1000, 390, 44)).toBe(346);
    expect(clampPetX(200, 390, 44)).toBe(200);
    expect(clampPetX(Number.NaN, 390, 44)).toBe(44);
    expect(CATCH_RADIUS_RATIO).toBeGreaterThan(0);
    expect(isCaught(200, 299, 99)).toBe(true);
    expect(isCaught(200, 101, 99)).toBe(true);
    expect(isCaught(200, 300, 99)).toBe(false);
    expect(isCaught(200, 100, 99)).toBe(false);
    expect(isCaught(10, 300, -5)).toBe(false);
  });

  it("scores catches (golden triple), never punishes a miss, and cheers every fifth in a row", () => {
    let round = newTreatsRound(0);
    const biscuit = spawnTreat(1, 0.5, 0, 0);
    const golden = { ...spawnTreat(2, 0.5, 0, 0), kind: "golden" as const };
    expect(treatPoints("biscuit")).toBe(1);
    expect(treatPoints("golden")).toBe(3);
    for (let i = 0; i < 4; i++) round = recordCatch(round, biscuit);
    round = recordCatch(round, golden);
    expect(round.score).toBe(7);
    expect(round.caught).toBe(5);
    expect(round.golden).toBe(1);
    expect(round.streak).toBe(5);
    expect(shouldCheerTreats(round.streak)).toBe(true);
    round = recordTreatMiss(round);
    expect(round.score).toBe(7);
    expect(round.missed).toBe(1);
    expect(round.streak).toBe(0);
    expect(round.bestStreak).toBe(5);
    expect(shouldCheerTreats(0)).toBe(false);
    const ended = endTreatsRound(round, 10);
    expect(recordCatch(ended, biscuit)).toBe(ended);
    expect(recordTreatMiss(ended)).toBe(ended);
  });

  it("runs forty-five seconds and tells the round's story", () => {
    const round = newTreatsRound(1000);
    expect(treatsSecondsLeft(round, 1000)).toBe(45);
    expect(isTreatsOver(round, 1000 + TREATS_ROUND_MS - 1)).toBe(false);
    expect(isTreatsOver(round, 1000 + TREATS_ROUND_MS)).toBe(true);
    expect(treatsSummary(round, "Maple")).toMatch(/Maple/);
    let perfect = newTreatsRound(0);
    for (let i = 0; i < 6; i++) perfect = recordCatch(perfect, spawnTreat(i, 0.5, 0, 0));
    expect(treatsSummary(perfect, "Maple")).toMatch(/Every single treat/);
    const partial = recordTreatMiss(recordCatch(newTreatsRound(0), spawnTreat(0, 0.5, 0, 0)));
    expect(treatsSummary(partial, "Maple")).toMatch(/^1 treat caught./);
    expect(treatsSummary(partial, "Maple")).not.toMatch(/floated|missed/);
    expect(GAME_IDS).toContain("treats");
    expect(normalizePlayStats({ best: { treats: 9 } }, "2026-10-16").best.treats).toBe(9);
  });
});

// ---------- memory match ----------
import {
  BOARD_PAIRS,
  MEMORY_FACES,
  MEMORY_TOTAL_PAIRS,
  dealBoard,
  endMemoryRound,
  flipCard,
  hideMismatch,
  isBoardCleared,
  isMemoryComplete,
  memoryFace,
  memoryLayout,
  memoryScore,
  memorySummary,
  newMemoryRound,
  nextBoard,
  shuffle,
  type MemoryRound,
} from "../games/memory/memoryLogic";

/** a small seeded generator so deals are repeatable */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** the index of the other card with the same face */
function partnerOf(round: MemoryRound, index: number) {
  return round.cards.findIndex((card, i) => i !== index && card.face === round.cards[index].face);
}

/** an index pair whose faces differ */
function mismatchedPair(round: MemoryRound): [number, number] {
  const first = round.cards.findIndex((card) => !card.matched);
  const second = round.cards.findIndex((card, i) => i !== first && !card.matched && card.face !== round.cards[first].face);
  return [first, second];
}

/** clear the current board pair by pair, straight from the answer key */
function clearBoard(round: MemoryRound) {
  let next = round;
  const events: string[] = [];
  for (let i = 0; i < next.cards.length; i++) {
    if (next.cards[i].matched) continue;
    next = flipCard(next, i).round;
    const result = flipCard(next, partnerOf(next, i));
    next = result.round;
    events.push(result.event);
  }
  return { round: next, events };
}

describe("memory match", () => {
  it("deals pairs of care glyphs, a different layout each time, every face a real category glyph", () => {
    const cards = dealBoard(6, seeded(1));
    expect(cards).toHaveLength(12);
    const counts = new Map<string, number>();
    for (const card of cards) counts.set(card.face, (counts.get(card.face) ?? 0) + 1);
    expect(counts.size).toBe(6);
    for (const n of counts.values()) expect(n).toBe(2);
    expect(new Set(cards.map((card) => card.key)).size).toBe(12);
    expect(cards.every((card) => !card.matched && !card.seen)).toBe(true);
    expect(dealBoard(6, seeded(1))).toEqual(cards);
    expect(dealBoard(6, seeded(2)).map((card) => card.face)).not.toEqual(cards.map((card) => card.face));
    for (const face of MEMORY_FACES) {
      expect(face.icon).toMatch(/-outline$/);
      expect(face.category).not.toBe("cycle");
    }
    expect(new Set(MEMORY_FACES.map((face) => face.category)).size).toBe(MEMORY_FACES.length);
    expect(memoryFace("nope")).toBe(MEMORY_FACES[0]);
    // a bad random source still deals a full board
    expect(dealBoard(4, () => Number.NaN)).toHaveLength(8);
    expect(dealBoard(99, seeded(3))).toHaveLength(MEMORY_FACES.length * 2);
    expect(shuffle([1, 2, 3, 4], seeded(5)).sort()).toEqual([1, 2, 3, 4]);
  });

  it("keeps a pair face up and turns two different cards back without counting anything", () => {
    let round = newMemoryRound(0, seeded(7));
    expect(BOARD_PAIRS[0] * 2).toBe(round.cards.length);
    const [a, b] = mismatchedPair(round);
    const first = flipCard(round, a);
    expect(first.event).toBe("flipped");
    expect(flipCard(first.round, a).event).toBe("ignored");
    const second = flipCard(first.round, b);
    expect(second.event).toBe("mismatch");
    expect(second.round.open).toEqual([a, b]);
    expect(second.round.pairs).toBe(0);
    round = hideMismatch(second.round);
    expect(round.open).toEqual([]);
    expect(round.cards[a].seen && round.cards[b].seen).toBe(true);
    // tapping on while two differ turns them back at once
    const onward = flipCard(second.round, partnerOf(second.round, a));
    expect(onward.round.open).toEqual([partnerOf(second.round, a)]);

    // the partner of a card already seen is a pair found from memory
    let fromMemory = flipCard(round, partnerOf(round, a)).round;
    const match = flipCard(fromMemory, a);
    expect(match.event).toBe("match");
    fromMemory = match.round;
    expect(fromMemory.pairs).toBe(1);
    expect(fromMemory.remembered).toBe(1);
    expect(fromMemory.cards[a].matched).toBe(true);
    expect(flipCard(fromMemory, a).event).toBe("ignored");
    expect(flipCard(fromMemory, 999).event).toBe("ignored");
  });

  it("clears three boards (four, six, eight pairs), carrying the pairs over, then ends on its own", () => {
    let round = newMemoryRound(0, seeded(11));
    const one = clearBoard(round);
    expect(one.events[one.events.length - 1]).toBe("board-cleared");
    round = one.round;
    expect(isBoardCleared(round)).toBe(true);
    expect(isMemoryComplete(round)).toBe(false);
    expect(flipCard(round, 0).event).toBe("ignored");
    round = nextBoard(round, seeded(12));
    expect(round.board).toBe(1);
    expect(round.cards).toHaveLength(BOARD_PAIRS[1] * 2);
    expect(round.pairs).toBe(BOARD_PAIRS[0]);
    expect(nextBoard(round, seeded(13))).toBe(round);
    round = nextBoard(clearBoard(round).round, seeded(14));
    expect(round.cards).toHaveLength(BOARD_PAIRS[2] * 2);
    const last = clearBoard(round);
    expect(last.events[last.events.length - 1]).toBe("all-cleared");
    round = last.round;
    expect(isMemoryComplete(round)).toBe(true);
    expect(nextBoard(round, seeded(15))).toBe(round);
    expect(memoryScore(round)).toBe(MEMORY_TOTAL_PAIRS);
    expect(round.boardsCleared).toBe(3);
    expect(memorySummary(round, "Maple")).toMatch(/^Eighteen pairs, every board cleared/);
  });

  it("can be finished at any point and never mentions a miss", () => {
    const fresh = newMemoryRound(0, seeded(21));
    expect(memorySummary(fresh, "Maple")).toMatch(/Maple/);
    const ended = endMemoryRound(fresh, 5);
    expect(ended.endedAt).toBe(5);
    expect(endMemoryRound(ended, 9)).toBe(ended);
    expect(flipCard(ended, 0).event).toBe("ignored");
    let partway = fresh;
    partway = flipCard(partway, 0).round;
    partway = flipCard(partway, partnerOf(partway, 0)).round;
    expect(memorySummary(partway, "Maple")).toBe("1 pair found. Maple enjoyed watching the cards turn.");
    expect(memorySummary({ ...partway, pairs: 7, remembered: 4 }, "Maple")).toMatch(/4 of them from memory/);
    for (const r of [fresh, partway]) expect(memorySummary(r, "Maple")).not.toMatch(/miss|wrong|only/i);
    expect(GAME_IDS).toContain("memory");
    expect(normalizePlayStats({ best: { memory: 18 } }, "2026-10-17").best.memory).toBe(18);
  });

  it("lays the cards out four across inside the lawn", () => {
    for (const count of [8, 12, 16]) {
      const layout = memoryLayout(count, 375, 812, 104, 200);
      expect(layout.columns).toBe(4);
      expect(layout.rows).toBe(count / 4);
      expect(layout.left).toBeGreaterThanOrEqual(16);
      expect(layout.left + 4 * layout.cardWidth + 3 * layout.gap).toBeLessThanOrEqual(375 - 15);
      expect(layout.top).toBeGreaterThanOrEqual(104);
      expect(layout.top + layout.rows * layout.cardHeight + (layout.rows - 1) * layout.gap).toBeLessThanOrEqual(812 - 200);
      expect(layout.cardHeight).toBeGreaterThan(layout.cardWidth);
    }
    // a short screen shrinks the cards rather than spilling them
    const short = memoryLayout(16, 375, 560, 104, 200);
    expect(short.top + 4 * short.cardHeight + 3 * short.gap).toBeLessThanOrEqual(560 - 200);
    expect(memoryLayout(16, 0, 0, 104, 200).cardWidth).toBe(0);
  });
});
