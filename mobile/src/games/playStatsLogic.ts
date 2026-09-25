// Pure rules for play statistics and the play task; no storage or network here so they are unit-testable.

export type GameId = "fetch" | "bubbles";

export type PlayStats = {
  best: Partial<Record<GameId, number>>;
  sessions: number;
  lastPlayedDay: string | null;
  sessionsToday: number;
};

export function normalizePlayStats(raw: unknown, today: string): PlayStats {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const best: Partial<Record<GameId, number>> = {};
  for (const game of ["fetch", "bubbles"] as GameId[]) {
    const n = Number(value?.best?.[game]);
    // a recorded 0 still means "played"; only missing/negative values are dropped
    if (Number.isFinite(n) && n >= 0 && value?.best?.[game] != null) best[game] = Math.floor(n);
  }
  const lastPlayedDay = typeof value.lastPlayedDay === "string" ? value.lastPlayedDay : null;
  return {
    best,
    sessions: Math.max(0, Math.floor(Number(value.sessions) || 0)),
    lastPlayedDay,
    sessionsToday: lastPlayedDay === today ? Math.max(0, Math.floor(Number(value.sessionsToday) || 0)) : 0,
  };
}

/** Pure update: applies one finished session to the stats. */
export function applySession(stats: PlayStats, game: GameId, score: number, today: string): { stats: PlayStats; bestBeaten: boolean } {
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const previousBest = stats.best[game] ?? 0;
  const bestBeaten = safeScore > previousBest;
  return {
    bestBeaten,
    stats: {
      best: { ...stats.best, [game]: Math.max(previousBest, safeScore) },
      sessions: stats.sessions + 1,
      lastPlayedDay: today,
      sessionsToday: (stats.lastPlayedDay === today ? stats.sessionsToday : 0) + 1,
    },
  };
}

export const PLAY_TASK_PREFIX = "Play with ";

export function playTaskTitle(petName: string) {
  return `${PLAY_TASK_PREFIX}${petName || "your pet"}`;
}

export function isPlayTask(title: unknown) {
  return typeof title === "string" && title.trim().toLowerCase().startsWith(PLAY_TASK_PREFIX.toLowerCase());
}

