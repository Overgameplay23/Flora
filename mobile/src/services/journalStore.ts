// Journal entries: the device copy is the source of truth for this device (the journal must work
// offline and on an older database), and public.journal_entries is kept in step when it exists.
// A durable outbox retries offline writes/deletions. Tombstones prevent deleted entries reappearing.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { JournalEntry, addEntry, mergeEntries, normalizeEntries, removeEntry } from "../domain/journal";

const storageKey = (userId: string) => `floura:journal:${userId}`;
type JournalState = { entries: JournalEntry[]; pending: string[]; deleted: string[] };
const operations = new Map<string, Promise<unknown>>();
function serial<T>(userId: string, action: () => Promise<T>): Promise<T> {
  const next = (operations.get(userId) ?? Promise.resolve()).catch(() => {}).then(action);
  operations.set(userId, next);
  void next.finally(() => { if (operations.get(userId) === next) operations.delete(userId); }).catch(() => {});
  return next;
}

type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) => l());
}
export function subscribeJournal(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function readDevice(userId: string): Promise<JournalState> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  const parsed = raw ? JSON.parse(raw) : [];
  // Preserve journals saved by earlier versions, using the same per-user storage key.
  if (Array.isArray(parsed)) return { entries: normalizeEntries(parsed), pending: [], deleted: [] };
  const ids = (value: unknown): string[] => Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
  const deleted = ids(parsed?.deleted);
  return { entries: normalizeEntries(parsed?.entries).filter((entry) => !deleted.includes(entry.id)), pending: ids(parsed?.pending), deleted };
}

async function writeDevice(userId: string, state: JournalState) {
  // Save entries and outbox atomically. Never claim a save succeeded when device storage failed.
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
}

async function sync(userId: string, state: JournalState) {
  try {
    for (const id of [...state.deleted]) {
      const { error } = await supabase.from("journal_entries").delete().eq("user_id", userId).eq("id", id);
      if (error) throw error;
      state.deleted = state.deleted.filter((value) => value !== id);
    }
    for (const id of [...state.pending]) {
      const entry = state.entries.find((value) => value.id === id);
      if (entry) {
        const { error } = await supabase.from("journal_entries").upsert({
          id: entry.id, user_id: userId, entry_date: entry.date, prompt: entry.prompt,
          entry_text: entry.text, created_at: entry.createdAt,
        }, { onConflict: "id" });
        if (error) throw error;
      }
      state.pending = state.pending.filter((value) => value !== id);
    }
  } catch (error: any) {
    if (!isMissingTable(error)) console.warn("JOURNAL_SYNC_PENDING", { message: error?.message });
  }
  try {
    await writeDevice(userId, state);
  } catch {
    // The entry/outbox was already saved before sync. Retrying those idempotent operations is safe.
    console.warn("JOURNAL_SYNC_ACK_PENDING");
  }
}

function isMissingTable(error: any) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("does not exist") || message.includes("could not find the table");
}

/** The device copy, then (best effort) merged with the server copy. */
export async function loadJournal(userId: string | null | undefined): Promise<JournalEntry[]> {
  if (!userId) return [];
  return serial(userId, async () => {
    const device = await readDevice(userId);
    try {
      await sync(userId, device);
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, entry_date, prompt, entry_text, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const merged = mergeEntries(device.entries, normalizeEntries(data || [])).filter((entry) => !device.deleted.includes(entry.id));
      await writeDevice(userId, { ...device, entries: merged });
      return merged;
    } catch (error: any) {
      if (!isMissingTable(error)) console.warn("JOURNAL_SERVER_LOAD_FAILED", { message: error?.message });
      return device.entries;
    }
  });
}

export async function writeJournalEntry(userId: string, text: string, prompt: string | null): Promise<JournalEntry[]> {
  return serial(userId, async () => {
    const state = await readDevice(userId);
    const next = addEntry(state.entries, { text, prompt });
    if (next === state.entries) return next;
    const entry = next.find((candidate) => !state.entries.some((old) => old.id === candidate.id))!;
    state.entries = next;
    state.pending.push(entry.id);
    await writeDevice(userId, state);
    emit();
    await sync(userId, state);
    return next;
  });
}

export async function deleteJournalEntry(userId: string, id: string): Promise<JournalEntry[]> {
  return serial(userId, async () => {
    const state = await readDevice(userId);
    state.entries = removeEntry(state.entries, id);
    state.pending = state.pending.filter((value) => value !== id);
    state.deleted = [...new Set([...state.deleted, id])];
    await writeDevice(userId, state);
    emit();
    await sync(userId, state);
    return state.entries;
  });
}
