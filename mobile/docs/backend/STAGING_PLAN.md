# Luna: hosted Supabase staging plan

Prepared **27 September 2026** at commit `d6f1cb5`. This is a read-only audit of the local stack in
`local-backend/`, which has been the source of truth since the original hosted project
(`gghesvpmskjlrlpoosgf`) was deleted with no backup. **Nothing was deployed, created or changed remotely.**
Every step in section 6 needs Donovan's approval at the time it runs (HANDOFF §10).

> **Status, 27 Sep 2026 (branch `backend/hardening`, not merged or pushed):** P0 #1 (function grants), P1 #6
> (private bucket and signed URLs, minus storage cleanup on user deletion), P1 #7 except `completed_at` and
> `p_points` (R-40 still open), P1 #8 and P1 #11 are done locally, as migrations 25–27 plus pgTAP tests in
> `local-backend/supabase/tests/`. Evidence: `docs/RESTORATION_BASELINE.md` 6.29. Judgment calls:
> `docs/dev-notes.md`, 2026-09-27. Correction: `tasks` has no `points` column, so the "tasks.points" items
> below were wrong.
>
> **Deploy runbook:** [`DEPLOY.md`](DEPLOY.md) replaces section 6 below. It covers the local/staging profiles, the
> `backend:link` / `backend:push` / `functions:deploy` / `functions:secrets` scripts, the exact order for a fresh
> project, seeds and backups.

"Verified" below means it was run against the freshly reset local database today. "Inferred" means it was
read from code and not executed.

---

## 0. Verdict

| Question | Answer |
|---|---|
| Do the migrations apply from zero? | **Yes.** `supabase db reset` applied all 24 in order, exit 0. The only messages were idempotency NOTICEs. |
| Is any table readable or writable by another user? | **No.** All 22 `public` tables have RLS on with owner-only policies. A two-user plus anon probe could not read, change, plant or re-parent another user's rows (verified). |
| Anything exposed beyond its owner? | **Yes, two things.** (1) `anon` can call `consume_pet_chat_quota` for any user id (verified over REST). (2) The `pets` photo bucket is public, so every pet photo is readable by anyone who has its URL. |
| Can owners cheat their own numbers? | **Yes.** Garden points, plant levels, streaks and the pet-stylize rate limit are all writable by the owner (verified). This matters for fairness and cost, not for privacy. |
| Is anything local-only baked into the migrations? | **No demo users, passwords or keys in the migrations.** The demo account lives only in `local-backend/seed-demo.js`, which refuses non-local URLs. But one migration creates the photo bucket as **public**, and the local `config.toml` must not be pushed as-is. |
| Ready for staging? | **After the P0 fixes in section 5.** They are one small forward migration plus deliberate dashboard settings. The P1 items should land before any tester uploads a real pet photo or writes a real journal entry. |

---

## 1. Migrations from zero

**Command:** `npm run backend:start`, then `supabase db reset --workdir local-backend`. Supabase CLI 2.67.1,
Postgres 17.

**Result:**
- Exit 0. All 24 migrations were recorded in `supabase_migrations.schema_migrations`, from `20250101000000` through `20260925000200`.
- No errors or warnings.
- About 100 NOTICEs, all of the form "already exists, skipping" or "does not exist, skipping".
- `backend:start` regenerated the 24 files byte-identical: the git tree stayed clean.

**Ordering: nothing breaks, but four things to know.**

1. **Push from `local-backend/`, never from `mobile/`.**
   - The CLI's default folder, `mobile/supabase/migrations/`, holds the 12 *original* files, named `2025_12_31_*.sql`. The CLI reads those as versions `2025` and `2026` (baseline R-note), so they collide.
   - That folder is also missing the 6 bootstrap schemas and the 6 restoration forward fixes.
   - A `supabase db push` run from `mobile/` would therefore misapply or fail. Always pass `--workdir local-backend`.
