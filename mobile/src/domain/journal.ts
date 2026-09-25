// The journal: a few private lines a day, started by the pet's question when the person wants a
// start. No scoring, no AI reading it, nothing derived from it (product strategy report: designed
// prompts over open-ended chat; the journal is for the person, not for the app).
import { getLocalDateKey, parseDateKey } from "../utils/dateKeys";

export type JournalEntry = {
  id: string;
  date: string;
  text: string;
  prompt: string | null;
  createdAt: string;
};

export const JOURNAL_MAX = 2000;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, JOURNAL_MAX) : "";
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && parseDateKey(value) != null;
}

/** Accepts device rows or server rows (entry_text / entry_date / created_at) and returns newest first. */
export function normalizeEntries(raw: unknown): JournalEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: JournalEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : r.id != null ? String(r.id) : "";
    const text = cleanText(r.text ?? r.entry_text);
    if (!id || !text || seen.has(id)) continue;
    const createdAtRaw = typeof r.createdAt === "string" ? r.createdAt : typeof r.created_at === "string" ? r.created_at : "";
    const createdAt = Number.isNaN(Date.parse(createdAtRaw)) ? new Date(0).toISOString() : new Date(createdAtRaw).toISOString();
    const dateRaw = r.date ?? r.entry_date;
    const date = isDateKey(dateRaw) ? dateRaw : createdAt.slice(0, 10);
    const promptRaw = r.prompt;
    const prompt = typeof promptRaw === "string" && promptRaw.trim() ? promptRaw.trim() : null;
    seen.add(id);
    out.push({ id, date, text, prompt, createdAt });
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export function makeEntryId(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  // uuid v4 shape, so the same id can be the server's primary key
  const v = `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${((8 + Math.floor(Math.random() * 4)).toString(16))}${hex().slice(1)}-${hex()}${hex()}${hex()}`;
  return v;
}

export function addEntry(
  entries: JournalEntry[],
  input: { text: string; prompt?: string | null; date?: string; id?: string; createdAt?: string }
): JournalEntry[] {
  const text = cleanText(input.text);
  if (!text) return entries;
  const entry: JournalEntry = {
    id: input.id || makeEntryId(),
    date: input.date && isDateKey(input.date) ? input.date : getLocalDateKey(),
    text,
    prompt: input.prompt && input.prompt.trim() ? input.prompt.trim() : null,
    createdAt: input.createdAt || new Date().toISOString(),
  };
  return normalizeEntries([entry, ...entries]);
}

export function removeEntry(entries: JournalEntry[], id: string): JournalEntry[] {
  return entries.filter((e) => e.id !== id);
}

/** Union of two lists by id (the device copy and the server copy), newest first. */
export function mergeEntries(a: JournalEntry[], b: JournalEntry[]): JournalEntry[] {
  return normalizeEntries([...a, ...b]);
}

export type JournalDay = { date: string; label: string; entries: JournalEntry[] };

export function humanDay(dateKey: string, today: string = getLocalDateKey()): string {
  if (dateKey === today) return "Today";
  const d = parseDateKey(dateKey);
  const t = parseDateKey(today);
  if (d && t) {
    const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
    if (diff === 1) return "Yesterday";
    return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  return dateKey;
}

export function groupByDay(entries: JournalEntry[], today: string = getLocalDateKey()): JournalDay[] {
  const days: JournalDay[] = [];
  for (const entry of normalizeEntries(entries)) {
    const last = days[days.length - 1];
    if (last && last.date === entry.date) last.entries.push(entry);
    else days.push({ date: entry.date, label: humanDay(entry.date, today), entries: [entry] });
  }
  return days;
}

export function journalIntro(petName?: string | null): string {
  return `${petName || "Your pet"} asks`;
}

export function journalPrivacyLine(petName?: string | null): string {
  return `Private. Nobody reads this, not even ${petName || "your pet"}.`;
}
