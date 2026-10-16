import { careDoneLine, homePetLine, type HomeLineInput } from "../domain/homeDialogue";
import { ENERGY_OPTIONS, energyOption, isGentleEnergy } from "../domain/energy";
import fs from "fs";
import path from "path";

const base: HomeLineInput = {
  petName: "Biscuit",
  phase: "morning",
  energy: null,
  done: 0,
  total: 4,
  returning: false,
  place: "garden",
  focus: null,
  seed: "2026-10-15",
};

describe("homePetLine", () => {
  it("is stable for the same day and situation", () => {
    expect(homePetLine(base)).toBe(homePetLine({ ...base }));
  });

  it("welcomes a returning person without counting what was missed", () => {
    const line = homePetLine({ ...base, returning: true });
    expect(line).toMatch(/back|missed you|easy/i);
    expect(line).not.toMatch(/\d+ days?|skipped|missed (a|your)|behind/i);
  });

  it("follows the voice the person chose, and falls back to warm", () => {
    const warm = homePetLine({ ...base, voice: "warm" });
    const gentle = homePetLine({ ...base, voice: "gentle" });
    const plain = homePetLine({ ...base, voice: "plain" });
    expect(homePetLine(base)).toBe(warm);
    expect(homePetLine({ ...base, voice: "shouty" as any })).toBe(warm);
    expect(new Set([warm, gentle, plain]).size).toBe(3);
    for (const voice of ["gentle", "plain", "warm"] as const) {
      for (const energy of ["exhausted", "anxious"] as const) {
        expect(homePetLine({ ...base, voice, energy })).not.toMatch(/\b(should|must|missed|behind|lazy)\b/i);
      }
      expect(homePetLine({ ...base, voice, done: 2 })).toMatch(/2|done|progress|noticed|kind/i);
    }
  });

  it("celebrates once everything is done", () => {
    expect(homePetLine({ ...base, done: 4 })).toMatch(/together|done|proud|yours/i);
  });

  it("goes small and soft on a drained or on-edge day", () => {
    for (const energy of ["exhausted", "anxious"] as const) {
      const line = homePetLine({ ...base, energy });
      expect(line).toMatch(/slow|small|tiny|simple|breathe|one thing|rest/i);
    }
  });

  it("mentions the person's focus in the morning when one was chosen", () => {
    const lines = new Set<string>();
    for (let day = 1; day <= 30; day += 1) lines.add(homePetLine({ ...base, focus: "Sleep", seed: `2026-10-${day}` }));
    expect([...lines].some((line) => line.includes("sleep"))).toBe(true);
  });

  it("never shames or scolds in any situation", () => {
    const shame = /lazy|fail|should have|disappoint|broke|lost your|streak/i;
    const phases = ["dawn", "morning", "day", "golden", "dusk", "night"] as const;
    const energies = [null, "exhausted", "anxious", "calm", "energized"] as const;
    for (const phase of phases)
      for (const energy of energies)
        for (const done of [0, 1, 4])
          for (let day = 1; day <= 6; day += 1) {
            expect(homePetLine({ ...base, phase, energy, done, seed: `d${day}` })).not.toMatch(shame);
          }
  });
});

describe("careDoneLine", () => {
  it("shows Sprouts only when some were earned", () => {
    expect(careDoneLine("Biscuit", 2, 1)).toMatch(/\+2 Sprouts/);
    expect(careDoneLine("Biscuit", 0, 1)).not.toMatch(/Sprouts/);
  });
});

describe("energy options", () => {
  it("covers the four states of the strategy's energy slider, each with a pet mood", () => {
    expect(ENERGY_OPTIONS.map((option) => option.id)).toEqual(["exhausted", "anxious", "calm", "energized"]);
    expect(energyOption("calm")?.label).toBe("Steady");
    expect(energyOption(null)).toBeNull();
  });

  it("treats drained and on-edge as gentle days", () => {
    expect(isGentleEnergy("exhausted")).toBe(true);
    expect(isGentleEnergy("anxious")).toBe(true);
    expect(isGentleEnergy("calm")).toBe(false);
    expect(isGentleEnergy(null)).toBe(false);
  });

  it("uses Ionicons glyphs that exist", () => {
    const glyphs = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"),
        "utf8"
      )
    );
    for (const option of ENERGY_OPTIONS) expect(glyphs[option.icon]).toBeDefined();
  });
});