2. **The history overlaps.**
   - `stabilize_schema` and `daily_loop_schema_fix` re-declare tables, columns and indexes that the bootstrap files already created. They apply cleanly only because they use `IF NOT EXISTS`.
   - `complete_task`, `log_event_and_rollup`, `recompute_pet_state` and `consume_pet_chat_quota` are each redefined 2 or 3 times. The last definition wins.
   - No stale overloads remain: I checked, and there is exactly one signature per RPC, with defaults intact.
3. **Two dedupe `DELETE`s** sit in the chain: `20251231000100` line 21 on `checkins`, and `20260217000200` line 60 on `task_completions`. They are harmless on an empty project. Never replay the chain against a database that holds data.
4. **The generated files are regenerated on every `backend:start`.**
   - The CLI does not checksum migrations it has already applied. If a source SQL file is edited after staging is pushed, the local file changes but staging does not, and the two drift silently.
   - Rule: once staging exists, the 24 files are frozen. Every change is a *new* forward migration in `local-backend/sql/`, added to `build-migrations.js`.

---

## 2. Inventory

### 2.1 Tables (22 in `public`)

| Table | Purpose | Written by | Status |
|---|---|---|---|
| `profiles` | email, streak/xp counters, `pet_photo_url`, last reflection week | client upsert on first sign-in (`AuthContext.js:126`) and client updates | live |
| `pet` | name, species, `look` (vector rig), photo URLs, processing status, memorial | client upsert (`petService.js`) | live |
| `checkins` | daily mood 1–5, win text, note | client upsert (`dailyLoop.ts:227`) | live |
| `tasks` | 3 seeded per user by trigger; title, `points` | trigger `profiles_seed_tasks`; client edits title/points | live |
| `task_completions` | one row per task per local day, `points` | `complete_task` RPC (client never writes directly) | live |
| `habits`, `habit_completions` | habit list and daily ticks | client | live |
| `user_stats` | client-computed streak and pet mood | client upsert/update | live (one of three streak stores, R-27) |
| `plant_catalog` | 10 plants, costs (seeded by migration) | migration only | live catalog |
| `user_plants` | owned plants and level | `upgrade_plant` RPC | live |
| `user_plant_upgrades` | upgrade ledger | `upgrade_plant` RPC | live |
| `journal_entries` | device-first journal, mirrored | client insert/delete (`journalStore.ts`) | live |
| `user_events` | event log (task, check-in, play) | `log_event_and_rollup` RPC | live |
| `daily_user_metrics` | per-day rollup | `log_event_and_rollup` RPC | live |
| `pet_state` | server streak and mood | `recompute_pet_state` RPC | live (the canonical streak on screen) |
| `pet_chat_usage` | per-user daily chat counter | `consume_pet_chat_quota` (service role, from pet-talk) | needed by pet-talk |
| `pet_stylize_requests` | stylize rate limit and cache hash | pet-stylize function | only if the painted portrait is kept |
| `user_memories` | memories injected into the old chat | pet-chat / weekly-summary | legacy |
| `weekly_summaries` | LLM weekly summaries | weekly-summary | legacy, no caller |
| `garden_items`, `garden_unlocks` | old streak-unlock economy (5 items seeded) | client (`PlantStoreScreen`, unreachable) | legacy |
| `garden_plants` | old garden | nothing found | legacy, unused |

**User deletion.** Every `user_id` foreign key is `ON DELETE CASCADE`, so deleting a test user in the
dashboard removes their rows. Their storage objects are **not** removed.

**Views:** none.

### 2.2 Functions (all `public`)

