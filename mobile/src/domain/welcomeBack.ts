// The welcome-back moment: what someone sees the first time they open the app after two or more days away
// (Graceful Hibernation, hibernation.ts, decides when; this decides what). A small sheet over Home, in the pet's
// voice: the bond is still there, how the Cozy Run fared (kept going, resting with a way to mend, or kept as a
// chapter), and that today is small on purpose. It never says how long they were gone or what they missed.
// Pure; HomeScreen gathers the inputs.
import { addDaysToDateKey, parseDateKey } from "../utils/dateKeys";
import type { CozyChapter, CozyRunState, DayKey } from "./cozyRun";
import { HIBERNATION_DAYS } from "./hibernation";
import type { Voice } from "./onboarding";

export const WELCOME_MIN_DAYS = 2;

export type WelcomeLine = { id: "together" | "run" | "today"; icon: string; category: string; text: string };

export type WelcomeMoment = {
  title: string;
  /** the pet's line, in its voice */
  petLine: string;
  lines: WelcomeLine[];
  /** the run line leads somewhere: offer "See the Cozy Run" */
  openRun: boolean;
};

export type WelcomeInput = {
  /** days since the app was last opened (returnStatus in hibernation.ts) */
  daysAway: number;
  /** the last day the app was opened before today */
  lastSeen: DayKey | null;
  petName: string;
  voice?: Voice | null;
  daysTogether: number | null;
  cozy: CozyRunState | null;
  /** every run kept as a chapter, newest first */
  chapters?: readonly CozyChapter[];
  memorial?: boolean;
};

const TITLES: Record<Voice, { short: (pet: string) => string; long: (pet: string) => string }> = {
  warm: { short: (pet) => `${pet} saved your spot`, long: (pet) => `${pet} is so glad you're here` },
  gentle: { short: (pet) => `Welcome back. ${pet} kept things warm`, long: () => "Welcome home" },
  plain: { short: () => "Welcome back", long: () => "Welcome back" },
};

const PET_LINES: Record<Voice, { short: string; long: string }> = {
  // Home's header and the pet's bubble already say "kept the garden warm" and "I missed you": these say something else
  warm: { short: "There you are! It's so good to see you.", long: "You're here. Nothing's owed and nothing's lost. Shall we start small?" },
  gentle: { short: "Good to see you. We can go slowly today.", long: "Take all the time you need. I'm right here." },
  plain: { short: "Good to have you back. One small thing today is plenty.", long: "Good to have you back. One small thing today is plenty." },
};

function weekday(day: DayKey): string {
  const date = parseDateKey(day);
  return date ? date.toLocaleDateString("en-GB", { weekday: "long" }) : day;
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

const count = (n: number, one: string, many: string) => (n === 1 ? `a ${one}` : `${n} ${many}`);

/** What kept the run going over the days away, read from the run's own marks. */
function coverWords(cozy: CozyRunState, lastSeen: DayKey): string[] {
  const away = cozy.recent.filter((d) => d.day > lastSeen && d.day < cozy.today);
  const n = (kind: string) => away.filter((d) => d.kind === kind).length;
  const words: string[] = [];
  if (n("nap") > 0) words.push(n("nap") === 1 ? "a Nap Day" : `${n("nap")} Nap Days`);
  if (n("blanket") > 0) words.push(count(n("blanket"), "Warm Blanket", "Warm Blankets"));
  if (n("pause") > 0) words.push("your pause");
  if (n("cycle") > 0) words.push(n("cycle") === 1 ? "a period day" : "period days");
  return words;
}

function runLine(input: WelcomeInput): WelcomeLine | null {
  const { cozy, lastSeen } = input;
  if (!cozy || !lastSeen) return null;
  const line = (text: string): WelcomeLine => ({ id: "run", icon: "moon-outline", category: "rest", text });

  if (cozy.status === "active" && cozy.start && cozy.start <= lastSeen) {
    const covers = coverWords(cozy, lastSeen);
    return line(
      covers.length
        ? `Your ${cozy.days}-day cozy run kept going: ${joinWords(covers)} covered the quiet days.`
        : `Your ${cozy.days}-day cozy run kept going.`
    );
  }
  if (cozy.status === "resting" && cozy.resting) {
    const n = cozy.resting.showUpsNeeded;
    return line(
      `Your ${cozy.days}-day cozy run is resting. ${n === 1 ? "One day of care" : `${n} days of care`} by ${weekday(cozy.resting.mendBy)}, today included, and it mends.`
    );
  }
  // the run that came to rest while they were away is kept, not broken
  const latest = input.chapters?.[0];
  if (cozy.status === "none" && latest && latest.end >= addDaysToDateKey(lastSeen, -2)) {
    return line(`Your ${latest.days}-day cozy run is kept as a chapter. Today's first small thing starts a new one.`);
  }
  if (cozy.status === "none") return line("Today's first small thing starts a new cozy run.");
  return null;
}

export function welcomeBack(input: WelcomeInput): WelcomeMoment | null {
  if (input.memorial || !Number.isFinite(input.daysAway) || input.daysAway < WELCOME_MIN_DAYS) return null;
  const pet = (input.petName || "Your pet").trim() || "Your pet";
  const voice: Voice = input.voice && TITLES[input.voice] ? input.voice : "warm";
  const long = input.daysAway >= HIBERNATION_DAYS;

  const lines: WelcomeLine[] = [];
  if (typeof input.daysTogether === "number" && input.daysTogether > 0) {
    lines.push({
      id: "together",
      icon: "flower-outline",
      category: "connection",
      text: `Still ${input.daysTogether} ${input.daysTogether === 1 ? "day" : "days"} together. Nothing was lost.`,
    });
  }
  const run = runLine(input);
  if (run) lines.push(run);
  lines.push({ id: "today", icon: "leaf-outline", category: "body", text: "Today is small on purpose. One thing is plenty." });

  return {
    title: long ? TITLES[voice].long(pet) : TITLES[voice].short(pet),
    petLine: long ? PET_LINES[voice].long : PET_LINES[voice].short,
    lines,
    openRun: !!run,
  };
}
