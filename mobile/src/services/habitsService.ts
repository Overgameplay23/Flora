import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_HABITS: string[] = [
  "Drink water",
  "Move your body",
  "Fresh air break",
  "Kind message",
  "Tidy a corner",
];

const HABITS_STORAGE_KEY = "user_habits_v1";
const MAX_HABITS = 10;
const MIN_HABITS = 1;

function normalizeHabits(rawHabits: unknown): string[] {
  if (!Array.isArray(rawHabits)) return [...DEFAULT_HABITS];

  const unique = new Set<string>();
  const normalized: string[] = [];

  for (const value of rawHabits) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const dedupeKey = trimmed.toLowerCase();
    if (unique.has(dedupeKey)) continue;
    unique.add(dedupeKey);
    normalized.push(trimmed);
    if (normalized.length >= MAX_HABITS) break;
  }

  if (normalized.length >= MIN_HABITS) return normalized;
  return [...DEFAULT_HABITS];
}

export async function getHabits(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HABITS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_HABITS];
    const parsed = JSON.parse(raw);
    return normalizeHabits(parsed);
  } catch (_error) {
    return [...DEFAULT_HABITS];
  }
}

export async function saveHabits(habits: string[]): Promise<void> {
  const normalized = normalizeHabits(habits);
  await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(normalized));
}

export async function resetHabits(): Promise<void> {
  await AsyncStorage.removeItem(HABITS_STORAGE_KEY);
}