| Function | Security | Callable by (verified ACL) | Guard | Called from |
|---|---|---|---|---|
| `complete_task(task_id, completed_at, local_date)` | DEFINER, `search_path=public` | anon, authenticated | raises if `auth.uid()` is null | `taskCompletion.ts:179` |
| `get_garden_points()` | DEFINER | anon, authenticated | same | `garden.ts:72` |
| `upgrade_plant(p_plant_id)` | DEFINER | anon, authenticated | same | `garden.ts:83` |
| `log_event_and_rollup(… p_points, p_meta, p_local_day)` | DEFINER | anon, authenticated | same | `retention.ts:103`, `playStats.ts:77` |
| `recompute_pet_state(p_today)` | DEFINER | anon, authenticated | same | `retention.ts:149` |
| **`consume_pet_chat_quota(p_user_id, p_usage_date, p_max)`** | DEFINER | **anon**, service_role | **none: trusts `p_user_id` and `p_max`** | pet-talk, pet-chat (service role) |
| `clamp_local_day(date, timestamptz)` | invoker | anon, authenticated | n/a (pure) | inside RPCs |
| `seed_default_tasks()` | invoker (trigger) | all | n/a | trigger on `profiles` insert |
| `set_updated_at()` | invoker (trigger) | all | n/a | 8 `updated_at` triggers |

**Why anon can call everything.** The migrations run `revoke … from public`, then `grant … to authenticated`.
But Supabase's default privileges had already granted EXECUTE to `anon` explicitly when each function was
created, and revoking from `public` does not remove that grant. The same default gives `anon` full
SELECT/INSERT/UPDATE/DELETE on all 22 tables, so RLS is the only barrier. It holds today, but there is no
second layer behind it.

**Triggers:** `profiles_seed_tasks` (after insert on `profiles`) plus the 8 `set_updated_at` triggers.
**There is no trigger on `auth.users`**, even though `SignupScreen.js:77` says "Profile row is created by a
database trigger". In fact the client creates the profile.

**Extensions:** pgcrypto, uuid-ossp, pg_graphql, pg_net, pg_stat_statements, supabase_vault. These are
Supabase defaults; nothing custom.

### 2.3 Storage

| Bucket | Public | Size / MIME limits | Paths | Used by |
|---|---|---|---|---|
| `pets` | **yes** | none on the bucket (the local stack has a global 50 MiB) | `original/<uid>.<ext>` (the real photo), `processed/<uid>/{stylized,cutout,mask}.png` | `petStylize.js:107,170,177`, `pet-stylize` function (`CACHE_BUCKET = "pets"`) |

**Policies on `storage.objects`:** `pets_{select,insert,update,delete}_own`, for `authenticated` only, and
limited to paths containing the caller's uid (`LIKE 'original/<uid>.%'` or `'processed/<uid>/%'`).

**What that means:** listing and writing are owner-only. **Reading is not**, because a public bucket serves
any object at `/storage/v1/object/public/pets/<path>` without auth.

The client stores a **1-year signed URL** for the original photo (`petStylize.js:11,90`) in `pet.photo_url`,
`pet.original_photo_url` and `profiles.pet_photo_url`. The bucket is public, so the unsigned public path works
too, and the signature protects nothing.

The bucket is created only by `local-backend/sql/restoration_local_compat.sql`.

### 2.4 Edge Functions and secrets

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform. Everything
else must be set with `supabase secrets set`, never in the app or `.env`.

| Function | Deploy to staging? | Secrets it reads | Notes |
|---|---|---|---|
| `pet-talk` | **Yes, once the owner approves OpenAI** | `OPENAI_API_KEY` (required), `OPENAI_MODEL` (default `gpt-4o-mini`), `PET_TALK_MAX_PER_DAY` (30), `PET_TALK_TIMEOUT_MS` (20000); platform `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Checks the user's JWT through `auth.getUser`. Uses `consume_pet_chat_quota`. The client hides the screen until `{ping}` returns `configured: true`. |
| `pet-stylize` | Only if the painted portrait is kept (owner decision) | `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, `GEMINI_BG_REMOVAL_MODEL`, `BACKGROUND_REMOVAL_URL`, `BACKGROUND_REMOVAL_API_KEY`, `BACKGROUND_REMOVAL_AUTH_HEADER`, `BACKGROUND_REMOVAL_PROVIDER` (each also accepted in lower case); platform trio | Writes public URLs into `pets`. Sends the Gemini key as a `?key=` query parameter (`index.ts:1397`). The rate limit can be bypassed (section 3.4). R-16/R-17 lifecycle bugs remain. |
| `pet-chat` | **No.** Retired from the UI on 25 Sep; no route. | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `PROVIDER_PRIMARY`, `PROVIDER_FALLBACK`, `MAX_REQ_PER_DAY`, `REQUEST_TIMEOUT_MS`, `PET_CHAT_ALLOW_FALLBACK_REPLY`; platform trio | R-42/R-43: it harvests and keeps personal disclosures. |
| `weekly-summary` | **No.** Nothing calls it. | same provider set plus `WEEKLY_SUMMARY_ADMIN_SECRET`, `REQUEST_TIMEOUT_MS`; platform trio | R-44/R-45. |
| `cartoonize-pet` | **No.** The folder is empty. | none | Deploy by name only. A bare `supabase functions deploy` would try to deploy every folder. |

