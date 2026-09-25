import type { Exercise, SessionRecap, WorkoutSession } from '@/types/models';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { buildFallbackRecap } from '@/utils/workouts';

export async function requestSessionRecap(session: WorkoutSession, exercises: Exercise[], previousSessions: WorkoutSession[]): Promise<SessionRecap> {
  if (!isSupabaseConfigured) {
    return buildFallbackRecap(session, exercises, previousSessions);
  }

  try {
    const { data, error } = await supabase.functions.invoke('session-recap', {
      body: {
        session,
        exercises,
        comparableSessions: previousSessions.slice(0, 5),
      },
    });

    if (error || !data) {
      return buildFallbackRecap(session, exercises, previousSessions);
    }

    return {
      ...buildFallbackRecap(session, exercises, previousSessions),
      ...data,
      provider: 'supabase-edge',
    };
  } catch {
    return buildFallbackRecap(session, exercises, previousSessions);
  }
}
