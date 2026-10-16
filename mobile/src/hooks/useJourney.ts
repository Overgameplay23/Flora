import { useCallback, useEffect, useState } from "react";
import { EMPTY_JOURNEY_STATE, type Journey, type JourneyState, type JourneyStep, journeyById, todayStep } from "../domain/journeys";
import { completeJourneyStep, leaveJourneyForUser, loadJourneyState, startJourneyForUser, subscribeJourneys } from "../services/journeyStore";

export type UseJourneyResult = {
  state: JourneyState;
  loading: boolean;
  /** the active journey's definition */
  journey: Journey | null;
  /** today's step of the active journey; null when none is active or it is finished */
  step: JourneyStep | null;
  start: (journeyId: string) => Promise<void>;
  /** marks today's step done in the arc (the task itself is completed by the caller) */
  completeToday: () => Promise<void>;
  leave: () => Promise<void>;
  reload: () => Promise<void>;
};

/** The signed-in user's journey state, refreshed whenever the store changes and whenever `today` rolls over. */
export function useJourney(userId: string | null | undefined, today: string): UseJourneyResult {
  const [state, setState] = useState<JourneyState>(EMPTY_JOURNEY_STATE);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const next = await loadJourneyState(userId);
    setState(next);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    reload().catch(() => alive && setLoading(false));
    const unsubscribe = subscribeJourneys(() => {
      void reload();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [reload]);

  const start = useCallback(
    async (journeyId: string) => {
      if (!userId) return;
      setState(await startJourneyForUser(userId, journeyId, today));
    },
    [today, userId]
  );
  const completeToday = useCallback(async () => {
    if (!userId) return;
    setState(await completeJourneyStep(userId, today));
  }, [today, userId]);
  const leave = useCallback(async () => {
    if (!userId) return;
    setState(await leaveJourneyForUser(userId));
  }, [userId]);

  const journey = journeyById(state.active?.journeyId) ?? null;
  const step = todayStep(state.active, today);
  return { state, loading, journey, step, start, completeToday, leave, reload };
}
