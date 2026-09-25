#!/usr/bin/env node
// Seeds ONE demo account into the LOCAL Supabase stack so the app has something to show.
// Everything is done as the signed-in demo user through the same tables, RPCs and storage
// policies the app uses, so this doubles as a smoke test of the rebuilt schema.
// It never talks to a hosted project: it refuses to run unless .env.local points at a private address.
//
// The demo pet is repo sample art: the full-body sitting puppy from assets/pet.png, cut out locally by
// local-backend/demo-pet.js. It stands in for the output of the pet-stylize Edge Function, which cannot
// run locally without Gemini / background-removal provider keys.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { createClient } = require("@supabase/supabase-js");
const { buildDemoPet } = require("./demo-pet");

const mobileRoot = path.resolve(__dirname, "..");
const DEMO_EMAIL = "demo@floura.local";
const DEMO_PASSWORD = "floura-demo"; // local throwaway fixture, documented in local-backend/README.md
const PET_NAME = "Biscuit";

function readEnvLocal() {
  const file = path.join(mobileRoot, ".env.local");
  if (!fs.existsSync(file)) throw new Error("Missing .env.local. Run: npm run backend:env");
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function assertLocal(url) {
  const host = new URL(url).hostname;
  const isPrivate =
    host === "localhost" ||
    host === "127.0.0.1" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (!isPrivate) throw new Error(`Refusing to seed a non-local Supabase URL (${host}).`);
}

const pad = (n) => String(n).padStart(2, "0");
const localKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function must(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message || JSON.stringify(result.error)}`);
  return result.data;
}

async function main() {
  const env = readEnvLocal();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  assertLocal(url);
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Account: sign up (confirmations are off locally) or sign in if it already exists.
  let { data: auth, error: signUpError } = await supabase.auth.signUp({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (signUpError || !auth.session) {
    auth = await must("sign in", supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD }));
  }
  const user = auth.user;
  console.log("demo user ready");

  // 2) Profile, exactly as AuthContext creates it (fires the DB trigger that seeds 3 tasks).
  await must(
    "profiles upsert",
    supabase.from("profiles").upsert(
      { user_id: user.id, email: DEMO_EMAIL, streak_count: 0, xp: 0, garden_level: 1, last_checkin_date: null },
      { onConflict: "user_id" }
    )
  );
  await must("user_stats upsert", supabase.from("user_stats").upsert({ user_id: user.id }, { onConflict: "user_id" }));

  // 3) Pet images through the user's own storage policies.
  const source = path.join(mobileRoot, "assets", "pet.png");
  const original = await sharp(source).resize({ width: 1024 }).png().toBuffer();
  const cutout = await buildDemoPet({ height: 640 });
  const bucket = supabase.storage.from("pets");
  const originalPath = `original/${user.id}.png`;
  await must("upload original", bucket.upload(originalPath, original, { contentType: "image/png", upsert: true }));
  for (const name of ["stylized.png", "cutout.png"]) {
    await must(`upload ${name}`, bucket.upload(`processed/${user.id}/${name}`, cutout, { contentType: "image/png", upsert: true }));
  }
  const signed = await must("sign original", bucket.createSignedUrl(originalPath, 60 * 60 * 24 * 365));
  const stamp = Date.now();
  const stylizedUrl = `${bucket.getPublicUrl(`processed/${user.id}/stylized.png`).data.publicUrl}?t=${stamp}`;
  const cutoutUrl = `${bucket.getPublicUrl(`processed/${user.id}/cutout.png`).data.publicUrl}?t=${stamp}`;

  await must(
    "pet upsert",
    supabase.from("pet").upsert(
      {
        user_id: user.id,
        state: "idle",
        photo_url: stylizedUrl,
        original_photo_url: signed.signedUrl,
        stylized_url: stylizedUrl,
        cutout_url: cutoutUrl,
        processing_status: "ready",
        processing_error: null,
        pet_name: PET_NAME,
      },
      { onConflict: "user_id" }
    )
  );
  console.log("pet images uploaded and pet row saved");

  // 4) A week of gentle activity through the real RPCs (UTC noon of each local day).
  const tasks = await must("tasks", supabase.from("tasks").select("id,title").eq("user_id", user.id).order("sort_order"));
  let completions = 0;
  const DAYS = 16;
  for (let back = DAYS - 1; back >= 0; back--) {
    const day = daysAgo(back);
    const stampIso = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0)).toISOString();
    const todays = back === 0 ? tasks.slice(0, 1) : tasks; // leave two tasks open today
    for (const task of todays) {
      const rows = await must(
        "complete_task",
        supabase.rpc("complete_task", { task_id: String(task.id), completed_at: stampIso })
      );
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (row && row.inserted) {
        completions++;
        await must(
          "log task_completed",
          supabase.rpc("log_event_and_rollup", {
            p_event_type: "task_completed",
            p_occurred_at: stampIso,
            p_task_id: null,
            p_category: null,
            p_difficulty: null,
            p_points: row.points_awarded,
            p_meta: { source: "local-demo-seed" },
          })
        );
      }
    }

    const key = localKey(day);
    const mood = [3, 4, 3, 2, 4, 4, 5][(DAYS - 1 - back) % 7];
    const wins = [
      "Took a slow walk after lunch.",
      "Called my sister.",
      "Drank water before coffee.",
      "Rested when I needed to.",
      "Finished the thing I was avoiding.",
      "Cooked dinner at home.",
      "Morning stretch in the sun.",
    ];
    const existing = await must(
      "checkin lookup",
      supabase.from("checkins").select("id").eq("user_id", user.id).eq("date", key).limit(1)
    );
    await must(
      "checkin upsert",
      supabase.from("checkins").upsert(
        { user_id: user.id, date: key, mood_score: mood, win_text: wins[(DAYS - 1 - back) % 7], checkin_date: key, mood, note: wins[(DAYS - 1 - back) % 7] },
        { onConflict: "user_id,date" }
      )
    );
    if (!existing.length) {
      await must(
        "log checkin",
        supabase.rpc("log_event_and_rollup", {
          p_event_type: "checkin_submitted",
          p_occurred_at: stampIso,
          p_task_id: null,
          p_category: null,
          p_difficulty: null,
          p_points: 0,
          p_meta: { source: "local-demo-seed" },
        })
      );
    }
  }
  console.log(`activity seeded (${completions} new task completions)`);

  // 5) Habits (the app seeds these defaults on first open; do the same) and two done today.
  const habitTitles = ["Drink water", "Move your body", "Fresh air break", "Kind message", "Tidy a corner"];
  let habits = await must("habits", supabase.from("habits").select("id,title").eq("user_id", user.id).order("sort_order"));
  if (!habits.length) {
    habits = await must(
      "habits insert",
      supabase.from("habits").insert(habitTitles.map((title, i) => ({ user_id: user.id, title, active: true, sort_order: i }))).select("id,title")
    );
  }
  const today = localKey(new Date());
  for (const habit of habits.slice(0, 2)) {
    await must(
      "habit completion",
      supabase.from("habit_completions").upsert(
        { user_id: user.id, habit_id: habit.id, date: today, completed: true },
        { onConflict: "user_id,habit_id,date" }
      )
    );
  }

  // 6) Streak stores the client reads.
  await must(
    "user_stats",
    supabase.from("user_stats").update({ streak: 7, last_completed_date: today, pet_mood_state: "happy" }).eq("user_id", user.id)
  );
  await must(
    "profiles streak + pet photo",
    supabase
      .from("profiles")
      .update({ pet_photo_url: signed.signedUrl, current_streak: 7, best_streak: 7, streak_count: 7, last_checkin_date: today })
      .eq("user_id", user.id)
  );
  await must("recompute_pet_state", supabase.rpc("recompute_pet_state"));

  // 7) Spend points through the atomic RPC so the garden shows three growth stages:
  //    bamboo in bloom, cactus as a sprout, lavender freshly planted.
  const targets = [["bamboo", 4], ["cactus", 3], ["lavender", 1]];
  for (const [plantId, targetLevel] of targets) {
    for (let guard = 0; guard < 10; guard++) {
      const ownedRows = await must("user_plants", supabase.from("user_plants").select("plant_id,level").eq("plant_id", plantId));
      const level = ownedRows.length ? ownedRows[0].level : 0;
      if (level >= targetLevel) break;
      const { error } = await supabase.rpc("upgrade_plant", { p_plant_id: plantId });
      if (error) {
        console.log(`stopped growing ${plantId} at level ${level}: ${error.message}`);
        break;
      }
    }
  }
  const garden = await must("user_plants", supabase.from("user_plants").select("plant_id,level").order("purchased_at"));
  console.log("garden:", garden.map((row) => `${row.plant_id} L${row.level}`).join(", "));
  const points = await must("get_garden_points", supabase.rpc("get_garden_points"));
  console.log("garden points:", JSON.stringify(Array.isArray(points) ? points[0] : points));

  // 8) Session for local browser automation only (gitignored).
  const fresh = await must("session", supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD }));
  const host = new URL(url).hostname.split(".")[0];
  fs.writeFileSync(
    path.join(__dirname, ".demo-session.json"),
    JSON.stringify({ storageKey: `sb-${host}-auth-token`, session: fresh.session }, null, 1)
  );
  console.log("done. Demo login:", DEMO_EMAIL, "(password in local-backend/README.md)");
}

main().catch((error) => {
  console.error("SEED FAILED:", error.message);
  process.exit(1);
});
