import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { useCycle } from "../hooks/useCycle";
import { isPeriodDay } from "../domain/cycle";
import { cozyDayKey, cozyRun, endPauseEarly, makePause, type CozyChapter, type CozyPause, type CozyRunState } from "../domain/cozyRun";
import { HISTORY_DAYS, keepChapters, loadCareDays, loadKeptChapters, loadPauses, savePauses, subscribeCozyRun } from "../services/cozyRunStore";
import { addDaysToDateKey } from "../utils/dateKeys";

export type UseCozyRunResult = {
  state: CozyRunState | null;
  loading: boolean;
  /** the days come from the copy on the phone because the last fetch failed */
  stale: boolean;
  /** every finished run kept on this phone, newest first */
  chapters: CozyChapter[];
  startPause: (days: number) => Promise<void>;
  endPause: () => Promise<void>;
  reload: (force?: boolean) => Promise<void>;
};

/**
 * The signed-in person's Cozy Run (src/domain/cozyRun.ts), refreshed when the screen comes into focus and whenever
 * care is logged anywhere in the app. Logged period days cover quiet days: they are read from the cycle tracker on
 * this phone and used here only; nothing about them is sent anywhere.
 */
export function useCozyRun(): UseCozyRunResult {
  const { user } = useAuth();
  const userId: string | null = user?.id ?? null;
  const cycle = useCycle();
  const [careDays, setCareDays] = useState<Set<string> | null>(null);
  const [stale, setStale] = useState(false);
  const [pauses, setPauses] = useState<CozyPause[]>([]);
  const [chapters, setChapters] = useState<CozyChapter[]>([]);
  const [today, setToday] = useState(() => cozyDayKey(new Date()));

  const reload = useCallback(
    async (force = false) => {
      if (!userId) return;
      setToday(cozyDayKey(new Date()));
      const [days, storedPauses, kept] = await Promise.all([loadCareDays(userId, { maxAgeMs: force ? 0 : 15_000 }), loadPauses(userId), loadKeptChapters(userId)]);
      setCareDays(new Set(days.days));
      setStale(days.stale);
      setPauses(storedPauses);
      setChapters(kept);
    },
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
      return subscribeCozyRun(() => void reload());
    }, [reload])
  );

  const periodDays = useMemo(() => {
    if (!cycle.enabled) return [] as string[];
    const days: string[] = [];
    for (let i = HISTORY_DAYS; i >= 0; i -= 1) {
      const day = addDaysToDateKey(today, -i);
      if (isPeriodDay(cycle.data, day)) days.push(day);
    }
    return days;
  }, [cycle.enabled, cycle.data, today]);

  const state = useMemo(() => (careDays ? cozyRun({ careDays, periodDays, pauses, today }) : null), [careDays, periodDays, pauses, today]);

  // a run that has just become a chapter is kept, so it outlives the history the app reads back
  const freshChapters = state?.chapters;
  useEffect(() => {
    if (!userId || !freshChapters?.length) return;
    let alive = true;
    keepChapters(userId, freshChapters).then((kept) => alive && setChapters(kept));
    return () => {
      alive = false;
    };
  }, [freshChapters, userId]);

  const startPause = useCallback(
    async (days: number) => {
      if (!userId) return;
      const now = cozyDayKey(new Date());
      setPauses(await savePauses(userId, [...endPauseEarly(pauses, now), makePause(now, days)]));
    },
    [pauses, userId]
  );

  const endPause = useCallback(async () => {
    if (!userId) return;
    setPauses(await savePauses(userId, endPauseEarly(pauses, cozyDayKey(new Date()))));
  }, [pauses, userId]);

  return { state, loading: careDays == null, stale, chapters, startPause, endPause, reload };
}
