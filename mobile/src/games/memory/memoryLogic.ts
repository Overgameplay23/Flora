// Memory Match: cards lie face down on the lawn, each hiding a care glyph (docs/ROADMAP.md, Play). Turn two
// over; a pair stays face up, two that differ simply turn back. Three boards (four, six, then eight pairs),
// no clock and no way to lose: the round ends when the last board is cleared or whenever the person says
// that's enough. The score is the pairs found. Pure rules, no timers or gestures; the screen animates them.

import type { CareCategory } from "../../domain/plan/types";

export type MemoryFace = { id: string; label: string; icon: string; category: CareCategory };

/** One glyph per care category (Ionicons outline); colours come from the category tone on the screen. */
export const MEMORY_FACES: MemoryFace[] = [
  { id: "leaf", label: "Leaf", icon: "leaf-outline", category: "calm" },
  { id: "moon", label: "Moon", icon: "moon-outline", category: "rest" },
  { id: "sun", label: "Sun", icon: "sunny-outline", category: "energy" },
  { id: "bulb", label: "Light bulb", icon: "bulb-outline", category: "focus" },
  { id: "walk", label: "Walk", icon: "walk-outline", category: "body" },
  { id: "water", label: "Water", icon: "water-outline", category: "nourish" },
  { id: "heart", label: "Heart", icon: "heart-outline", category: "connection" },
  { id: "ball", label: "Ball", icon: "tennisball-outline", category: "play" },
];

/** pairs on each board, in order */
export const BOARD_PAIRS = [4, 6, 8];
export const MEMORY_TOTAL_PAIRS = BOARD_PAIRS.reduce((sum, n) => sum + n, 0);
export const MEMORY_COLUMNS = 4;
/** how long two different cards stay face up before they turn back on their own */
export const MISMATCH_SHOW_MS = 1000;
/** the beat between a cleared board and the next deal */
export const NEXT_BOARD_MS = 1200;

export type MemoryCard = {
  /** unique within the round, so the screen can keep each card's animation across renders */
  key: number;
  face: string;
  matched: boolean;
  /** turned over at least once on this board */
  seen: boolean;
};

export type MemoryRound = {
  startedAt: number;
  /** index into BOARD_PAIRS */
  board: number;
  cards: MemoryCard[];
  /** indices of the face-up, unmatched cards (at most two) */
  open: number[];
  /** pairs found across every board: the score */
  pairs: number;
  /** pairs where one of the two had been seen before: found from memory, not by luck */
  remembered: number;
  boardsCleared: number;
  endedAt: number | null;
};

export type FlipEvent = "ignored" | "flipped" | "match" | "mismatch" | "board-cleared" | "all-cleared";

const faceById = new Map(MEMORY_FACES.map((face) => [face.id, face]));

export function memoryFace(id: string): MemoryFace {
  return faceById.get(id) ?? MEMORY_FACES[0];
}

function safeRandom(random: () => number): number {
  const r = Number(random());
  return Number.isFinite(r) ? Math.min(0.999999, Math.max(0, r)) : 0;
}

