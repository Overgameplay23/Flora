// The Wardrobe migration (local-backend/sql/wardrobe_v1.sql) against the catalog the app draws
// (src/domain/wardrobe/catalog.ts): the seed must carry every item with the same id, name, slot, category, price,
// rarity, species and collection, in catalog order, and nothing else. Also guards the parts of the migration a
// reviewer would otherwise check by eye: no cycle-named objects, explicit RPC grants, one shared spending lock,
// and a regenerated CLI migration. The behaviour itself (buying, equipping, isolation) is pgTAP:
// local-backend/supabase/tests/05_wardrobe.test.sql.
import fs from "fs";
import path from "path";
import { WARDROBE_ITEMS } from "../domain/wardrobe/catalog";

const MOBILE = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(MOBILE, rel), "utf8").replace(/\r\n/g, "\n");

const SOURCE = "local-backend/sql/wardrobe_v1.sql";
const MIGRATION = "20261016014418_wardrobe_v1.sql";
const SQL = read(SOURCE);
// the SQL without comments (no string literal in this file contains "--")
const CODE = SQL.replace(/--[^\n]*/g, "");

type SqlValue = string | number | boolean | null | string[];

/** Parses the VALUES list of a plain multi-row insert: quoted strings, integers, booleans, null, array['a', 'b']. */
function parseValues(src: string): SqlValue[][] {
  let i = 0;
  const fail = (what: string): never => {
    throw new Error(`${what} at: ${src.slice(i, i + 40)}`);
  };
  const skip = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };
  const quoted = (): string => {
    let out = "";
    i++; // opening quote
    for (;;) {
      if (i >= src.length) fail("unterminated string");
      if (src[i] === "'") {
        if (src[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        i++;
        return out;
      }
      out += src[i++];
    }
  };
  const value = (): SqlValue => {
    skip();
    if (src[i] === "'") return quoted();
    const array = /^array\s*\[/i.exec(src.slice(i));
    if (array) {
      i += array[0].length;
      const items: string[] = [];
      for (;;) {
        skip();
        if (src[i] === "]") {
          i++;
          return items;
        }
        if (src[i] !== "'") fail("expected a quoted array element");
        items.push(quoted());
        skip();
        if (src[i] === ",") i++;
      }
    }
    const word = /^[A-Za-z0-9_.-]+/.exec(src.slice(i))?.[0];
    if (!word) return fail("unexpected token");
    i += word.length;
    const lower = word.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
    if (lower === "null") return null;
    if (/^-?\d+$/.test(word)) return Number(word);
    return fail(`unsupported literal ${word}`);
  };

  const rows: SqlValue[][] = [];
  for (;;) {
    skip();
    if (i >= src.length) return rows;
    if (src[i] !== "(") fail("expected a row");
    i++;
    const row: SqlValue[] = [];
    for (;;) {
      row.push(value());
      skip();
      if (src[i] === ",") {
        i++;
        continue;
      }
      if (src[i] === ")") {
        i++;
        break;
      }
      fail("expected , or )");
    }
    rows.push(row);
    skip();
    if (src[i] === ",") i++;
  }
}

function seedRows(): Array<Record<string, SqlValue>> {
  const match = /insert into public\.wardrobe_items \(([^)]*)\)\s*values([\s\S]*?)\non conflict \(id\) do update/i.exec(CODE);
  if (!match) throw new Error("wardrobe_items seed not found");
  const columns = match[1].split(",").map((c) => c.trim());
  return parseValues(match[2]).map((row) => {
    if (row.length !== columns.length) throw new Error(`seed row ${String(row[0])} has ${row.length} values for ${columns.length} columns`);
    return Object.fromEntries(columns.map((c, n) => [c, row[n]]));
  });
}

/** The text of one `create or replace function public.<name>(...) ... $$;` block. */
function functionBlock(name: string): string {
  const start = CODE.indexOf(`create or replace function public.${name}(`);
  if (start < 0) throw new Error(`function ${name} not found`);
  const bodyStart = CODE.indexOf("$$", start);
  const bodyEnd = CODE.indexOf("$$;", bodyStart + 2);
  return CODE.slice(start, bodyEnd + 3);
}

describe("wardrobe_v1.sql", () => {
  const rows = seedRows();

  it("seeds every catalog item exactly once, and nothing else", () => {
    expect(WARDROBE_ITEMS.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.map((r) => r.id)).toEqual(WARDROBE_ITEMS.map((item) => item.id));
  });

  it("matches the catalog field by field, in catalog order", () => {
    WARDROBE_ITEMS.forEach((item, index) => {
      expect(rows[index]).toEqual({
        id: item.id,
        name: item.name,
        slot: item.slot,
        category: item.category,
        price_sprouts: item.priceSprouts,
        rarity: item.rarity,
        species: item.species,
        collection: item.collection,
        premium: Boolean(item.premium),
        sort: index + 1,
      });
    });
  });

  it("only uses slots the database accepts and prices it can store", () => {
    expect(CODE).toMatch(/check \(slot in \('head', 'face', 'neck'\)\)/);
    expect(CODE).toMatch(/check \(price_sprouts >= 0\)/);
    for (const row of rows) {
      expect(["head", "face", "neck"]).toContain(row.slot);
      expect(Number.isInteger(row.price_sprouts) && (row.price_sprouts as number) >= 0).toBe(true);
    }
  });

  it("can be re-run: the seed upserts by id and every table is created only if missing", () => {
    expect(CODE).toMatch(/on conflict \(id\) do update/);
    const creates = CODE.match(/create table [^(]+/g) ?? [];
    expect(creates.length).toBe(4);
    for (const statement of creates) expect(statement).toMatch(/^create table if not exists public\./);
  });

  it("names nothing for cycle data (the database must have nowhere to put it)", () => {
    const forbidden = /cycle|menstru|period|ovulat|fertil|luteal|follicul/i;
    const identifiers = CODE.replace(/'(?:[^']|'')*'/g, "''").match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    expect(identifiers.filter((id) => forbidden.test(id))).toEqual([]);
    expect(forbidden.test(CODE)).toBe(false); // seeded values too
  });

  it("grants both RPCs to signed-in users explicitly and to nobody without a session", () => {
    for (const signature of ["public.buy_wardrobe_item(text)", "public.equip_outfit(jsonb, jsonb)"]) {
      const escaped = signature.replace(/[.()]/g, "\\$&");
      expect(CODE).toMatch(new RegExp(`revoke execute on function ${escaped} from public, anon;`));
      expect(CODE).toMatch(new RegExp(`grant execute on function ${escaped} to authenticated, service_role;`));
    }
    // the redefined garden RPCs keep their grants; the balance helper (takes any user id) is not callable by the app
    expect(CODE).toMatch(/grant execute on function public\.get_garden_points\(\) to authenticated/);
    expect(CODE).toMatch(/grant execute on function public\.upgrade_plant\(text\) to authenticated/);
    expect(CODE).toMatch(/revoke execute on function public\.points_balance\(uuid\) from public, anon, authenticated;/);
    expect(CODE).not.toMatch(/grant execute on function public\.points_balance/);
  });

  it("runs every RPC as SECURITY DEFINER with search_path pinned", () => {
    for (const name of ["buy_wardrobe_item", "equip_outfit", "get_garden_points", "upgrade_plant"]) {
      const block = functionBlock(name);
      expect({ name, definer: /\bsecurity definer\b/.test(block) }).toEqual({ name, definer: true });
      expect({ name, pinned: /set search_path = public/.test(block) }).toEqual({ name, pinned: true });
      expect({ name, checksSession: /raise exception 'Not authenticated'/.test(block) }).toEqual({ name, checksSession: true });
    }
    expect(functionBlock("points_balance")).toMatch(/set search_path = public/);
  });

  it("serializes plant and wardrobe spending on the same per-user lock and one balance", () => {
    const lock = "perform pg_advisory_xact_lock(hashtext(v_user_id::text));";
    expect(functionBlock("buy_wardrobe_item")).toContain(lock);
    expect(functionBlock("upgrade_plant")).toContain(lock);
    const balance = functionBlock("points_balance");
    for (const table of ["task_completions", "user_plant_upgrades", "wardrobe_purchases"]) expect(balance).toContain(`public.${table}`);
    for (const name of ["get_garden_points", "upgrade_plant", "buy_wardrobe_item"]) {
      expect(functionBlock(name)).toContain("public.points_balance(v_user_id)");
    }
    expect(functionBlock("buy_wardrobe_item")).toContain("raise exception 'Not enough points'");
  });

  it("is in the plan, applied after what it builds on, and its generated copy is current", () => {
    const builder = read("local-backend/build-migrations.js");
    const plan = new Map([...builder.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map((m) => [m[1], m[2]] as [string, string]));
    expect(plan.get(SOURCE)).toBe(MIGRATION);
    // the CLI applies by file name, so it must sort after the garden RPCs it redefines and the rules it keeps;
    // later migrations (plan_engine_v1.sql, for one) may follow it in the plan
    for (const base of [
      "supabase/migrations/2026_02_23_garden_upgrade_system.sql",
      "local-backend/sql/rls_owner_policies.sql",
      "local-backend/sql/function_grants.sql",
      "local-backend/sql/pin_function_search_path.sql",
    ]) {
      expect({ base, before: (plan.get(base) ?? "~") < MIGRATION }).toEqual({ base, before: true });
    }
    const generated = read(`local-backend/supabase/migrations/${MIGRATION}`);
    expect(generated).toMatch(new RegExp(`^-- GENERATED by local-backend/build-migrations\\.js.*\\n-- source: ${SOURCE.replace(/[.]/g, "\\.")}\\n`));
    // the body after the three-line header is the source (line endings aside: git may check out CRLF)
    expect(generated.split("\n").slice(4).join("\n")).toBe(SQL);
  });
});
