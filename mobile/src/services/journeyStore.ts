// Device store for journeys (src/domain/journeys): which journey is active, which days are done, and the
// ones finished. Per user, on this phone. Steps are completed through the ordinary tasks row of the day's
// task, so Sprouts and history work unchanged; only the arc itself lives here.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { EMPTY_JOURNEY_STATE, type JourneyState, completeStep, leaveJourney, normalizeJourneyState, startJourney } from "../domain/journeys";
import { getLocalDateKey } from "../utils/dateKeys";

const key = (userId: string) => `floura:journeys:${userId}`;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

export function subscribeJourneys(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadJourneyState(userId: string | null | undefined): Promise<JourneyState> {
  if (!userId) return { ...EMPTY_JOURNEY_STATE, completed: [] };
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? normalizeJourneyState(raw) : { ...EMPTY_JOURNEY_STATE, completed: [] };
  } catch {
    return { ...EMPTY_JOURNEY_STATE, completed: [] };
  }
}

async function write(userId: string, state: JourneyState): Promise<JourneyState> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(state));
  } catch (error) {
    console.warn("JOURNEY_SAVE_FAILED", (error as any)?.message || String(error));
  }
  notify();
  return state;
}

export async function startJourneyForUser(userId: string, journeyId: string, today: string = getLocalDateKey()): Promise<JourneyState> {
  const state = await loadJourneyState(userId);
  return write(userId, startJourney(state, journeyId, today));
}

export async function completeJourneyStep(userId: string, today: string = getLocalDateKey()): Promise<JourneyState> {
  const state = await loadJourneyState(userId);
  return write(userId, completeStep(state, today));
}

export async function leaveJourneyForUser(userId: string): Promise<JourneyState> {
  const state = await loadJourneyState(userId);
  return write(userId, leaveJourney(state));
}