There is no `config.toml` next to `mobile/supabase/functions`, so hosted `verify_jwt` stays at its default
(on). That suits pet-talk, which the client calls with a user session.

### 2.5 Auth settings the app depends on

| Setting | Local (`local-backend/supabase/config.toml`) | What the client needs | Staging action |
|---|---|---|---|
| Email/password sign-up | on | `signUp` / `signInWithPassword` only. No OAuth, magic link, reset or account deletion. | enable email provider |
| **Email confirmation** | **off** | The client assumes sign-up returns a session. `SignupScreen.js` has no "check your email" state (R-08). | **Turn off explicitly.** Hosted projects default to on, and sign-up would then dead-end. If it is turned on later, the client needs a confirm state, and the built-in mailer needs custom SMTP (check the dashboard: the default sender is heavily rate-limited). |
| Site URL | `http://127.0.0.1:8081` | unused: no email links are sent while confirmation is off | set to a neutral staging page |
| Redirect URLs | none | none. No `emailRedirectTo` or `redirectTo` anywhere. | leave empty |
| Deep-link scheme | n/a | **`app.json` has no `scheme`**, and the navigator has no `linking`. | none yet. Needed before password reset, magic links or OAuth (waits on app identity). |
| Min password length | 6 | the client doesn't enforce more | 8 or more on staging; leaked-password protection if the plan allows it |
| JWT expiry / refresh rotation | 3600 s / on | defaults | defaults |
| Profile creation | no `auth.users` trigger | client upsert on first hydrate | keep as-is for staging (open owner decision, HANDOFF §11) |

### 2.6 What the client hard-codes, and its environment

**No project URL or key is hard-coded in runtime code.** The web bundle built by today's `npm run check`
contains no `service_role`, no `sb_secret_` and no `gghesvpmskjlrlpoosgf` (scanned for presence only).

| Item | Where | Staging impact |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `src/utils/env.ts:15-17` (static, inlined at build) | the only two values staging needs in the app |
| `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL` (optional) | `petStylize.js:258` | pet-stylize only |
| `EXPO_PUBLIC_PET_TALK_PREVIEW` | `petTalk.ts:7` | **must be unset in any real build** (it fakes replies) |
| Fallback `https://invalid.supabase.co` / `"invalid-anon-key"` | `supabase.ts:92-93` | what a build without env talks to |
| Env files | `.env` still names the dead project (presence only). `.env.local` (generated by `backend:env`) **overrides** it. | To use staging, the owner edits `.env` **and** moves `.env.local` aside, or the app stays on local. There is no `eas.json`, and `app.json` `extra` placeholders are never read, so a store build currently gets no env at all. |
| Bucket `pets`; paths `original/<uid>.<ext>`, `processed/<uid>/…` | `petStylize.js`, pet-stylize | fixed contract: a private-bucket change must keep or migrate these paths |
| Function names `pet-talk`, `pet-stylize`, `pet-chat` | `petTalk.ts`, `petStylize.js`, `petChat.ts` | deploy under exactly these names |
| Functions URL derivation `.supabase.co` → `.functions.supabase.co` | `petStylize.js:259-261` | works on a standard hosted URL; breaks on the local stack and on custom domains |
| `look://chosen` sentinel in `profiles.pet_photo_url` | `OnboardingScreen.tsx:410` | data convention, keep |
| `https://www.google.com/generate_204` connectivity probe | `net.ts:266` | outbound request on every start |
| Dead project ref | `package.json` `supabase:deploy:*` / `supabase:logs:*` (6 scripts) | they would fail harmlessly; rewrite for staging. There is no pet-talk deploy script. |
| `.env.example` | lists `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` beside the `EXPO_PUBLIC_*` vars | invites putting server secrets in the app's env file. Split the templates. |