/** Fisher-Yates with an injected source of randomness (Math.random on the screen, seeded in tests). */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(safeRandom(random) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A board of `pairs` pairs: which glyphs appear changes from board to board, and so does where they lie. */
export function dealBoard(pairs: number, random: () => number, firstKey = 0): MemoryCard[] {
  const count = Math.max(1, Math.min(MEMORY_FACES.length, Math.floor(Number(pairs) || 0)));
  const faces = shuffle(MEMORY_FACES, random).slice(0, count);
  const deck = shuffle([...faces, ...faces], random);
  return deck.map((face, i) => ({ key: firstKey + i, face: face.id, matched: false, seen: false }));
}

export function newMemoryRound(now: number, random: () => number): MemoryRound {
  return { startedAt: now, board: 0, cards: dealBoard(BOARD_PAIRS[0], random), open: [], pairs: 0, remembered: 0, boardsCleared: 0, endedAt: null };
}

export function isBoardCleared(round: MemoryRound): boolean {
  return round.cards.length > 0 && round.cards.every((card) => card.matched);
}

export function isLastBoard(round: MemoryRound): boolean {
  return round.board >= BOARD_PAIRS.length - 1;
}

/** Every board cleared: the round ends on its own. */
export function isMemoryComplete(round: MemoryRound): boolean {
  return isLastBoard(round) && isBoardCleared(round);
}

/** Two different cards are face up, waiting to turn back. */
export function isShowingMismatch(round: MemoryRound): boolean {
  return round.open.length === 2;
}

/** Turn the two different cards back over (their timer ran out, or the person tapped on). */
export function hideMismatch(round: MemoryRound): MemoryRound {
  return round.open.length === 0 ? round : { ...round, open: [] };
}

/**
 * Turn one card over. Tapping while two different cards are still showing turns them back first, so the
 * person never has to wait. A pair stays face up; nothing is counted against two that differ.
 */
export function flipCard(round: MemoryRound, index: number): { round: MemoryRound; event: FlipEvent } {
  if (round.endedAt != null || isBoardCleared(round)) return { round, event: "ignored" };
  const card = round.cards[index];
  if (!card || card.matched) return { round, event: "ignored" };
  const base = isShowingMismatch(round) ? hideMismatch(round) : round;
  if (base.open.includes(index)) return { round, event: "ignored" };

  const open = [...base.open, index];
  if (open.length < 2) {
    return { round: { ...base, open, cards: base.cards.map((c, i) => (i === index ? { ...c, seen: true } : c)) }, event: "flipped" };
  }

  const [first, second] = open;
  const a = base.cards[first];
  const b = base.cards[second];
  if (a.face !== b.face) {
    return { round: { ...base, open, cards: base.cards.map((c, i) => (i === index ? { ...c, seen: true } : c)) }, event: "mismatch" };
  }
  // from memory when the card that completed the pair had been turned over on an earlier turn
  const fromMemory = b.seen;
  const cards = base.cards.map((c, i) => (i === first || i === second ? { ...c, matched: true, seen: true } : c));
  const next: MemoryRound = { ...base, cards, open: [], pairs: base.pairs + 1, remembered: base.remembered + (fromMemory ? 1 : 0) };
  if (!next.cards.every((c) => c.matched)) return { round: next, event: "match" };
  const cleared = { ...next, boardsCleared: next.boardsCleared + 1 };
  return { round: cleared, event: isLastBoard(cleared) ? "all-cleared" : "board-cleared" };
}

/** Deal the next board once this one is cleared; the pairs found so far carry over. */
export function nextBoard(round: MemoryRound, random: () => number): MemoryRound {
  if (round.endedAt != null || !isBoardCleared(round) || isLastBoard(round)) return round;
  const board = round.board + 1;
  const firstKey = Math.max(0, ...round.cards.map((card) => card.key)) + 1;
  return { ...round, board, cards: dealBoard(BOARD_PAIRS[board], random, firstKey), open: [] };
}

export function endMemoryRound(round: MemoryRound, now: number): MemoryRound {
  return round.endedAt != null ? round : { ...round, endedAt: now, open: [] };
}

export function memoryScore(round: MemoryRound): number {
  return round.pairs;
}

export type MemoryLayout = { columns: number; rows: number; cardWidth: number; cardHeight: number; gap: number; left: number; top: number };

/**
 * Where the cards lie: four across, as large as fits between the HUD (`reservedTop`) and the pet
 * (`reservedBottom`), centred in what is left. Cards are a little taller than wide.
 */
export function memoryLayout(cardCount: number, width: number, height: number, reservedTop: number, reservedBottom: number): MemoryLayout {
  const columns = MEMORY_COLUMNS;
  const rows = Math.max(1, Math.ceil(Math.max(0, cardCount) / columns));
  const gap = 10;
  const side = 16;
  const aspect = 0.82;
  const fromWidth = Math.max(0, (width - side * 2 - gap * (columns - 1)) / columns) / aspect;
  const available = Math.max(0, height - reservedTop - reservedBottom);
  const fromHeight = Math.max(0, (available - gap * (rows - 1)) / rows);
  const cardHeight = Math.floor(Math.min(fromWidth, fromHeight, 120));
  const cardWidth = Math.floor(cardHeight * aspect);
  const gridWidth = columns * cardWidth + gap * (columns - 1);
  const gridHeight = rows * cardHeight + gap * (rows - 1);
  return {
    columns,
    rows,
    cardWidth,
    cardHeight,
    gap,
    left: Math.round((width - gridWidth) / 2),
    top: Math.round(reservedTop + Math.max(0, (available - gridHeight) / 2)),
  };
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen"];

function inWords(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function memorySummary(round: MemoryRound, petName: string): string {
  if (round.pairs === 0) return `${petName} sniffed at the cards and lay down beside them. A nice quiet sit.`;
  if (round.pairs >= MEMORY_TOTAL_PAIRS) {
    const capitalised = inWords(MEMORY_TOTAL_PAIRS).replace(/^./, (c) => c.toUpperCase());
    return `${capitalised} pairs, every board cleared. ${petName} watched every card turn.`;
  }
  if (round.remembered >= 3) return `${round.pairs} pairs, ${round.remembered} of them from memory. ${petName} is impressed.`;
  return `${round.pairs} ${round.pairs === 1 ? "pair" : "pairs"} found. ${petName} enjoyed watching the cards turn.`;
}
