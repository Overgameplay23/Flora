// Seed data is split on purpose (docs/backend/DEPLOY.md, "Seed data"):
//   - the demo seed (local-backend/seed-demo.js, `npm run backend:seed`) is local-only;
//   - staging needs no seed: the reference data it needs ships inside the migrations `backend:push` applies.
// These guards fail if demo accounts or secrets drift into anything that reaches a hosted project.
import fs from "fs";
import path from "path";

const MOBILE = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(MOBILE, rel), "utf8");
const sqlIn = (dir: string) =>
  fs.existsSync(path.join(MOBILE, dir))
    ? fs.readdirSync(path.join(MOBILE, dir)).filter((f) => f.endsWith(".sql")).map((f) => `${dir}/${f}`)
    : [];

// everything `npm run backend:push` sends, plus the sources it is generated from
const pushed = [
  ...sqlIn("supabase").filter((f) => /schema_.*\.sql$/.test(f)),
  ...sqlIn("supabase/migrations"),
  ...sqlIn("local-backend/sql"),
  ...sqlIn("local-backend/supabase/migrations"),
];

const seedSource = read("local-backend/seed-demo.js");
const demoEmail = seedSource.match(/DEMO_EMAIL = "([^"]+)"/)?.[1] as string;
const demoPassword = seedSource.match(/DEMO_PASSWORD = "([^"]+)"/)?.[1] as string;

describe("seed separation", () => {
  it("finds the migrations it is guarding", () => {
    expect(sqlIn("local-backend/supabase/migrations").length).toBeGreaterThanOrEqual(27);
    expect(demoEmail).toMatch(/@/);
    expect(demoPassword).toBeTruthy();
  });

  it("pushes no accounts, no demo credentials and no keys in any migration", () => {
    for (const file of pushed) {
      const sql = read(file);
      expect({ file, authInsert: /insert\s+into\s+auth\./i.test(sql) }).toEqual({ file, authInsert: false });
      expect({ file, demo: sql.includes(demoEmail) || sql.includes(demoPassword) }).toEqual({ file, demo: false });
      expect({ file, key: /eyJ[A-Za-z0-9_-]{20,}\.|sb_secret_|sb_publishable_/.test(sql) }).toEqual({ file, key: false });
    }
  });

  it("keeps the CLI's own seed hook empty and off, so `db push --include-seed` cannot load demo data", () => {
    expect(fs.existsSync(path.join(MOBILE, "local-backend/supabase/seed.sql"))).toBe(false);
    expect(read("local-backend/supabase/config.toml")).toMatch(/\[db\.seed\]\s*\nenabled = false/);
  });

  it("ships the reference data staging needs inside the migrations", () => {
    const all = pushed.map(read).join("\n");
    expect(all).toMatch(/insert\s+into\s+public\.plant_catalog/i);
    expect(all).toMatch(/insert\s+into\s+public\.garden_items/i);
    expect(all).toMatch(/create trigger profiles_seed_tasks/i); // three default tasks per new user
  });

  it("runs the demo seed against the local stack only", () => {
    expect(seedSource).toMatch(/\.env\.local/);
    expect(seedSource).not.toMatch(/\.env\.staging/);
    expect(seedSource).toMatch(/protocol !== "http:"/);
    const guard = seedSource.indexOf("assertLocal(url)");
    const signUp = seedSource.indexOf("auth.signUp(");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(signUp);
  });
});