---

## 3. RLS audit

### 3.1 Method

1. Read `pg_class.relrowsecurity`, `pg_policies`, `pg_proc.proacl` and the table grants on the reset database.
2. Ran one transaction, **rolled back**, with two synthetic users (A, B) and `anon`:
   - A created a profile, pet, journal entry and check-in, then tried privileged writes.
   - B and anon tried to read and alter A's data.
3. Called `consume_pet_chat_quota` over REST with the local anon key.

No data was kept: `auth.users` held 0 rows before and after.

### 3.2 Per table

Every policy applies to role `public` with `auth.uid() = user_id` unless noted (S/I/U/D = select/insert/update/delete).

| Table | RLS | Owner policies | Beyond owner? | Owner-trust issue |
|---|---|---|---|---|
| `checkins` | on | S I U D | no | none (mood and free text; private) |
| `journal_entries` | on | S I U D | no (verified) | none |
| `pet` | on | S I U D | no (verified) | none; `level`/`state` are cosmetic |
| `profiles` | on | S I U D | no (verified) | streak/xp columns are client-written (verified: xp 999999) |
| `tasks` | on | S I U D | no | none (no `points` column in this schema; `complete_task` awards the default 2) |
| `task_completions` | on | S I U D | no (verified) | **R-37 verified:** a direct insert of `points=100000` → `get_garden_points` = 100000 |
| `user_plants` | on | S I U D | no | **R-38 verified:** a direct insert at `level 99` |
| `user_stats` | on | S I U D | no | streak client-computed by design (R-27) |
| `pet_state` | on | S I U | no | **R-41 verified:** `streak_days 999` |
| `user_events` | on | S I | no | **R-41:** arbitrary events and points (verified insert) |
| `user_memories` | on | S I | no | **R-41:** prompt injection into legacy pet-chat (verified insert) |
| `pet_stylize_requests` | on | S I U | no | the owner can rewind `last_requested_at` and bypass the 45 s stylize limit (see 3.4) |
| `habits`, `habit_completions` | on | S I U D | no | none |
| `garden_plants`, `garden_unlocks` | on | S I U D | no | legacy; unlocks are self-grantable |
| `daily_user_metrics` | on | S | no | writes only through the RPC, but it trusts client `p_points` (R-40) |
| `user_plant_upgrades`, `weekly_summaries`, `pet_chat_usage` | on | S | no | direct inserts are blocked (verified for `pet_chat_usage`, `daily_user_metrics`, `weekly_summaries`) |
| `plant_catalog`, `garden_items` | on | S for everyone (`true`) | public read by design | writes blocked (verified) |

**Cross-user probe (verified).**
- B's reads of `journal_entries`, `checkins`, `pet`, `profiles`, `task_completions` and `user_memories`: **0 rows**.
- B's UPDATE and DELETE of A's rows: **0 rows affected**.
- B's insert as A, and B's re-parenting of B's own row to A: **RLS error**.
- Anon's reads of user tables: **0 rows**.
- Anon's calls to the user RPCs: **"Not authenticated"**.

### 3.3 Exposed beyond the owner

