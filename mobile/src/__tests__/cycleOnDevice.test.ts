// The cycle tracker is a device-only feature (src/services/cycleStore.ts): nothing about a person's cycle is
// written to Supabase or sent to a provider. These guards fail if that quietly changes, so the change gets a
// deliberate owner decision (docs/dev-notes.md) instead. The database side is guarded by
// local-backend/supabase/tests/04_cycle_stays_on_device.test.sql.
import fs from "fs";
import path from "path";
import { talkContextPayload } from "../domain/petTalk";

const MOBILE = path.resolve(__dirname, "..", "..");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" || entry.name === "node_modules" ? [] : sourceFiles(full);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const files = [...sourceFiles(path.join(MOBILE, "app")), ...sourceFiles(path.join(MOBILE, "src"))];
const rel = (file: string) => path.relative(MOBILE, file).split(path.sep).join("/");
const read = (file: string) => fs.readFileSync(file, "utf8");

describe("cycle data stays on the device", () => {
  it("is read only by the tracker's own hook and the screens that show it", () => {
    const readers = files
      .filter((file) => /from\s+["'][^"']*(services\/cycleStore|hooks\/useCycle)["']/.test(read(file)))
      .map(rel)
      .sort();
    // Adding a reader here is fine for display; if it also talks to the backend, ask the owner first.
    expect(readers).toEqual([
      "app/screens/HomeScreen.js",
      "app/screens/ProfileScreen.js",
      "src/hooks/useCycle.ts",
      "src/screens/CycleScreen.tsx",
      "src/screens/PetTalkScreen.tsx",
    ]);
  });

  it("has a store that never touches the network", () => {
    const store = read(path.join(MOBILE, "src/services/cycleStore.ts"));
    expect(store).not.toMatch(/lib\/supabase|netFetch|fetch\(|functions\.invoke|\.rpc\(|\.from\(/);
    expect(store).toMatch(/AsyncStorage/);
  });

  it("reaches pet-talk only as an on/off flag (flagged for the owner in docs/dev-notes.md)", () => {
    const payload = talkContextPayload({
      petName: "Biscuit",
      cycleAware: true,
      // anything cycle-shaped a caller might pass by mistake must not ride along
      cycle: { lastPeriodStart: "2026-09-01", phase: "luteal", cycleDay: 21 },
      phase: "luteal",
    } as any);
    expect(payload.cycleAware).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/period|phase|luteal|follicular|ovulat|cycleDay|menstru/i);
  });
});
