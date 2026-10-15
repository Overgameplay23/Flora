// Plan Engine v1 selection (tasks map, section 5c): a pure function from what the person asked for, the
// time, today's battery and their own history to a short list of tasks for today.
//
// Shape of the day:
//   1. Filter: memorial keeps comfort tasks only; a drained or anxious day, or a return after a long break,
//      keeps tiny tasks only (effort 1, 5 minutes or less) and caps the day at 3; tasks must suit the part of
//      the day; premium tasks need premium.
//   2. Count: the person's daily count, nudged by how the last week went (the done rate of tasks last shown
//      in the 7 days before today; TaskHistory only keeps totals, so this is a close stand-in).
//   3. Slots, in order: an anchor (the primary area's task with the best done rate, stable day to day for
//      habit forming), focus picks (tasks squarely about an area, areas weighted .5/.3/.2 by rank), a quick
//      win (2 minutes or less), something with the pet (not on a memorial), and one thing not seen in 14 days.
//      A slot that cannot be filled becomes another focus pick.
//   4. Score = focusWeight * sqrt(p) * timeFit * energyFit * phaseFit * novelty * max(0.2, 0.5^skips), with
//      p = (done+1)/(shown+2). The draw is seeded by user and day, so the list holds still all day.
//
// Done tasks are pinned: the plan is built as if nothing were done, then every pinned task is kept and
// undone tasks make room for them. Ticking a task off therefore never reshuffles the rest. Nothing here
// ever tells the person a task was passed over; that signal only lowers its weight.
import { dayPhase } from "../timeOfDay";
import { parseDateKey } from "../../utils/dateKeys";
import { PLAN_CATALOG, catalogById } from "./catalog";
import { normalizePlanSettings } from "./focusAreas";
import type { CatalogTask, DayPart, Energy, FocusArea, PlanInput, PlannedTask, PlanSlot, TaskHistory } from "./types";

const RANK_WEIGHTS = [0.5, 0.3, 0.2];
/** a period day treats rhythm care as a secondary area even if it was not picked */
const PERIOD_CYCLE_WEIGHT = 0.3;
/** a task "belongs" to an area at this weight or more; lighter tags only nudge the score */
const CORE_WEIGHT = 0.5;
/** the anchor comes from tasks tagged at least this strongly with the primary area */
const ANCHOR_MIN_WEIGHT = 0.4;
const GENTLE_DAY_COUNT = 3;
const GENTLE_MAX_MINUTES = 5;
const QUICK_MAX_MINUTES = 2;
const DISCOVERY_DAYS = 14;
const DONE_RATE_DAYS = 7;
const DONE_RATE_MIN_SHOWN = 5;
const SLOT_ORDER: Exclude<PlanSlot, "pinned">[] = ["anchor", "focus", "quick", "pet", "discovery"];

const FOCUS_REASON: Record<FocusArea, string> = {
  calm_mind: "For a calmer mind",
  burnout: "For your recovery",
  get_going: "For getting started",
  sleep: "For your sleep",
  body_basics: "For your body",
  self_kindness: "For a kinder inner voice",
  low_mood: "For a lighter mood",
  cycle: "For your rhythm",
  connection: "For feeling connected",
  space_admin: "For a clearer space",
};

/** dayPhase buckets: dawn and morning are morning, golden hour and dusk are evening. */
export function dayPartForHour(hour: number): DayPart {
  switch (dayPhase(hour)) {
    case "dawn":
    case "morning":
      return "morning";
    case "day":
      return "day";
    case "golden":
    case "dusk":
      return "evening";
    default:
      return "night";
  }
}

export function planProgress(items: Array<{ done: boolean }>): { done: number; total: number; allDone: boolean } {
  const list = Array.isArray(items) ? items : [];
  const done = list.filter((item) => Boolean(item?.done)).length;
  return { done, total: list.length, allDone: list.length > 0 && done === list.length };
}