1. **`consume_pet_chat_quota` is callable by anyone (R-39, now verified).**
   - The ACL grants EXECUTE to `anon`, and the function trusts `p_user_id` and `p_max`.
   - In the probe, 30 anonymous calls set a user's counter to 30, and pet-talk's check then returned `allowed = false`. That locks the user out of talking to their pet until the next UTC day.
   - Over REST, a random id returned a foreign-key error, which shows the body ran. It also shows the endpoint can tell real user ids from fake ones.
   - Fix: revoke EXECUTE from `anon` and `authenticated`, and keep `service_role`.
2. **Pet photos are world-readable by URL (R-13/R-14).**
   - `pets` is a public bucket. `original/<uid>.jpg` is the owner's real photo, and `processed/<uid>/cutout.png` is close to it.
   - Anyone holding the path can fetch it with no auth, and paths are predictable from a user id.
   - It is not verified whether the picker strips EXIF/GPS: `quality 0.6–0.7` re-encodes, but nobody has checked on a device.

### 3.4 Owner-trust gaps (the owner changing their own numbers)

These are not privacy leaks. They let one person inflate their own points or streaks, or run up provider cost.

- **Points:**
  - `task_completions` accepts owner insert/update/delete (R-37).
  - (corrected: `tasks` has no `points` column, so this is not a path.)
  - `complete_task` accepts an unbounded `completed_at`, so one completion per task can be farmed per backdated day (R-40).
  - `log_event_and_rollup` trusts `p_points`.
- **Progress:** `user_plants.level` is writable (R-38). `garden_unlocks` is self-grantable.
- **Streaks:** `pet_state`, `user_stats` and the profile streak columns are all owner-writable (R-27, R-41).
- **Provider cost:**
  - `pet-stylize` reads its 45 s limit from `pet_stylize_requests.last_requested_at` (`index.ts:1209,1276`), which the owner can update. This allows unlimited Gemini calls. It only matters if pet-stylize is deployed.
  - pet-talk's cap is safe as long as `consume_pet_chat_quota` works. But `isQuotaNotConfigured` (`pet-talk/index.ts:58-62`) treats *any* error that mentions the function name as "no cap". A mistaken revoke of `service_role` would silently lift the limit.

### 3.5 Pet photos, journal, cycle tracker

| Data | Where it lives | Finding |
|---|---|---|
| Pet photos | `pets` bucket (public), URLs in `pet.*` and `profiles.pet_photo_url` | **Not owner-only for reads** (3.3.2). Listing and writing are owner-only. Photos survive user deletion. |
| Journal | device first (`floura:journal:<uid>`), mirrored to `journal_entries` | Owner-only CRUD (verified). Plaintext in the database, so readable by anyone with dashboard or service-role access. The client supplies `id` and `created_at`. |
| Check-in text | `checkins.win_text`/`note`, and **copied into `user_events.meta`** (`retention.ts:140-143`) | owner-only. Two server copies of personal text. Pet-talk sends the last three win texts to OpenAI (`domain/petTalk.ts:45-64`). |
| Cycle tracker | **device only** (`floura:cycle:<uid>`, `floura:cycle-enabled:<uid>`) | No table or column exists for it in the schema, and no network path reads it. **One exception:** pet-talk sends a `cycleAware: true/false` flag, which is forwarded into the OpenAI prompt. It reveals that tracking is on (no dates or phases). The product promise says "cycle data stays on the device", so this is flagged for the owner. |

---

## 4. Must NOT go to a hosted environment

