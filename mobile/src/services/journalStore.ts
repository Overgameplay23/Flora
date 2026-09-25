// Journal entries: the device copy is the source of truth for this device (the journal must work
// offline and on an older database), and public.journal_entries is kept in step when it exists.
// Server failures are logged and otherwise ignored; nothing here ever blocks writing.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { JournalEntry, addEntry, mergeEntries, normalizeEntries, removeEntry } from "../domain/journal";

const storageKey = (userId: string) => `floura:journal:${userId}`;

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

async function readDevice(userId: string): Promise<JournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return raw ? normalizeEntries(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

async function writeDevice(userId: string, entries: JournalEntry[]) {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(entries));
  } catch {}
}

function isMissingTable(error: any) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("does not exist") || message.includes("could not find the table");
}

/** The device copy, then (best effort) merged with the server copy. */
export async function loadJournal(userId: string | null | undefined): Promise<JournalEntry[]> {
  if (!userId) return [];
  const device = await readDevice(userId);
  try {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, entry_date, prompt, entry_text, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    const merged = mergeEntries(device, normalizeEntries(data || []));
    if (merged.length !== device.length) await writeDevice(userId, merged);
    return merged;
  } catch (error: any) {
    if (!isMissingTable(error)) console.warn("JOURNAL_SERVER_LOAD_FAILED", { message: error?.message });
    return device;
  }
}

export async function writeJournalEntry(userId: string, text: string, prompt: string | null): Promise<JournalEntry[]> {
  const before = await readDevice(userId);
  const next = addEntry(before, { text, prompt });
  if (next === before) return before;
  await writeDevice(userId, next);
  emit();
  const entry = next[0];
  try {
    const { error } = await supabase.from("journal_entries").insert({
      id: entry.id,
      user_id: userId,
      entry_date: entry.date,
      prompt: entry.prompt,
      entry_text: entry.text,
      created_at: entry.createdAt,
    });
    if (error) throw error;
  } catch (error: any) {
    if (!isMissingTable(error)) console.warn("JOURNAL_SERVER_WRITE_FAILED", { message: error?.message });
  }
  return next;
}

export async function deleteJournalEntry(userId: string, id: string): Promise<JournalEntry[]> {
  const next = removeEntry(await readDevice(userId), id);
  await writeDevice(userId, next);
  emit();
  try {
    const { error } = await supabase.from("journal_entries").delete().eq("user_id", userId).eq("id", id);
    if (error) throw error;
  } catch (error: any) {
    if (!isMissingTable(error)) console.warn("JOURNAL_SERVER_DELETE_FAILED", { message: error?.message });
  }
  return next;
}
