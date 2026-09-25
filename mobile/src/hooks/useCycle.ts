import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { CycleData, CycleStatus, EMPTY_CYCLE_DATA, cycleStatus } from "../domain/cycle";
import { loadCycleData, loadCycleEnabled, subscribeCycle } from "../services/cycleStore";
import { getLocalDateKey } from "../utils/dateKeys";

export type UseCycleResult = {
  userId: string | null;
  enabled: boolean;
  data: CycleData;
  status: CycleStatus;
  loading: boolean;
  today: string;
  reload: () => Promise<void>;
};

/** The device-local cycle data for the signed-in user, refreshed whenever the store changes. */
export function useCycle(): UseCycleResult {
  const { user } = useAuth();
  const userId: string | null = user?.id ?? null;
  const [enabled, setEnabled] = useState(false);
  const [data, setData] = useState<CycleData>(EMPTY_CYCLE_DATA);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => getLocalDateKey());

  const reload = useCallback(async () => {
    setToday(getLocalDateKey());
    const [isEnabled, stored] = await Promise.all([loadCycleEnabled(userId), loadCycleData(userId)]);
    setEnabled(isEnabled);
    setData(stored);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    reload().catch(() => alive && setLoading(false));
    const unsubscribe = subscribeCycle(() => {
      void reload();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [reload]);

  return { userId, enabled, data, status: cycleStatus(data, today), loading, today, reload };
}