| Item | Where | Why / what to do |
|---|---|---|
| Demo account `demo@floura.local` with its throwaway password | `local-backend/seed-demo.js:17-18`, documented in `local-backend/README.md` | **Not in any migration.** The script refuses non-private hosts (`assertLocal`). Never point it at staging. |
| `.demo-session.json` (a live local session) | `local-backend/`, gitignored | local only. Now stale: today's reset removed the demo user. |
| `local-backend/supabase/config.toml` as-is | local | Never `supabase config push` it. It has `site_url` on 127.0.0.1, min password 6, edge runtime off and shifted ports. Set hosted auth deliberately (2.5). |
| `restoration_local_compat.sql` bucket definition | migration `20260917000000` | It creates `pets` as **public**. It is fine as history, but staging needs a follow-up migration that flips the bucket to private, once the client is ready (P1). Until then, no real photos. |
| Local anon/service keys | `supabase status`, `.env.local` | These are the CLI's well-known development keys. Never reuse them anywhere hosted. |
| `EXPO_PUBLIC_PET_TALK_PREVIEW=1` | build env | fakes pet replies; must be unset |
| `pet-chat`, `weekly-summary`, `cartoonize-pet` | `supabase/functions/` | do not deploy (2.4) |
| Dead-ref npm scripts | `package.json:24-29` | rewrite before use; never "fix" them by reusing the old ref |
| `mobile/supabase/migrations/` originals | CLI default folder | never push from here (section 1, item 1) |

What *is* safe to ship: the seeded product data in the migrations. That is 10 `plant_catalog` rows, 5 legacy
`garden_items`, and the 3 default tasks per new user from the `profiles` trigger. None of it is personal or
secret. No migration contains a user, password, key, email or URL.

---

## 5. Prioritized fixes

Each fix is a proposal. None has been made; the brief for this step was read-only.

### P0: before the staging project is created

| # | Fix | Kind | Effort |
|---|---|---|---|
| 1 | **New forward migration `grants_hardening`:**<br>• `revoke execute on function public.consume_pet_chat_quota(uuid,date,integer) from anon, authenticated;`<br>• `revoke execute … from anon` on `complete_task`, `get_garden_points`, `upgrade_plant`, `log_event_and_rollup`, `recompute_pet_state`, `clamp_local_day`;<br>• `alter default privileges in schema public revoke execute on functions from anon;`<br>Keep `service_role`. Re-run the section 3 probe to confirm. | SQL | S |
| 2 | Freeze the 24 generated migrations. Push only with `--workdir local-backend`. Every later change is a new file in `local-backend/sql/`. | process | S |
| 3 | Set hosted auth deliberately: **email confirmation off** (matches the client), min password 8, no redirect URLs, neutral Site URL. Do not push local `config.toml`. | dashboard | S |
| 4 | Deploy functions **by name only**, and only `pet-talk`, after the owner's OpenAI go-ahead. Secrets go through `supabase secrets set`. `PET_TALK_PREVIEW` is never set. | process | S |
| 5 | Staging holds **test accounts only**: no real pet photos or journal text until P1 #6 lands. | policy | S |

### P1: before any tester with real data

| # | Fix | Kind | Effort |
|---|---|---|---|
| 6 | **Private `pets` bucket** (R-13/R-14): store object *paths*, not URLs; sign on read with short TTLs; change `getPublicUrl` in `petStylize.js:177` and pet-stylize `:307,945-948`; add a bucket size limit (e.g. 10 MB) and MIME list (jpeg/png/webp); remove storage objects when a user is deleted. Check EXIF/GPS stripping on a real device. | client, function, SQL | M |
| 7 | **Points integrity** (R-37, R-38, R-40):<br>• drop owner I/U/D on `task_completions` and I/U on `user_plants` (the client never uses them, per the audit);<br>• bound `completed_at` in `complete_task`;<br>• ignore client `p_points`. | SQL | M |
| 8 | Remove owner writes on `pet_state`, `user_events`, `user_memories` and `pet_stylize_requests` (R-41). These are written by DEFINER RPCs or the service role anyway. Check `retention.ts` still works. | SQL | S |
| 9 | pet-talk: make `isQuotaNotConfigured` match only "function not found" (`PGRST202`/`42883`), so a permission error fails closed. | function | S |
| 10 | Stop logging emails (`AUTH_INPUT` in `LoginScreen.js`/`SignupScreen.js:36-40`, R-10). | client | S |
| 11 | Revoke `anon` table privileges on the 20 user tables, as defence in depth behind RLS. | SQL | S |