// ---------- seeded randomness ----------

/** FNV-1a with a murmur finalizer: cheap, stable across platforms, well spread for short keys. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A number in (0, 1) fixed by the key. */
function unit(key: string): number {
  return (hash32(key) + 0.5) / 4294967296;
}

function daysBetween(from: string | undefined, to: string): number | null {
  if (!from) return null;
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);
}

// ---------- context ----------

type Context = {
  dateKey: string;
  seed: string;
  part: DayPart;
  areas: FocusArea[];
  weights: Partial<Record<FocusArea, number>>;
  energy: Energy | null;
  memorial: boolean;
  phase: PlanInput["cyclePhase"];
  history: TaskHistory;
};

type HistoryEntry = { shown: number; done: number; lastShown?: string; consecutiveSkips: number };

function wholeCount(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function historyFor(ctx: Context, id: string): HistoryEntry {
  const raw = ctx.history && typeof ctx.history === "object" ? (ctx.history as Record<string, any>)[id] : null;
  if (!raw || typeof raw !== "object") return { shown: 0, done: 0, consecutiveSkips: 0 };
  return {
    shown: wholeCount(raw.shown),
    done: wholeCount(raw.done),
    lastShown: typeof raw.lastShown === "string" ? raw.lastShown : undefined,
    consecutiveSkips: wholeCount(raw.consecutiveSkips),
  };
}

function fitsDayPart(task: CatalogTask, part: DayPart) {
  return task.dayParts === "any" || task.dayParts.includes(part);
}

function isGentleTask(task: CatalogTask) {
  return task.lowEnergySafe && task.effort === 1 && task.minutes <= GENTLE_MAX_MINUTES;
}

/** Done rate over tasks last shown in the week before today; null until there is enough to go on. */
function recentDoneRate(ctx: Context): number | null {
  let shown = 0;
  let done = 0;
  for (const id of Object.keys(ctx.history || {})) {
    const entry = historyFor(ctx, id);
    const days = daysBetween(entry.lastShown, ctx.dateKey);
    if (days == null || days < 1 || days > DONE_RATE_DAYS) continue;
    shown += entry.shown;
    done += Math.min(entry.done, entry.shown);
  }
  return shown >= DONE_RATE_MIN_SHOWN ? done / shown : null;
}

// ---------- scoring ----------

function focusWeight(task: CatalogTask, ctx: Context): number {
  let total = 0;
  for (const [area, weight] of Object.entries(ctx.weights) as Array<[FocusArea, number]>) {
    total += weight * (task.focus[area] || 0);
  }
  return total;
}

/** Whether the task is squarely about one of the person's areas, not just lightly tagged with it. */
function servesCore(task: CatalogTask, ctx: Context) {
  return (Object.keys(ctx.weights) as FocusArea[]).some((area) => (task.focus[area] || 0) >= CORE_WEIGHT);
}

/** The person's area this task serves most (preferring areas it is squarely about), if any. */
function dominantArea(task: CatalogTask, ctx: Context): FocusArea | null {
  for (const minimum of [CORE_WEIGHT, Number.MIN_VALUE]) {
    let best: FocusArea | null = null;
    let bestValue = 0;
    for (const [area, weight] of Object.entries(ctx.weights) as Array<[FocusArea, number]>) {
      const tag = task.focus[area] || 0;
      if (tag < minimum) continue;
      if (weight * tag > bestValue) {
        best = area;
        bestValue = weight * tag;
      }
    }
    if (best) return best;
  }
  return null;
}

/** Laplace-smoothed chance they do it; completions without a showing still count as interest. */
function pHat(entry: HistoryEntry) {
  return (entry.done + 1) / (Math.max(entry.shown, entry.done) + 2);
}

function skipFactor(entry: HistoryEntry) {
  return Math.max(0.2, Math.pow(0.5, entry.consecutiveSkips));
}

function timeFit(task: CatalogTask) {
  // tasks made for this part of the day feel more personal than all-day ones
  return task.dayParts === "any" ? 1 : 1.15;
}

function energyFit(task: CatalogTask, energy: Energy | null) {
  switch (energy) {
    case "exhausted":
      return task.category === "rest" || task.category === "nourish" || task.category === "body" ? 1.3 : 1;
    case "anxious":
      return task.category === "calm" || task.kind === "breathing" ? 1.4 : 1;
    case "energized":
      return task.effort >= 2 ? 1.2 : 0.9;
    case "calm":
      return 1;
    default:
      return task.effort === 3 ? 0.8 : 1;
  }
}

function phaseFit(task: CatalogTask, phase: PlanInput["cyclePhase"]) {
  if (phase === "period") {
    let fit = task.category === "cycle" ? 2 : 1;
    if (task.effort === 1) fit *= 1.2;
    if (task.effort === 3) fit *= 0.5;
    return fit;
  }
  if (phase === "luteal" || phase === "late") return task.effort === 3 ? 0.7 : 1;
  return 1;
}

function novelty(entry: HistoryEntry, ctx: Context) {
  const days = daysBetween(entry.lastShown, ctx.dateKey);
  if (days == null) return 1.2;
  if (days >= DISCOVERY_DAYS) return 1.15;
  if (days === 1) return 0.9;
  return 1;
}

/** Everything in the score except the focus weight, which each slot floors differently. */
function baseScore(task: CatalogTask, ctx: Context) {
  const entry = historyFor(ctx, task.id);
  return Math.sqrt(pHat(entry)) * timeFit(task) * energyFit(task, ctx.energy) * phaseFit(task, ctx.phase) * novelty(entry, ctx) * skipFactor(entry);
}

const ONE_PER_DAY_KINDS = new Set(["journal", "breathing", "timer", "checkin", "play"]);

/** Keeps the day varied: repeats of a colour, a screen, or an area already covered weigh less. */
function diversity(task: CatalogTask, chosen: CatalogTask[], ctx: Context, coverArea: boolean) {
  let factor = 1;
  for (const other of chosen) {
    if (other.category === task.category) factor *= 0.6;
    if (other.kind === task.kind && ONE_PER_DAY_KINDS.has(task.kind)) factor *= 0.4;
  }
  if (coverArea) {
    const area = dominantArea(task, ctx);
    if (area) for (const other of chosen) if (dominantArea(other, ctx) === area) factor *= 0.6;
  }
  return factor;
}

/** Seeded weighted draw (Efraimidis-Spirakis keys): stable per task and day, whatever else is in the pool. */
function draw(candidates: CatalogTask[], weight: (task: CatalogTask) => number, ctx: Context): CatalogTask | null {
  let best: CatalogTask | null = null;
  let bestKey = -Infinity;
  for (const task of candidates) {
    const w = weight(task);
    if (!(w > 0)) continue;
    const key = Math.log(unit(`${ctx.seed}|${ctx.dateKey}|${task.id}`)) / w;
    if (key > bestKey) {
      best = task;
      bestKey = key;
    }
  }
  return best;
}

/**
 * The anchor is chosen, not drawn: the primary area's task with the best done rate (p), so it is the same
 * most days and drifts toward what the person actually does. The tag weight only breaks near-ties, all-day
 * tasks are preferred so the anchor holds across the day, and a lightly tagged task only stands in when
 * nothing tagged more strongly fits right now.
 */
function pickAnchor(pool: CatalogTask[], ctx: Context): CatalogTask | null {
  const primary = ctx.areas[0];
  const strong = pool.filter((task) => (task.focus[primary] || 0) >= ANCHOR_MIN_WEIGHT);
  let best: CatalogTask | null = null;
  let bestScore = -Infinity;
  for (const task of strong.length > 0 ? strong : pool) {
    const weight = task.focus[primary] || 0;
    if (weight <= 0) continue;
    const entry = historyFor(ctx, task.id);
    const score =
      pHat(entry) * skipFactor(entry) * (0.5 + 0.5 * weight) * phaseFit(task, ctx.phase) * (task.dayParts === "any" ? 1.1 : 1) * (task.effort === 3 ? 0.7 : 1) *
      // a small per-person tie-break, the same every day, so equal candidates differ between people
      (1 + 0.08 * unit(`${ctx.seed}|anchor|${task.id}`));
    if (score > bestScore) {
      best = task;
      bestScore = score;
    }
  }
  return best;
}

function reasonFor(slot: PlanSlot, task: CatalogTask, ctx: Context): string {
  switch (slot) {
    case "anchor": {
      const phrase = FOCUS_REASON[ctx.areas[0]];
      return `Every day, ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;
    }
    case "focus": {
      const area = dominantArea(task, ctx);
      return area ? FOCUS_REASON[area] : "A small step for today";
    }
    case "quick":
      return "A quick win";
    case "pet":
      if (task.kind === "play") return "Playtime counts too";
      return task.title.includes("{pet}") ? "With your pet" : "Do it together";
    case "discovery":
      return "Something new to try";
    default:
      return "Done today";
  }
}

function fillSlot(slot: Exclude<PlanSlot, "pinned">, pool: CatalogTask[], chosen: CatalogTask[], ctx: Context): CatalogTask | null {
  const open = pool.filter((task) => !chosen.includes(task));
  const scored = (floor: number, coverArea: boolean, bonus: (task: CatalogTask) => number = () => 1) => (task: CatalogTask) =>
    Math.max(focusWeight(task, ctx), floor) * baseScore(task, ctx) * diversity(task, chosen, ctx, coverArea) * bonus(task);

  switch (slot) {
    case "anchor":
      return pickAnchor(open, ctx);
    case "focus":
      return draw(open.filter((task) => servesCore(task, ctx)), scored(0, true), ctx);
    case "quick":
      return draw(open.filter((task) => task.minutes <= QUICK_MAX_MINUTES), scored(0.1, false), ctx);
    case "pet":
      // play first, then tasks done with the pet ({pet} in the title), then ones the pet acts out alongside
      return draw(
        open.filter((task) => task.kind === "play" || task.title.includes("{pet}") || task.act != null),
        scored(0.25, false, (task) => (task.kind === "play" ? 1.6 : task.title.includes("{pet}") ? 1.2 : 0.6)),
        ctx
      );
    case "discovery":
      return draw(
        open.filter((task) => {
          const days = daysBetween(historyFor(ctx, task.id).lastShown, ctx.dateKey);
          return days == null || days >= DISCOVERY_DAYS;
        }),
        scored(0.15, false),
        ctx
      );
    default:
      return null;
  }
}

/** Last resort so the day is never empty: a tiny body or nourish task (water, most days). */
function fallbackTask(ctx: Context, premium: boolean): CatalogTask | null {
  const candidates = PLAN_CATALOG.filter(
    (task) =>
      task.lowEnergySafe && (task.category === "body" || task.category === "nourish") && (premium || !task.premium) && (!ctx.memorial || task.memorialSafe)
  );
  let best: CatalogTask | null = null;
  let bestScore = -Infinity;
  for (const task of candidates) {
    const score = (fitsDayPart(task, ctx.part) ? 2 : 1) * baseScore(task, ctx);
    if (score > bestScore) {
      best = task;
      bestScore = score;
    }
  }
  return best ?? catalogById("body.water") ?? null;
}

export function buildDailyPlan(input: PlanInput): PlannedTask[] {
  const settings = normalizePlanSettings(input?.settings);
  const areas = settings.focusAreas;
  const phase = input?.cyclePhase ?? null;
  const energy = input?.energy ?? null;
  const gentle = energy === "exhausted" || energy === "anxious" || Boolean(input?.returning);
  const premium = Boolean(input?.premium);

  const weights: Partial<Record<FocusArea, number>> = {};
  areas.forEach((area, index) => {
    weights[area] = RANK_WEIGHTS[index] ?? RANK_WEIGHTS[RANK_WEIGHTS.length - 1];
  });
  if (phase === "period") weights.cycle = Math.max(weights.cycle || 0, PERIOD_CYCLE_WEIGHT);

  const ctx: Context = {
    dateKey: String(input?.dateKey || ""),
    seed: String(input?.seed || ""),
    part: dayPartForHour(Number(input?.hour)),
    areas,
    weights,
    energy,
    memorial: Boolean(input?.memorial),
    phase,
    history: input?.history && typeof input.history === "object" ? input.history : {},
  };

  // 1. filter
  const rhythmAware = areas.includes("cycle") || phase === "period";
  const pool = PLAN_CATALOG.filter((task) => {
    if (task.premium && !premium) return false;
    if (ctx.memorial && !task.memorialSafe) return false;
    if (gentle && !isGentleTask(task)) return false;
    if (!fitsDayPart(task, ctx.part)) return false;
    if (task.category === "cycle" && !rhythmAware) return false;
    return true;
  });

  // 2. count
  let target: number = settings.dailyCount;
  if (gentle) {
    target = GENTLE_DAY_COUNT;
  } else {
    const rate = recentDoneRate(ctx);
    if (rate != null && rate >= 0.8 && (energy === "calm" || energy === "energized")) target = Math.min(5, target + 1);
    else if (rate != null && rate <= 0.3) target = GENTLE_DAY_COUNT;
  }

  // 3. slots, as if nothing were done yet
  const chosen: CatalogTask[] = [];
  const plan: PlannedTask[] = [];
  for (let i = 0; i < target; i++) {
    let slot: Exclude<PlanSlot, "pinned"> = SLOT_ORDER[i] ?? "focus";
    // a memorial has no pet to play with; that slot goes back to the person's areas
    if (slot === "pet" && ctx.memorial) slot = "focus";
    let task = fillSlot(slot, pool, chosen, ctx);
    if (!task && slot !== "focus") {
      slot = "focus";
      task = fillSlot("focus", pool, chosen, ctx);
    }
    if (!task) {
      // nothing from their areas fits right now; any eligible task still beats an empty day
      task = draw(
        pool.filter((candidate) => !chosen.includes(candidate)),
        (candidate) => Math.max(focusWeight(candidate, ctx), 0.05) * baseScore(candidate, ctx) * diversity(candidate, chosen, ctx, false),
        ctx
      );
    }
    if (!task) break;
    chosen.push(task);
    plan.push({ task, slot, reason: reasonFor(slot, task, ctx) });
  }

  // 4. pinned (done today) tasks are always kept; undone ones at the end make room for them
  const pinnedIds: string[] = [];
  for (const id of Array.isArray(input?.pinned) ? input.pinned : []) {
    if (typeof id === "string" && catalogById(id) && !pinnedIds.includes(id)) pinnedIds.push(id);
  }
  const planned = new Set(plan.map((item) => item.task.id));
  const extras: PlannedTask[] = pinnedIds
    .filter((id) => !planned.has(id))
    .map((id) => ({ task: catalogById(id) as CatalogTask, slot: "pinned" as const, reason: reasonFor("pinned", catalogById(id) as CatalogTask, ctx) }));
  const result = [...extras, ...plan];
  const total = Math.max(target, pinnedIds.length);
  for (let i = result.length - 1; i >= 0 && result.length > total; i--) {
    if (!pinnedIds.includes(result[i].task.id)) result.splice(i, 1);
  }

  if (result.length === 0) {
    const fallback = fallbackTask(ctx, premium);
    if (fallback) result.push({ task: fallback, slot: "quick", reason: "Gentle for today" });
  }
  return result;
}
