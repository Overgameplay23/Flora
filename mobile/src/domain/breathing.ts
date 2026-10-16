// Paced breathing: one slow minute with the pet. The default is 4-2-6 (in for 4, hold for 2, out for 6):
// a longer out-breath than in-breath is the part that calms, and 12 s per breath gives five breaths a
// minute. Pure timing here; the screen (src/components/breathing/BreathingSession.tsx) animates and
// buzzes on each step.

export type BreathPhaseKey = "in" | "hold" | "out";

export type BreathPhase = { key: BreathPhaseKey; seconds: number; label: string };

export const PATTERN_4_2_6: BreathPhase[] = [
  { key: "in", seconds: 4, label: "Breathe in" },
  { key: "hold", seconds: 2, label: "Hold" },
  { key: "out", seconds: 6, label: "Breathe out" },
];

/** Five breaths of 4-2-6 make the minute. */
export const DEFAULT_BREATHS = 5;

export type BreathStep = {
  /** 0-based breath this step belongs to */
  breath: number;
  phase: BreathPhase;
  startMs: number;
  durationMs: number;
};

/** Every step of a session, back to back. */
export function sessionSteps(pattern: BreathPhase[] = PATTERN_4_2_6, breaths: number = DEFAULT_BREATHS): BreathStep[] {
  const steps: BreathStep[] = [];
  let at = 0;
  const count = Math.max(1, Math.floor(breaths));
  for (let breath = 0; breath < count; breath += 1) {
    for (const phase of pattern) {
      const durationMs = Math.max(0, Math.round(phase.seconds * 1000));
      if (durationMs === 0) continue;
      steps.push({ breath, phase, startMs: at, durationMs });
      at += durationMs;
    }
  }
  return steps;
}

export function sessionLengthMs(steps: BreathStep[]): number {
  const last = steps[steps.length - 1];
  return last ? last.startMs + last.durationMs : 0;
}

export type BreathPosition = {
  /** index into steps, or steps.length once finished */
  index: number;
  step: BreathStep | null;
  /** time left in the current step */
  remainingMs: number;
  /** breaths fully completed */
  breathsDone: number;
  done: boolean;
};

/** Where a session is after `elapsedMs` of breathing (pauses excluded). */
export function positionAt(steps: BreathStep[], elapsedMs: number): BreathPosition {
  const total = sessionLengthMs(steps);
  const breaths = steps.length ? steps[steps.length - 1].breath + 1 : 0;
  if (steps.length === 0 || elapsedMs >= total) {
    return { index: steps.length, step: null, remainingMs: 0, breathsDone: breaths, done: true };
  }
  const t = Math.max(0, elapsedMs);
  let index = 0;
  while (index < steps.length - 1 && steps[index + 1].startMs <= t) index += 1;
  const step = steps[index];
  // a breath counts once its last step has finished
  const lastOfBreath = (breath: number) => {
    let last = -1;
    for (let i = 0; i < steps.length; i += 1) if (steps[i].breath === breath) last = i;
    return last;
  };
  const breathsDone = index > lastOfBreath(step.breath) ? step.breath + 1 : step.breath;
  return { index, step, remainingMs: step.startMs + step.durationMs - t, breathsDone, done: false };
}

/** How full the lungs (and the halo) are at the end of a phase: 1 after breathing in and holding, 0 after out. */
export function fullnessAfter(phase: BreathPhaseKey): number {
  return phase === "out" ? 0 : 1;
}