### P2: before a public launch

| # | Fix |
|---|---|
| 12 | Account deletion in the app (required by the App Store), including storage cleanup. |
| 13 | App identity: `scheme`, bundle id and `eas.json` with env. Then a confirm-email state (R-08) and password reset with redirect URLs. |
| 14 | Profile creation by an `auth.users` trigger (decision), and correct the misleading `SignupScreen.js:77` comment. |
| 15 | One streak store (R-27), moved server-side, so `user_stats`/`profiles` streak writes can be closed. |
| 16 | Personal text: stop copying `win_text` into `user_events.meta`; decide what pet-talk sends to OpenAI (win texts, `cycleAware`); set retention. |
| 17 | Rewrite the dead-ref npm scripts and add a `pet-talk` deploy script. Split `.env.example` into app and server templates. |
| 18 | If pet-stylize stays: fix the functions-URL derivation, move the Gemini key out of the query string, and fix R-16/R-17. |
| 19 | Disable `pg_graphql` if unused. Add CAPTCHA and rate limits on sign-up. Make the `pending_completions` offline queue per user (`taskCompletion.ts:49`). |

---

## 6. Proposed staging runbook

Each step needs owner approval when it runs.

1. **Owner:** create a new Supabase project in an account Donovan controls, on Postgres 17 in a region near the testers. Never use the AuraMind projects in the logged-in account.
2. Land P0 #1 as `local-backend/sql/grants_hardening.sql`. Add it to `build-migrations.js`, run `npm run backend:reset`, re-run the section 3 probe, and run `npm run check`. Commit.
3. `supabase link --project-ref <new-ref> --workdir local-backend`, then `supabase db push --workdir local-backend --dry-run` and review the list (25 files). Then push.
4. Verify on staging with the same introspection: RLS on for all 22 tables, the ACLs, `pets` bucket present, zero rows in `auth.users`.
5. Set auth settings (2.5).
6. Optional, when approved: `supabase secrets set OPENAI_API_KEY=… OPENAI_MODEL=… --project-ref <ref>`, then `supabase functions deploy pet-talk --project-ref <ref>`.
7. Point a dev build at staging: the owner edits `.env` (URL plus the anon or publishable key) and moves `.env.local` aside. On new projects, confirm which key type the project issues and that supabase-js 2.50 accepts it.
8. Smoke test with a fresh test account: sign-up → profile → 3 tasks → check-in → complete a task → garden points → plant → journal mirror → pet-talk ping.

## 7. Open decisions for Donovan

Staging needs only the first four.

1. Which account and region will host staging (and later production)?
2. Is pet-talk on for staging? That means an OpenAI key, a model and a daily cap.
3. Is the painted portrait (pet-stylize / Gemini) kept? If not, don't deploy it, and the private-bucket work gets simpler.
4. Email confirmation stays off for staging?
5. Is `cycleAware` (and the last three win texts) OK to send to OpenAI, given the "cycle data stays on the device" promise? This belongs in `docs/dev-notes.md`. It was not logged there in this step, because the brief allowed only this one new file.

---

## Appendix: how to re-run the audit

The probe needs no files in the repo. Against any database (local, or staging with a service connection):

```sql
-- RLS and policy count per table
select c.relname, c.relrowsecurity,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;

-- who can execute each function (after P0 #1, anon should be false everywhere)
select p.proname, pg_get_function_identity_arguments(p.oid),
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1;

-- buckets
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
```

**The two-user probe:**
1. Inside `begin; … rollback;`, insert two rows into `auth.users`.
2. `set local role authenticated` and set `request.jwt.claims` to `{"sub":"<A>","role":"authenticated"}`.
3. As A, create data. Switch the claims to B and try to read and alter A's rows. Then `set local role anon` and repeat.

**Local run on 27 Sep 2026:** every cross-user attempt returned 0 rows or an RLS error, and the owner-trust
writes in section 3.4 succeeded.
