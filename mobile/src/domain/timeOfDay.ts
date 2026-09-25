// The garden follows the clock (product strategy report: the sanctuary reflects local time).
// A light wash over the painting and a mood word; nothing else changes, so the scene stays itself.

export type DayPhase = "dawn" | "morning" | "day" | "golden" | "dusk" | "night";

export function dayPhase(hour: number): DayPhase {
  const h = ((Math.floor(Number.isFinite(hour) ? hour : 12) % 24) + 24) % 24;
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 19) return "golden";
  if (h >= 19 && h < 21) return "dusk";
  return "night";
}

/** rgba wash drawn over the whole scene (background and sprites alike) for a phase. */
export function phaseWash(phase: DayPhase): string {
  switch (phase) {
    case "dawn":
      return "rgba(255,196,170,0.16)";
    case "morning":
      return "rgba(255,240,200,0.10)";
    case "golden":
      return "rgba(255,190,110,0.20)";
    case "dusk":
      return "rgba(120,90,160,0.22)";
    case "night":
      return "rgba(24,32,80,0.42)";
    default:
      return "rgba(23,42,30,0.14)";
  }
}

/** Whether stars belong in the sky for this phase. */
export function showStars(phase: DayPhase): boolean {
  return phase === "night" || phase === "dusk";
}

export function phaseGreeting(phase: DayPhase): string {
  switch (phase) {
    case "dawn":
      return "Early light";
    case "morning":
      return "Good morning";
    case "day":
      return "Welcome back";
    case "golden":
      return "Golden hour";
    case "dusk":
      return "Good evening";
    default:
      return "Quiet night";
  }
}
