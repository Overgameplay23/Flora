// Geometry for the vector pet rig, in a 200 x 200 box (ground line at y = 188).
// Everything is a function of the look so the same code draws a beagle, a shiba, a grey cat…
import { PetLook, shade } from "../../../domain/petLook";

export const BOX = 200;
export const GROUND_Y = 188;

export type Pt = { x: number; y: number };

export function palette(look: PetLook) {
  const outline = shade(look.coat, -0.48);
  return {
    coat: look.coat,
    coatDark: shade(look.coat, -0.18),
    coatLight: shade(look.coat, 0.18),
    secondary: look.secondary,
    ear: look.ear,
    earInner: look.species === "cat" ? shade(look.nose, 0.35) : shade(look.ear, 0.25),
    eye: look.eye,
    eyeDark: shade(look.eye, -0.45),
    nose: look.nose,
    outline,
    mouth: shade(look.coat, -0.6),
    cheek: "#f49ac1",
    patch: look.species === "cat" ? look.secondary : look.ear,
    mask: look.species === "cat" && look.marking === "mask" ? look.ear : shade(look.coat, -0.3),
    stripe: shade(look.coat, -0.28),
  };
}

export function headGeometry(look: PetLook) {
  return look.species === "cat" ? { cx: 100, cy: 86, rx: 41, ry: 37 } : { cx: 100, cy: 84, rx: 42, ry: 41 };
}

export function bodyGeometry(look: PetLook) {
  const slim = look.build === "slim";
  return look.species === "cat"
    ? { cx: 100, cy: 148, rx: slim ? 34 : 38, ry: 38, legX: slim ? 13 : 15, legW: 13 }
    : { cx: 100, cy: 146, rx: slim ? 40 : 45, ry: 39, legX: 16, legW: 16 };
}

/** Pivot points (box coordinates) used as transform origins for the animated layers. */
export function pivots(look: PetLook) {
  const head = headGeometry(look);
  return {
    body: { x: 100, y: GROUND_Y },
    head: { x: 100, y: head.cy + head.ry - 6 },
    eyes: { x: 100, y: head.cy + 2 },
    tail: look.species === "cat" ? { x: 132, y: 154 } : { x: 136, y: 150 },
    earLeft: { x: head.cx - head.rx * 0.72, y: head.cy - head.ry * 0.5 },
    earRight: { x: head.cx + head.rx * 0.72, y: head.cy - head.ry * 0.5 },
  };
}

export function toOrigin(p: Pt) {
  return `${(p.x / BOX) * 100}% ${(p.y / BOX) * 100}%`;
}

/** Ear outline for one side; s = -1 for the left ear, +1 for the right. */
export function earPath(look: PetLook, s: -1 | 1): string {
  const head = headGeometry(look);
  const bx = head.cx + s * head.rx * 0.7; // base on the head
  const by = head.cy - head.ry * 0.55;
  const X = (dx: number) => (bx + s * dx).toFixed(1);
  const Y = (dy: number) => (by + dy).toFixed(1);
  if (look.species === "cat") {
    if (look.ears === "folded") {
      return `M ${X(-6)} ${Y(6)} C ${X(-4)} ${Y(-10)}, ${X(12)} ${Y(-16)}, ${X(20)} ${Y(-4)} C ${X(22)} ${Y(4)}, ${X(10)} ${Y(10)}, ${X(-6)} ${Y(6)} Z`;
    }
    // pointy
    return `M ${X(-8)} ${Y(8)} C ${X(-8)} ${Y(-8)}, ${X(-2)} ${Y(-30)}, ${X(4)} ${Y(-38)} C ${X(14)} ${Y(-26)}, ${X(24)} ${Y(-10)}, ${X(26)} ${Y(4)} C ${X(16)} ${Y(10)}, ${X(2)} ${Y(12)}, ${X(-8)} ${Y(8)} Z`;
  }
  if (look.ears === "pointy") {
    return `M ${X(-8)} ${Y(10)} C ${X(-8)} ${Y(-6)}, ${X(-2)} ${Y(-24)}, ${X(6)} ${Y(-32)} C ${X(16)} ${Y(-20)}, ${X(26)} ${Y(-4)} , ${X(26)} ${Y(8)} C ${X(16)} ${Y(14)}, ${X(2)} ${Y(14)}, ${X(-8)} ${Y(10)} Z`;
  }
  if (look.ears === "folded") {
    return `M ${X(-6)} ${Y(4)} C ${X(-2)} ${Y(-10)}, ${X(14)} ${Y(-14)}, ${X(26)} ${Y(-2)} C ${X(30)} ${Y(10)}, ${X(20)} ${Y(22)}, ${X(8)} ${Y(20)} C ${X(0)} ${Y(18)}, ${X(-6)} ${Y(12)}, ${X(-6)} ${Y(4)} Z`;
  }
  // floppy: a soft lobe hanging beside the head
  return `M ${X(-4)} ${Y(-2)} C ${X(8)} ${Y(-14)}, ${X(24)} ${Y(-6)}, ${X(24)} ${Y(12)} C ${X(24)} ${Y(34)}, ${X(20)} ${Y(52)}, ${X(8)} ${Y(56)} C ${X(-4)} ${Y(58)}, ${X(-10)} ${Y(44)} , ${X(-8)} ${Y(26)} C ${X(-7)} ${Y(14)}, ${X(-8)} ${Y(6)}, ${X(-4)} ${Y(-2)} Z`;
}

