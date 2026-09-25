function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function getLocalDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function addDaysToDateKey(dateKey: string, dayDelta: number): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  parsed.setDate(parsed.getDate() + dayDelta);
  return getLocalDateKey(parsed);
}

export function getISOWeekKey(input: Date | string = new Date()): string {
  const date = typeof input === "string" ? parseDateKey(input) ?? new Date(input) : new Date(input.getTime());
  if (Number.isNaN(date.getTime())) return "1970-W01";

  const weekDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = weekDate.getDay() || 7;
  weekDate.setDate(weekDate.getDate() + 4 - day);

  const weekYear = weekDate.getFullYear();
  const yearStart = new Date(weekYear, 0, 1);
  const dayDiff = Math.floor((weekDate.getTime() - yearStart.getTime()) / 86400000) + 1;
  const weekNumber = Math.ceil(dayDiff / 7);

  return `${weekYear}-W${pad(weekNumber)}`;
}

export function toHumanWeekday(dateKey: string): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  return parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
