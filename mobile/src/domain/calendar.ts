// Month grid helpers for the cycle calendar (pure).
import { getLocalDateKey, parseDateKey } from "../utils/dateKeys";

export type MonthCell = { date: string; inMonth: boolean; day: number };

const pad = (n: number) => String(n).padStart(2, "0");

export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

/** Weeks (Monday-first) covering the given month; cells outside the month are flagged. */
export function monthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday = 0 … Sunday = 6
  const lead = (first.getDay() + 6) % 7;
  const cells: MonthCell[] = [];
  for (let i = lead; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    cells.push({ date: getLocalDateKey(d), inMonth: false, day: d.getDate() });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: getLocalDateKey(new Date(year, month, day)), inMonth: true, day });
  }
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month, daysInMonth + (cells.length - lead - daysInMonth) + 1);
    cells.push({ date: getLocalDateKey(d), inMonth: false, day: d.getDate() });
  }
  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function humanDate(dateKey: string): string {
  const d = parseDateKey(dateKey);
  if (!d) return dateKey;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function shortDate(dateKey: string): string {
  const d = parseDateKey(dateKey);
  if (!d) return dateKey;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
