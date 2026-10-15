// Plan Engine v1: the person picks what they want help with, and each day the app chooses a few small
// tasks they are likely to feel like doing. Pure types only; the rules live in select.ts and the
// device/Supabase glue in src/services/planStore.ts.

/** What the person asked for help with (onboarding research: 10 areas, pick up to 3, ranked). */
export type FocusArea =
  | "calm_mind"
  | "burnout"
  | "get_going"
  | "sleep"
  | "body_basics"
  | "self_kindness"
  | "low_mood"
  | "cycle"
  | "connection"
  | "space_admin";

/** Drives the card colour; independent of the focus areas a task serves. */
export type CareCategory = "calm" | "rest" | "energy" | "focus" | "body" | "nourish" | "connection" | "cycle" | "play";

/** How the task is done: a plain tick, a timer, or a screen it opens. */
export type TaskKind = "tap" | "timer" | "breathing" | "journal" | "play" | "checkin";

/** Coarse parts of the day, bucketed from dayPhase (src/domain/timeOfDay.ts). */
export type DayPart = "morning" | "day" | "evening" | "night";

/** Today's battery from the Home check (src/domain/energy.ts). */
export type Energy = "exhausted" | "anxious" | "calm" | "energized";

/** Stack screens a task can open (app/navigation/AppNavigator.js). */
export type PlanRoute = "Breathing" | "Journal" | "PlayFetch" | "PlayBubbles" | "CheckIn" | "Cycle";

export type CatalogTask = {
  /** stable slug; never mentions cycle words because it may be stored server-side later */
  id: string;
  /** written to tasks.title; may contain {pet} */
  title: string;
  /** shorter label for compact layouts (widget, chips) */
  tinyTitle?: string;
  /** what the pet says about it on the card; may contain {pet} */
  petLine: string;
  /** 0-1 weight per focus area the task serves */
  focus: Partial<Record<FocusArea, number>>;
  category: CareCategory;
  kind: TaskKind;
  minutes: number;
  /** 1 tiny, 2 a little push, 3 a real effort */
  effort: 1 | 2 | 3;
  dayParts: DayPart[] | "any";
  /** Ionicons glyph name (checked against the glyph map in src/__tests__/plan.test.ts) */
  icon: string;
  route?: PlanRoute;
  /** what the illustrated pet acts out when it is done (src/domain/petMood.ts PetActName) */
  act?: "drink" | "stretch" | "breathe" | "sleep" | "walk";
  /** fine on drained/anxious days and after a long break (always effort 1 and 5 minutes or less) */
  lowEnergySafe: boolean;
  /** fine while the garden is a memorial: no pet acting, comfort and grief care only */
  memorialSafe: boolean;
  premium?: boolean;
};

export type PlanSettings = {
  /** ranked, 1-3; the first leads */
  focusAreas: FocusArea[];
  dailyCount: 3 | 4 | 5;
};

/** Per catalog id, over the history window (loadPlanHistory: the 28 days before today). */
export type TaskHistory = Record<
  string,
  {
    shown: number;
    done: number;
    /** dateKey of the last day it was on the plan */
    lastShown?: string;
    /** trailing days it was on the plan and not done (never shown to the person) */
    consecutiveSkips: number;
  }
>;

export type PlanInput = {
  settings: PlanSettings;
  dateKey: string;
  /** local hour 0-23 */
  hour: number;
  energy: Energy | null;
  /** back after a long break (hibernation); the day stays small */
  returning: boolean;
  memorial: boolean;
  /** passed in by a whitelisted cycle reader; the plan module never reads the cycle store itself */
  cyclePhase: "period" | "follicular" | "luteal" | "late" | "unknown" | null;
  history: TaskHistory;
  /** the user id; with dateKey it seeds the day's draw */
  seed: string;
  /** catalog ids already done today: always kept */
  pinned?: string[];
  premium?: boolean;
};

export type PlanSlot = "anchor" | "focus" | "quick" | "pet" | "discovery" | "pinned";

export type PlannedTask = {
  task: CatalogTask;
  slot: PlanSlot;
  /** short, user-facing, e.g. "For your sleep" or "A quick win" */
  reason: string;
};