/** Inner ear shape (a smaller, inset version of the ear). */
export function earInnerPath(look: PetLook, s: -1 | 1): string {
  const head = headGeometry(look);
  const bx = head.cx + s * head.rx * 0.7;
  const by = head.cy - head.ry * 0.55;
  const X = (dx: number) => (bx + s * dx).toFixed(1);
  const Y = (dy: number) => (by + dy).toFixed(1);
  if (look.species === "cat" && look.ears === "pointy") {
    return `M ${X(-2)} ${Y(4)} C ${X(-1)} ${Y(-8)}, ${X(2)} ${Y(-20)}, ${X(5)} ${Y(-26)} C ${X(11)} ${Y(-16)}, ${X(17)} ${Y(-6)}, ${X(18)} ${Y(3)} Z`;
  }
  if (look.species === "dog" && look.ears === "pointy") {
    return `M ${X(-1)} ${Y(6)} C ${X(0)} ${Y(-4)}, ${X(3)} ${Y(-14)}, ${X(7)} ${Y(-20)} C ${X(13)} ${Y(-11)}, ${X(18)} ${Y(-2)}, ${X(18)} ${Y(5)} Z`;
  }
  return "";
}

export function tailPath(look: PetLook): { d: string; width: number } {
  if (look.species === "cat") {
    if (look.tail === "curl") return { d: "M 132 154 C 166 156, 174 124, 150 122", width: 11 };
    if (look.tail === "fluffy") return { d: "M 132 154 C 160 152, 172 126, 166 100", width: 16 };
    return { d: "M 132 154 C 158 152, 170 128, 164 102", width: 10 };
  }
  if (look.tail === "straight") return { d: "M 136 150 C 156 146, 168 132, 170 116", width: 12 };
  if (look.tail === "fluffy") return { d: "M 136 150 C 160 142, 168 118, 150 108", width: 18 };
  return { d: "M 136 150 C 160 140, 166 116, 148 110", width: 12 };
}

export function mouthPath(look: PetLook, mood: "happy" | "neutral" | "sad" | "open"): string {
  const head = headGeometry(look);
  const cx = head.cx;
  const y = look.species === "cat" ? head.cy + 12 : head.cy + 18;
  if (look.species === "cat") {
    if (mood === "sad") return `M ${cx - 8} ${y + 3} Q ${cx - 4} ${y - 1} ${cx} ${y + 2} Q ${cx + 4} ${y - 1} ${cx + 8} ${y + 3}`;
    return `M ${cx - 8} ${y} Q ${cx - 4} ${y + 5} ${cx} ${y + 1} Q ${cx + 4} ${y + 5} ${cx + 8} ${y}`;
  }
  if (mood === "sad") return `M ${cx - 9} ${y + 6} Q ${cx} ${y - 1} ${cx + 9} ${y + 6}`;
  if (mood === "neutral") return `M ${cx - 7} ${y + 2} Q ${cx} ${y + 6} ${cx + 7} ${y + 2}`;
  return `M ${cx - 11} ${y} Q ${cx} ${y + 11} ${cx + 11} ${y}`;
}

export function whiskerLines(look: PetLook): Array<[number, number, number, number]> {
  if (look.species !== "cat") return [];
  const head = headGeometry(look);
  const y = head.cy + 8;
  const lines: Array<[number, number, number, number]> = [];
  for (const s of [-1, 1] as const) {
    const x0 = head.cx + s * 18;
    lines.push([x0, y - 2, x0 + s * 26, y - 8]);
    lines.push([x0, y + 2, x0 + s * 28, y + 2]);
    lines.push([x0, y + 6, x0 + s * 26, y + 12]);
  }
  return lines;
}

/** Tabby stripes on the forehead (head layer) and flanks (body layer). */
export function stripePaths(look: PetLook): { head: string[]; body: string[] } {
  if (look.marking !== "tabby") return { head: [], body: [] };
  const h = headGeometry(look);
  const b = bodyGeometry(look);
  const top = h.cy - h.ry;
  return {
    head: [
      `M ${h.cx} ${top + 4} C ${h.cx - 2} ${top + 12}, ${h.cx + 2} ${top + 16}, ${h.cx} ${top + 22}`,
      `M ${h.cx - 12} ${top + 6} C ${h.cx - 12} ${top + 12}, ${h.cx - 9} ${top + 16}, ${h.cx - 9} ${top + 20}`,
      `M ${h.cx + 12} ${top + 6} C ${h.cx + 12} ${top + 12}, ${h.cx + 9} ${top + 16}, ${h.cx + 9} ${top + 20}`,
    ],
    body: [
      `M ${b.cx - b.rx + 6} ${b.cy - 14} C ${b.cx - b.rx + 12} ${b.cy - 10}, ${b.cx - b.rx + 12} ${b.cy - 2}, ${b.cx - b.rx + 5} ${b.cy + 2}`,
      `M ${b.cx - b.rx + 8} ${b.cy + 6} C ${b.cx - b.rx + 14} ${b.cy + 10}, ${b.cx - b.rx + 14} ${b.cy + 16}, ${b.cx - b.rx + 7} ${b.cy + 20}`,
      `M ${b.cx + b.rx - 6} ${b.cy - 14} C ${b.cx + b.rx - 12} ${b.cy - 10}, ${b.cx + b.rx - 12} ${b.cy - 2}, ${b.cx + b.rx - 5} ${b.cy + 2}`,
      `M ${b.cx + b.rx - 8} ${b.cy + 6} C ${b.cx + b.rx - 14} ${b.cy + 10}, ${b.cx + b.rx - 14} ${b.cy + 16}, ${b.cx + b.rx - 7} ${b.cy + 20}`,
    ],
  };
}
