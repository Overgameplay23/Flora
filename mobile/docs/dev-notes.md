# Pet Stylize (Supabase Edge Function)

## Env setup
- Copy `.env.example` to `.env` and fill `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_API_URL`.
- Restart Expo after changing env values (`expo start -c`) so the new values load.

## Supabase CLI
If the CLI is not available in PATH on Windows, install with Scoop:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
irm get.scoop.sh | iex
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

## Deploy (project ref: gghesvpmskjlrlpoosgf)
```powershell
supabase login
supabase link --project-ref gghesvpmskjlrlpoosgf
supabase secrets set gemini_api_key="YOUR_GEMINI_KEY"
supabase functions deploy pet-stylize --no-verify-jwt
```

## Logs
```powershell
supabase functions logs pet-stylize --project-ref gghesvpmskjlrlpoosgf --tail
```

## Health Check
```bash
curl -i https://gghesvpmskjlrlpoosgf.functions.supabase.co/pet-stylize
```

## Notes
- Edge Function reads `gemini_api_key` (fallback `GEMINI_API_KEY`).
- Keep the image payload small; the client enforces a max base64 length.
- Optional override: set `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=https://gghesvpmskjlrlpoosgf.functions.supabase.co` (dev-only) if you need to bypass `/functions/v1`.
- If you see HTTP 429 from the function, Gemini quota/rate limits were hit. Check Google AI Studio / Google Cloud billing + quotas and reduce request frequency (caching is enabled in the function).
- Run `supabase/schema_pet_stylize.sql` in SQL editor to create the `pet_stylize_requests` rate limit table.


## 2026-09-25 — strategy report vs. what exists (for Donovan to decide)

Read `docs/product-strategy/PRODUCT_STRATEGY.md` before this list. Nothing below was removed; each is a
call for the owner.

- **Name.** The app is now shown as "Luna" (app.json `name`, onboarding and Profile copy) per the owner's
  2026-09-25 note. The slug, bundle identifier and Android package are unchanged (owner decision; see
  RESTORATION_PLAN Phase 6). The report flags trademark checks before launch ("Flora - Green Focus");
  "Luna" is also a common app name, so the same check applies.
- **Open-ended AI chat.** The report says no open-ended chatbot in v1 (use designed dialogue trees).
  **Donovan, 2026-09-25: retire the chat screen for now; designed prompts are not good enough; an API will
  be added later.** So: the Talk screen is unrouted and its entry points are gone (Pet tab shows Journal
  instead); `src/screens/PetChatScreen.tsx`, `src/services/petChat.ts` and the `pet-chat` Edge Function
  stay on disk untouched. When the API exists, the conversation should be rebuilt around the pet's
  character and the person's real week (energy, wins, heavier days) rather than the old coach/chat toggle.
  **Donovan, later on 2026-09-25: plans to use OpenAI's API for this ("the openai luna api, gpt 6luna").**
  Nothing is wired yet (no key, no endpoint chosen). When it is: keep the key server-side (an Edge Function
  or the future backend, never the app bundle), give the model the pet's character and the week story, and
  keep the memorial and cycle rules in front of it (no cheering, no clinical claims).
  **Built 2026-09-26 (6.28)**: `supabase/functions/pet-talk` + `PetTalkScreen`, hidden until the function reports a
  key. To turn it on: a hosted Supabase project, `supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=...`, and
  `supabase functions deploy pet-talk` (see the function's README). The model name Donovan mentioned ("gpt 6luna")
  goes in `OPENAI_MODEL` as OpenAI spells it.
- **Fertility predictions.** The report says no fertility predictions and "never clinical". The cycle
  tracker's fertile-window estimate was **removed from the UI on 2026-09-25** to match (the phase engine
  keeps period / follicular / luteal / expected). The remaining copy stays non-clinical with the disclaimer.
- **Streaks.** The report warns against punitive streaks. Luna shows streak counts (Home header, Profile)
  but never penalises: nothing is lost, the pet never declines. Consider renaming to "days together" and
  adding the Graceful Hibernation copy ("You're back! Let's take today easy.") on return after 5+ days.
- **Garden vs. sanctuary room.** The report imagines a cozy room; the product identity here is a garden
  that grows. Resolved 2026-09-25 by species, following the report's "Species Dynamics": dogs keep the
  garden (outdoor, kinesthetic), cats get a **window nook** (interior, calm) drawn as vectors in
  `src/components/garden/NookBackdrop.tsx` so it needs no painting and follows the clock. Same plants,
  same loop, different place and words (`src/domain/sanctuary.ts`). "Adopt a companion" was built the same day
  (6.26): a shelter of eight ready-made companions; the look carries `origin: "adopted"`, which hides the photo and
  memorial entry points. If you want the shelter to grow (more breeds, seasonal arrivals), that is content in
  `src/domain/shelter.ts`.
- **Points vs. Sprouts.** The report names the currency "Sprouts"; the app says "pts". Renaming is a copy
  change once the owner confirms the word.
- **Pet generation.** The report recommends a parametric vector rig over diffusion output. Luna now has a
  dog/cat vector rig with a customisation step (2026-09-25); the Gemini `pet-stylize` portrait path is kept
  as an optional "painted portrait" and still needs provider keys to test.
- **Health/steps, widgets, SSO.** Still need a native strategy and an app identity (not possible in Expo Go on
  the App Store build without the owner's decisions); logged as roadmap items.
- **Notifications** (2026-09-26): built as **local reminders in the pet's voice** (`src/domain/reminders.ts`,
  `src/services/reminders.ts`, Profile › Reminders, onboarding "greet you tomorrow morning?"). Local scheduling
  needs no server and should work in Expo Go on iPhone; **remote push** (a server waking the phone, e.g. for the
  weekly scrapbook when the app has not been opened) needs a development build and an app identity. Not verified
  on a phone from this machine; first thing to try on the iPhone. The memorial cancels every reminder.
- **Memorial "pause alerts"** is now real: reminders are cancelled the moment memorial mode turns on.

- **Alert.alert is a no-op on web** (found 2026-09-25 while testing the memorial). `src/utils/confirm.ts` is the
  replacement (`confirmAsync` / `notify`). Swept the same day: every live screen uses it now; only the superseded
  `PetSetupScreen` still imports `Alert`. Rule for new code: never call `Alert.alert` directly.
- **Journal** (2026-09-25): rebuilt as a private, prompt-led journal. Dropped from the UI: voice entries (no audio
  storage or transcription existed) and the AI "follow-up question" (the `aiPrompt` API is gone, and the report
  argues for designed prompts). If you want voice notes back (report Ph3 "scrapbooks w/ voice notes"), that needs
  a storage bucket and a transcription provider; the original screen is in `docs/baseline/originals`.
- **Weekly recap** (2026-09-25): the report's Sunday "scrapbook" push is not possible without notifications, so
  "Our week" is pull-only for now (Home week card and Profile). The "room item" reward it mentions is not built;
  the garden already rewards points daily. Decide later whether the recap should unlock anything.
- **Memorial mode** (2026-09-25) is built as described in the report; the "pause alerts" part waits for
  notifications to exist. Multi-pet remains out of scope: a new companion archives the memorial on the device.

## 2026-09-27 — backend hardening (branch `backend/hardening`): judgment calls and conflicts

Source: `docs/backend/STAGING_PLAN.md`. Three new migrations (`local-backend/sql/rls_owner_policies.sql`,
`function_grants.sql`, `pets_bucket_private.sql`); no existing migration was edited. Evidence in
`RESTORATION_BASELINE.md` 6.29.

- **"Owner policies for select, insert, update and delete" vs. "deny by default".** Read as: owner-scoped
  select/insert/update/delete on the tables the app writes itself (`profiles`, `pet`, `checkins`, `tasks`,
  `habits`, `habit_completions`, `journal_entries`, `user_stats`, legacy `garden_unlocks`/`garden_plants`), and
  **owner select only** on tables that only SECURITY DEFINER RPCs or Edge Functions write (`task_completions`,
  `user_plants`, `user_plant_upgrades`, `user_events`, `daily_user_metrics`, `pet_state`, `pet_chat_usage`,
  `pet_stylize_requests`, `user_memories`, `weekly_summaries`). Owner writes there would reopen R-37/R-38/R-41
  (forged points, plant levels, streak state) and let anyone reset their own chat quota by deleting their
  `pet_chat_usage` row. The client never wrote those tables directly, so nothing in the app changed.
- **Still owner-writable on purpose:** `user_stats` and the `profiles` streak/xp columns (client-computed by design,
  R-27) and `garden_unlocks` (the legacy unlock economy is client-trusted; its screen is unreachable). An owner can
  still inflate their *own* streak number. Closing that needs one server-side streak (R-27).
- **Photo layout changed to one folder per user.** The ask was "objects under their own user-id prefix", so
  objects moved from `original/<uid>.<ext>` + `processed/<uid>/…` to `<uid>/original.<ext>` + `<uid>/processed/…`,
  checked with `storage.foldername(name)[1] = auth.uid()`. This touched the client (`petStylize.js`), the
  `pet-stylize` Edge Function paths and `seed-demo.js`. No hosted data exists; locally, `backend:reset` +
  `backend:seed`. Any environment that still has old-layout objects would need them moved (none does).
- **What the database stores for an image.** Still a URL (the bucket's canonical object URL, token-free), not a
  bare path, so the row keeps the shape every schema fallback and "has a photo?" check expects. Once the bucket
  is private that URL does not load on its own; `src/services/petPhotoUrls.ts` signs it for one hour when it is
  shown (in-memory cache, re-sign 5 minutes before expiry, one request per object shared across screens,
  cleared on sign-out). Old public URLs and the old 1-year signed URLs are recognised and re-signed from their
  path; the year-long signed URL is no longer created. Screens that show pet images: `PetPortrait` (through
  `usePetCandidates`), `PetTabIcon`, `PetStylizeResultScreen`. `Pet.js` and `PetAvatar.tsx` are dead code and
  would need the same hook if revived.
- **`pet-stylize` downloads `imageUrl` itself.** The client now sends a freshly signed URL on the retry path.
  Separately (not changed): the function fetches *any* URL the client sends. Before deploying it, restrict that to
  the project's storage host or download by path with the service role.
- **Default privileges are global for PUBLIC.** Postgres cannot revoke PUBLIC's EXECUTE per schema, so
  `function_grants.sql` revokes it for every function postgres creates later. **Every new RPC must
  `grant execute … to authenticated` explicitly**, or the app gets "permission denied".
- **Catalogs need a session now.** `anon` has no privilege on any table, including `plant_catalog` and
  `garden_items`. The app only reads them signed in; grant `select` to `anon` on those two if a pre-login screen
  ever needs them.
- **Cycle data (for Donovan to decide).** Verified it never reaches the database (no table/column/bucket; pgTAP
  `04_cycle_stays_on_device.test.sql`) and the client never sends it anywhere, **except** the `cycleAware`
  true/false flag in the pet-talk context, which the Edge Function puts into the OpenAI system prompt. Not removed.
  Keep it (the pet can be gentler) or drop it to honour "stays on the device" literally. Guards:
  `src/__tests__/cycleOnDevice.test.ts` fails if a new module reads the cycle store or the payload carries more.
- **Correction to STAGING_PLAN:** `tasks` has no `points` column in this schema (the client's `habitOverrides`
  write fails soft and `complete_task` awards the default 2), so "tasks.points is editable" was wrong.
- **Not done here (still open from STAGING_PLAN P1):** R-40 (`complete_task` accepts any `completed_at`, so one
  backdated completion per task per day is possible; `log_event_and_rollup` trusts `p_points` for
  `daily_user_metrics`); pet-talk's quota check fails open on a permission error (P1 #9); emails in `AUTH_INPUT`
  logs (P1 #10); deleting a user leaves their photos in storage; `scripts/pet-mask-to-alpha.js` still assumes the
  old layout and public URLs (maintenance script, not the app).
- **Tooling:** `.claude/launch.json` `floura-expo` starts Expo from the repo root, which is the R-55 failure mode.
  Verification used a temporary static server over the production export instead (entry removed afterwards).
- **Stale build flag (found during verification, pre-existing).** Today's `npm run export:web` bundle had
  `EXPO_PUBLIC_PET_TALK_PREVIEW` inlined as `"1"` although no env file or environment variable sets it: Metro's
  transform cache (`%TEMP%\metro-cache`) kept the value from the 2026-09-26 preview build, so the "Talk" tile
  appeared and would have given stand-in replies. Rebuilt with `npx expo export … --clear`. Any build that ships
  (staging, TestFlight, store) must be exported with `--clear` or from a clean cache; consider adding `--clear`
  to `scripts/check-export-web.js` (slower check, owner's call).

## 2026-09-27 — environment separation (branch `backend/hardening`): judgment calls

Runbook: `docs/backend/DEPLOY.md`. Evidence: `RESTORATION_BASELINE.md` 6.30.

- **Backend values now come from app config, not `process.env`.** `app.config.js` (new; `app.json` stays the
  static base) picks the profile with `APP_ENV` (`local` default, `staging`) and passes the `EXPO_PUBLIC_*`
  values as `extra.backend`; `src/utils/env.ts` reads them through expo-constants. The static
  `process.env.EXPO_PUBLIC_*` references are gone from app code, so a developer's `.env.local` can no longer be
  inlined into a staging bundle. The same goes for `EXPO_PUBLIC_PET_TALK_PREVIEW` (via `getRawPublicEnv`). If app config is
  missing the app reports "not configured" rather than guessing.
- **Profile files:** `local` = `.env.local` (what `backend:env` already writes), `staging` = `.env.staging`. Expo's
  own env loading has no "staging" mode, so `app.config.js` reads the profile file itself and lets it win over the
  environment. Staging outside CI/EAS **requires** `.env.staging`, and the local profile **refuses** a hosted URL,
  because Expo also loads the plain `.env`, which on this machine still names the deleted project.
- **One key variable.** `EXPO_PUBLIC_SUPABASE_ANON_KEY` holds either the new publishable key (`sb_publishable_…`)
  or the legacy anon key; no second name. `app.config.js` refuses service-role JWTs and `sb_secret_` keys.
- **Metro cache, now a hard rule.** The web bundle's app config is inlined at transform time and cached. Reproduced:
  a plain local export right after a staging export carried the staging URL, and the first export after
  creating `app.config.js` still carried `app.json`'s placeholders. `scripts/check-export-web.js` now always passes
  `--clear` (about 15 s extra; this was the owner's call on 27 Sep, made here because profiles make switching
  routine), and `start:local` / `start:staging` go through `scripts/expo-profile.js`, which always adds `--clear`.
  Plain `npx expo start` still works but can serve a stale profile on web right after a switch.
  Native Expo Go reads the manifest from the dev server and is not affected.
- **`.env.example` rewritten** (original kept in `docs/baseline/originals/.env.example`). It now lists only what the
  app reads. Removed: the six `EXPO_PUBLIC_FIREBASE_*` (read nowhere), and the server-side
  `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_*` and `BACKGROUND_REMOVAL_*`, which moved to
  `supabase/functions/.env.example`. `scripts/pet-mask-to-alpha.js` (a maintenance tool) still reads
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_BUCKET` from its own environment; not documented as app env.
- **`app.json` `extra` placeholders removed** (`<your-project>` etc.). They were read nowhere and looked like config.
- **Functions deploy from `local-backend/`.** The code stays in `supabase/functions/`; `config.toml` declares only
  `pet-talk` with an out-of-tree `entrypoint`, so every CLI command shares one workdir and one link, and
  `pet-chat` / `weekly-summary` cannot be deployed by accident. Verified with a local `functions serve`; not yet
  against a hosted project.
- **Relative paths under `--workdir` are inconsistent in CLI 2.67** (`db dump -f` from the workdir, `storage cp`
  from the current directory). The docs therefore use absolute `--env-file` paths, and `backend:dump` passes absolute
  paths or runs from the backup folder.
- **Backups go beyond "schema".** `backend:dump` takes roles, schema and data (Supabase's restore set), writes a
  checksum manifest, and with `--with-photos` copies the bucket. A dump does not contain storage policies or the
  migration history; the restore steps in DEPLOY.md re-create both from the repo. **No restore drill has been run yet.**
- **Scheduled backup is a draft:** `.github/workflows/staging-db-backup.yml.disabled` (GitHub ignores the
  extension). It needs `STAGING_DB_URL` (session pooler) and `BACKUP_PASSPHRASE`, and the artifacts are encrypted,
  because anyone who can read the repo's Actions can download them.
- **Seeds: no staging seed.** Reference data (plants, legacy garden items, default-task trigger) is in the migrations;
  the demo seed stays local-only and now also requires plain `http`. `seedSeparation.test.ts` guards both.
- **Left alone:** the six `supabase:*` npm scripts that name the deleted project. They're superseded by the new
  wrappers and would fail harmlessly; remove them when you like.

## 2026-10-14 — the pet is painted from photos (owner's call), notes and conflicts

Owner, 2026-10-14: "when selecting a pet, they select 1-3 pictures of their pet, and we call the API to make a
version of their pets only through the photos, not selecting anything (the ears, the colour, nothing), less
cartoony, better quality; no name suggestions if they uploaded a picture." Built as `docs/pet-portrait-v3.md`.

- **Conflict with the strategy report** (parametric vector rig over generated raster art): the owner chose the
  painted portrait as the pet. Nothing was removed: the rig, the look editor and the shelter all still exist.
  The rig now stands in only while no transparent portrait exists (and for adopted companions, who have no
  photo); the look editor is reached only by skipping the photos, and by "Change look" on the Pet tab, where it
  edits the stand-in. Consider relabelling that tile once a portrait exists.
- **Portrait precedence** changed in `PetPortrait`, `GardenStage` and `PetTabIcon`: a transparent stylized or
  cutout image beats the rig. Previously the rig beat everything, so a painted portrait never showed for anyone
  with a look saved. Wander and acted-out routines are rig-only; with a portrait on screen an act ends at once.
- **Photos: only the first is stored** (`<uid>/original.<ext>`); photos 2-3 travel in the request only, so
  "Paint again" from the Pet tab repaints from photo 1. Storing all three (`<uid>/reference-N.jpg`) would need
  the retry path to list the folder; left for later.
- **Pipeline change** in `pet-stylize`: the painting's backdrop is keyed from the painting itself (flood fill
  from the border). v2 clipped the painting with the *photo's* cutout mask, which cut off any part of the body
  the photo did not show (a head shot gave a head-shaped full-body painting). The photo cutout is now only
  made when the portrait fails, as the fallback render.
- **New dependency** `expo-image-manipulator ~14.0.8` (SDK 54 bundled version, installed with `npx expo install`;
  works in Expo Go and on web). Photos are shrunk to 1024 px JPEG on the device before upload; a side effect is
  that PNG photos now get the colour suggestion too (R-80 closed).
- **Model choice is the owner's:** default stays `gemini-2.5-flash-image`; `GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview`
  (optionally `GEMINI_IMAGE_SIZE=2K`) paints finer fur and likeness at several times the price. `imageConfig`
  (aspect 1:1) is sent and dropped automatically if the model rejects it.
- **Not verified against Gemini from this machine** (no provider key here). Verified on 2026-10-14: app typecheck,
  Deno check of the function, jest (33 suites / 192 tests), the keying algorithm on synthetic paintings (white
  chest patch inside a brown body survives; a painted scene and a blank image are refused; 1024² keys in ~40 ms),
  and the onboarding flow in the web build against the local stack: three stubbed photos picked at once
  (multi-select, limit 3), one removed, one re-added (single-select, limit 1), the look editor skipped, no name
  ideas, painting failing soft ("kept-photo") because no edge runtime runs locally, the shrunken 1024 px JPEG
  stored as `<uid>/original.jpg`, and `pet.look` tinted from the photo. A transparent `processed/stylized.png`
  seeded for the same user then rendered as `RENDER_SOURCE=stylized` on Home and in the Pet tab icon with the look
  still saved. First real run: deploy with a key and check the function log for `backdrop keyed`
  (`keyedShare` ≈ 0.4-0.8) and `alpha_stylized: true`.
- **Observed, pre-existing:** on the kept-photo path the "one small thing" step is skipped: saving the original
  photo updates `profiles.pet_photo_url`, the profile refresh flips the app gate to the main tabs, and the meet
  step's Continue lands on Home. Same code path as before this change; part of the onboarding pass the owner
  has planned.
- **imageUrl is now restricted** to the project's storage host (`PET_STYLIZE_ALLOWED_IMAGE_HOSTS` adds more),
  which closes the 2026-09-27 "fetches any URL" note before the function is deployed.
- **Deploy wiring:** `local-backend/supabase/config.toml` now declares `[functions.pet-stylize]` next to pet-talk,
  so `npm run functions:deploy -- pet-stylize` finds it. Nothing was deployed; the secrets it needs are listed in
  `supabase/functions/.env.example`. Deploying is the owner's action.

## 2026-10-15 — new Home, design system, plan engine v1 (owner's direction), notes and conflicts

Owner, 2026-10-15: Finch-level colour "in our own style, a better quality style than Finch"; the user's pet is the
mascot everywhere; a personalized self-help plan engine (they choose what they want help with, the app picks tasks
they'll be motivated to do); games with the pet; an outfit shop as a revenue line; cycle tracking "like Flo"; a
streak system; "a comfort, therapy, self-help app". The plan lives in `docs/ROADMAP.md`; the look in
`docs/design-system.md`.

**Conflicts with the strategy report, for Donovan to decide (nothing was removed):**
- **Streaks.** The owner asked for a streak system; the report says "no punitive streaks / no broken streaks" and
  onboarding promises "Never a streak, never a nag". Built so far: only **Days Together** (lifetime days with any
  care, never resets) as the headline chip on Home. Proposed next (`docs/ROADMAP.md`, "Cozy Run"): a run with 2
  automatic Nap Days a week, earned Warm Blankets, cycle days covered, and a run that ends as a scrapbook chapter
  instead of "breaking". Protection is never sold. Needs the owner's yes on the rules and the copy change in onboarding.
- **Cycle "like Flo".** Match Flo on logging, calendar, predictions (as ranges) and insights; beat it on privacy
  (on-device, encrypted) and on pet-driven care. The report bans fertility/ovulation/pregnancy features and the
  fertile window was removed on 2026-09-25; that stays out unless the owner overrides it explicitly (it would also
  move the app toward medical-device regulation; see the research note in ROADMAP).
- **Cycle signal in the plan.** Home passes the on-device cycle phase to the plan engine (a plain value; the plan
  code never reads the cycle store, and `cycleOnDevice.test.ts` still holds). Cycle-care tasks get neutral titles
  ("Cozy warmth break") before they are written to `tasks`, but a cozy task showing up on certain days is still a
  faint pattern in the database. If that is too much, make cycle-care items local-only (no `tasks` row, no Sprouts).
- **Paywall timing.** The report says after the 3rd daily check-in; Day-0 conversion data (RevenueCat 2026: 82% of
  Health & Fitness trials start on install day) argues for a soft, skippable offer at the end of onboarding too.
  Proposed: both, never on a "Drained / On edge" day. Price: the report's $6.99/$44.99 sits under the category
  medians ($9.99/mo, ~$40/yr); treat as a test.
- **Energy check vs check-in.** Home's new battery check (Drained / On edge / Steady / Bright, the report's energy
  slider) is stored on the device per day and shapes the plan and the pet's mood. It does not write a `checkins`
  row or count toward Days Together; the 1-5 Check-in screen still does. Merge them or keep both: owner's call.

**Judgment calls on Home (all reversible):**
- Home is now `HomeView` (pure, `src/components/home/`) driven by `app/screens/HomeScreen.js` (data). The old
  `finchHome/*` cards stay in the repo but Home no longer uses FinchGardenHeader / FinchProgressCard /
  FinchQuickActions / FinchTaskCard. Dropped from Home: the legacy "Next garden item" bar (it measured today's
  points against an unlock nothing reachable could claim, R-31), the dev points panel, "Edit habits" (the plan
  engine picks tasks now) and the Check-in/Habits quick actions (now cards in "More with {pet}"). Habits and the
  full task list are still one tap away in the footer.
- Tasks on Home come only from the plan engine (`useTodayPlan`). Each picked catalog task is backed by a `tasks`
  row matched by title (created if missing, reactivated if inactive, **never deleted**), so `complete_task`, the
  offline queue and Sprouts work unchanged. Old seed titles ("Drink water", "Go outside / get sunlight",
  "10-minute focus session") are catalog titles, so their history carries over. Rows from earlier plans stay
  active, so "All tasks" grows over time; deactivating stale plan rows is a follow-up.
- Tasks that open their own screen (breathing, journal, a game) are ticked when the person comes back after at
  least 8 s. A game also completes "Play with {pet}" itself; the second call is idempotent and stays silent.
- The pet's lines on Home are designed lines (`src/domain/homeDialogue.ts`), not chat.
- "Sprouts" is now the UI name for the existing points balance (`get_garden_points`); nothing changed server-side.
- New dependencies (all work in Expo Go): `expo-haptics`, `@expo-google-fonts/fraunces`, `@expo-google-fonts/nunito`.
- A dev-only design preview renders Home with fixture data on web: `http://localhost:8081/?preview=home`
  (`&hour=22`, `&theme=nook`, `&focus=none`, `&energy=exhausted`). It is behind `__DEV__` and never ships.
- Status bar: Home sets it from the sky (dark text by day); leaving Home hands back light text because the other
  screens are still dark slate until the reskin pass.

**Pet portrait v3 deploy status (2026-10-15):** Bloom (`jhrsfogxxexmzauhtjif`) has **no Edge Functions deployed**
and no `GEMINI_API_KEY`, so painting cannot work on the phone yet; the app falls back to the rig. The function needs
`GEMINI_API_KEY` set as a Bloom Edge Function secret (owner's action, dashboard or CLI) and a deploy of
`pet-stylize`. Client fixes made today so it works once deployed: the painting call gets its own long timeout
(the shared 15 s timeout gave up while Gemini was still painting) and is not auto-retried; an opaque
(`alpha_stylized: false`) painting is no longer saved as the pet; the Memorial screen shows the painted portrait.

**From the plan-engine and pet-fix reviews (2026-10-15), open items:**
- Cycle inference: a cycle-tracking person who did not pick the cycle focus gets cozy tasks only on period days, and
  `tasks.created_at` / `task_completions` dates for those neutral titles can still reveal those days to the server.
  Same owner decision as above (sync with neutral titles vs local-only).
- Person-written tasks whose titles match a pet template ("Play with the kids", "Send someone a photo...") can be
  reused as that plan row by `catalogIdForTitle` / `ensurePlanTaskRows`. For play this matches the old `isPlayTask`.
- The plan's anchor task moves after one undone day (its score halves); consider a softer decay.
- `floura:energy:<uid>:<date>` keys pile up one per day (tiny); prune with the plan cache.
- iOS may stop waiting on a request after ~60 s without data even with the 110 s client timeout; a painting slower
  than that fails with the right "taking longer" message. A real fix is an XHR with `timeout`, or a function that
  answers at once and lets the app check back.
- The `user_plans` migration (`local-backend/sql/plan_engine_v1.sql`, not applied) rejects the `cycle` focus by design:
  strip it before syncing focus areas to the server.

**Reskin of every remaining screen (2026-10-15):** Garden, Pet, Profile, Check-in, Journal, Breathing, Our week,
Cycle, Reminders, Memorial, Play and the game chrome, All tasks, Habits, Login/Signup, the splash and "can't reach"
screens and the stack headers now use the design system (see the new last section of `docs/design-system.md`).
Decisions made and conflicts left for Donovan:
- Night paper app-wide: from 21:00 to 05:00 every screen, header and the tab bar go to the night paper, as Home
  already did. The status bar follows (one app-wide style; Home, Garden and Pet follow their sky while in front).
- Breathing: the old box breathing (4-4-4-4, Breathing route) and the 4-second modal are one 4-2-6 session now.
  Home still ticks a breathing task when the person comes back from it; nothing new is logged.
- Check-in: the 1-5 slider is a five-tile picker (same 1-5 values, protected mode unchanged). The "Saved" alert is
  replaced by the pet reacting in place (bubble, cheer, toast) before going back. `@react-native-community/slider`
  is no longer imported anywhere; drop it from package.json if nothing else needs it.
- Garden says "Sprouts" (as Home) instead of "points"; All tasks still says "pts" and Our week "points went into
  the garden". Pick one word everywhere.
- Conflicts with the roadmap: Cycle shows one predicted date and "expected" days with default 28/5 lengths before
  any cycles are logged (roadmap: ranges only, after 2+ cycles). Play is a stack screen and points still need the
  "Play with {pet}" task (roadmap: the first game of the day earns Sprouts on its own). Our week shows "of 7 days"
  and All tasks/Habits show "N of M done", which count what was missed; "Mark the other N done" on All tasks is a
  bulk tick (one pet response per act is the rule). Habits, All tasks and Home's plan overlap; the All tasks empty
  line ("Edit your habits from Home") is stale.
- App name: copy still says "Luna" (Profile footer, Memorial, Cycle, Reminders) while the docs say Floura.
- Still dark slate (not part of this pass): onboarding, Talk, pet chat, garden progress, plant store, the painting
  loading/result screens, PetLookEditor, the env/network banners, Diagnostics and Network debug.
  `src/components/GardenScene.js` and `src/components/habits/EditHabitsModal.tsx` are no longer used.
- Dev previews pin a fixture pet through `pinPetForPreview` (petStore) and `PreviewAuthProvider` (AuthContext);
  both are only reached from `src/screens/dev/DesignPreview.tsx` under `__DEV__` on web.

## 2026-10-16 — integration of the SDK 57 upgrade, the home redesign and the sign-up fix; review fixes

`main` now carries, in order: the Expo SDK 57 upgrade (PR #1, `82e0599`), the two home-redesign commits
(`18f0d8c`, `9304a0c`, fast-forwarded) and `fix/auth-signup-honesty` (`de5a978`, merged as `37ce370`). The two
branches had rewritten the same sign-in and sign-up screens; the merge keeps the design-system layout and the
honest messages, the in-flight lock and the redacted logs. Verified on this PC: `npm run check` green at every
step (SDK 57 tree 33 suites / 192 tests; merged tree 40 / 284), the web app against the local stack (sign-in,
Home, Garden, Pet, Profile, All tasks on the demo account).

Two independent read-only reviews of the redesign (plan engine + Home data layer; theme, kit and every reskinned
screen) found no dropped handlers or routes. What they did find, and what changed:

- **Offline tick with no row id failed hard.** A task that never had a `tasks` row while online (first day
  offline, or a title with the pet's name before the name was known) threw "No task row" and the tick never
  reached the offline queue. Now the tick is kept on the device by catalog id and day
  (`planStore.addPendingPlanTick`, key `floura:plan-pending-ticks:<uid>`), shows as done with the "Saved on this
  phone" note, and `useTodayPlan` turns it into a queued completion stamped with the tap time as soon as the row
  can be made (`flushPendingPlanTicks` → `enqueuePendingCompletion(..., createdAt)`), then asks Home to sync.
- **"Your pet" written into rows for good.** The plan's 2.5 s readiness fallback could build the plan before the
  pet row arrived, so rows like "Play with Your pet" were inserted. Rows whose title carries `{pet}` now wait
  until the pet's name is known (`tasksSafeToCreate`, `petKnown` from Home); the plan still shows those tasks and
  a tick on them is kept on the device meanwhile.
- **Day rollover used yesterday's battery.** The readiness fallback was sticky; after midnight the new day's plan
  was built with the old energy, logged as shown and given rows, then rebuilt. The fallback is now per day and
  user, and the battery resets to unanswered when the day changes.
- **Welcome-back reshuffled the day.** `returning` is part of the plan's cache signature, and a second launch
  the same day read as "same day", so a gentle 3-task morning became a full plan at noon. The return note is
  now kept for the whole day (`floura:return-note:<uid>`) and cleared when the day changes.
- **Every rebuild inflated skip penalties.** The shown log unioned each rebuild, so a morning task replaced by
  the evening plan counted as passed over. `recordPlanShown` now keeps a day's latest list only (done tasks are
  pinned, so they are always in it).
- **Rows piled up.** Every plan row ever created stayed active, so "All tasks" grew by a few rows a day and its
  bulk tick covered all of them. The daily ensure now deactivates the person's other plan rows
  (`ensurePlanTaskRows(..., { deactivateStale: true })`): never their own tasks, never the play row the games
  complete; a row comes back the day its task is picked again. The single-task ensure never deactivates.
- Completions for the plan are read for the plan's own day (`dateKey`), not "now", so a reload after midnight
  with Home still open cannot untick the day. A ref guards the card's two targets against a double completion.
- Smaller: the dev design-preview `require` is behind `__DEV__` again so the release bundle drops it; the app
  shows the sky of the hour instead of a white frame while the fonts register; the All-tasks toast now says
  "+N Sprouts" like Home; the Check-in save button is disabled during the 1.6 s leave; the Pet tab's "days
  together" uses the same Days Together count as Home (it used to count calendar days since the account was
  made, so it said 15 where Home said 5).

Left as found (for Donovan): the breathing session now waits for a Start tap (it used to start on open, also
in protected mode); `@react-native-community/slider` and `app/screens/LoginScreen.js` are unused; the proposed
`user_plans` migration is still not applied and `normalizePlanSettings` still accepts `cycle` from the
snake_case shape (strip before any sync).

## 2026-10-16 — Onboarding v2 (pet first, then the quiz; the painting runs behind it)

Built per `docs/ROADMAP.md` item 3, on the design system (`src/components/onboarding/`: `OnboardingFrame` with a
progress bar and pinned buttons, `ChoiceCard`, `PetSteps`, `QuizSteps`, `FinishSteps`; flow in
`src/screens/onboarding/OnboardingScreen.tsx`; rules in `src/domain/onboarding.ts`).

- **Order:** welcome → dog/cat (or adopt) → 1-3 photos | shelter | look editor → name → **the painting starts in
  the background** → quiz (what's felt heaviest: up to 3 of the 10 areas, ranked; usual battery; how much a
  hard day allows: 1/5/15 min; how the pet should talk: gentle/warm/plain; and, only if the rhythm area was
  picked, "keep your rhythm private on this phone?") → reveal (the pet in its sanctuary, "because you said"
  chips, the plan the engine builds from the answers) → morning reminder with a time (skipped on web, where
  there are no notifications) → one small thing (gentle tap tasks from the plan, completed through a real
  `tasks` row and `complete_task`) → Start. The "new photos" flow keeps its explicit painting wait; "change
  look" is unchanged.
- **Where the answers go:** focus areas + a daily count (`dailyCountFor`: drained/anxious or a one-minute
  hard day start at 3, bright + 15 minutes at 5, else 4) → `planStore.savePlanSettings`, so Home's focus
  prompt no longer shows after onboarding; usual battery, hard-day minutes, voice and `completedAt` → a new
  on-device store `floura:care-prefs:<uid>` (`src/domain/carePrefs.ts`, `src/services/carePrefs.ts`). The
  voice is stored but not yet used by the dialogue lines (next: pick line sets by voice in
  `homeDialogue.ts`). "Not now" on the cycle question drops the rhythm area from the plan settings; "Yes"
  calls `setCycleEnabled(uid, true)` and nothing else (the guard test lists the screen as a flag-only
  toucher). Nothing from the quiz is sent to the server.
- **The gate (R-84):** `AuthContext.onboardingActive` is set while the first run is mounted and cleared on
  Start (and on sign-out); `deriveAppGate` returns `setup` while it is set. The kept-photo path no longer
  skips the end of the flow when saving the photo marks `profiles.pet_photo_url`. A reload mid-flow still
  lands on Home (the latch is in memory); Home's focus prompt covers the plan in that case.
- **Reveal plan preview** = `buildDailyPlan` with the quiz settings and the usual battery as today's energy
  (an on-edge person sees a gentle 3-task day); nothing is logged or written. Progress is a bar; the welcome
  hides it. Left as is: the look editor (`PetLookEditor`) still has its dark preset tiles; the dev-only
  `RENDER_SOURCE` pill shows on the welcome/reveal scenes in dev builds.
- **Not done (needs the owner / Bloom):** account creation still comes first (anonymous sign-in needs the
  Bloom auth setting; Apple/Google sign-in needs an app identity and a dev build); the soft paywall at the
  end of onboarding waits for the Club decision. `celebrationLine` now says "Sprouts" instead of "pts".
- Verified on web against the local stack with a fresh account (`onboarding-20261016@floura.local`, noted in
  `local-backend/README.md`): skip-photo path → look editor → name "Maple" → sleep + rhythm areas → on edge →
  five minutes → warm → yes to private rhythm → reveal (3 gentle tasks, 4 chips) → first thing "Open the
  curtains" (+2) → Home with "1 day", 2 Sprouts, focus chip "Sleep · Rhythm", 1 of 3 done. The photo path
  (background painting) could not be driven on web (file picker) and painting itself needs the function on
  Bloom; its state machine is unit-tested.

## 2026-10-16 — Journeys v1 (seven-day arcs, one per focus area)

`docs/ROADMAP.md` item 8, "Journeys: 7-day arcs per focus area". Built on the device, like the plan settings.

- **Content:** `src/domain/journeys/catalog.ts`, ten journeys (one per focus area), seven days each: a theme,
  a line from the pet and a task from the plan catalog, plus a journal question on the last day (and a few
  others). Because every step is a catalog task, a step is completed through the same `tasks` row and
  `complete_task` as any care task (`src/services/journeyActions.ts`): Sprouts, history and the offline queue
  are unchanged; only the arc lives on the device (`floura:journeys:<uid>`, `src/services/journeyStore.ts`).
- **Pacing** (`src/domain/journeys/index.ts`): one journey at a time; one step per calendar day (after today's
  step the card says "Day N done. Tomorrow: …"); a missed day costs nothing, the journey just takes longer
  ("about <date> at this pace"); the seventh step finishes it (kept in `completed`). Starting another journey
  sets the current one aside after a `confirmAsync`; leaving keeps what was done. Nothing is ever "broken".
- **Where:** the active journey's step sits at the top of "Today's care" on Home (`JourneyCard`), with its own
  check; a step ticked from the care list or a game counts for the arc too. "More with {pet}" has a Journeys
  door (it names the active journey and its day); Profile › Journeys; routes `Journeys` (list, the person's
  areas first with a "for you" badge, done dates) and `Journey` (the seven days, today's step, start/leave).
- **Rhythm journey** ("Gentle days") is listed only when the person tracks their cycle or picked the area;
  its tasks are the neutral `cozy.*` catalog titles, so nothing cycle-related reaches the database (test).
- **Not done:** rewards for finishing (a scrapbook page / room item, roadmap), sequels, server sync of the arc.
- Verified on web with the test account: start "A softer landing" from the list, day one "Today" in the
  detail, the card on Home, tick from Home → "Day 1 done. Tomorrow: Tomorrow's note.", +2 Sprouts toast,
  carousel "Day 1 of 7". jest: `journeys.test.ts` (catalog invariants, pacing, junk, store).

## 2026-10-16 — "Add your own" care tasks on Home

Finch's custom goals had no equivalent since "Edit habits" left Home. Now "Today's care" ends with an "Add your
own" row: a sheet asks for a few words, a colour (nine care categories, guessed from the words until picked) and
about how long. The task is a plain `tasks` row (title only on the hosted table), so it completes through
`complete_task` like everything else; its colour and minutes live on the device (`floura:custom-tasks:<uid>`,
`src/services/customTasks.ts`; rules in `src/domain/customTasks.ts`). Own rows are every active row whose title is
not a catalog title under any pet name and not the play row; they sit under the plan every day, with "Your own"
as the reason, and press-and-hold puts one away (`active = false`, never deleted, so its Sprouts stay). The daily
stale-row deactivation never touches them (it only quietens catalog titles). Midday greeting changed from
"Welcome back" (confusing on a first day) to "Good afternoon"; "Welcome back" remains the real return greeting.
Verified on web: add "Take my meds" → Body · 5 min · Your own → tick → +2 Sprouts. `customTasks.test.ts` covers
the title/colour rules and the device meta.

## 2026-10-16 — Days Together milestones, keepsakes, and the pet's voice

- **Milestones** (`src/domain/milestones.ts`, store `floura:milestones:<uid>`): thresholds 1, 3, 7, 14, 21, 30, 50,
  75, 100, 150, 200 and 365 days of care. When Days Together (the same count Home shows) reaches one, Home shows
  one moment (`MilestoneSheet`: the pet, its line, the keepsake it leaves; love reaction, success haptic) and
  writes it down. A person who updates on day 40 gets one sheet ("a month together"); the thresholds below are
  recorded quietly as reached "before keepsakes existed". Nothing is ever lost or reset, and there is no
  penalty anywhere in this: Days Together only goes up.
- **Keepsakes** (Profile › Keepsakes, route `Keepsakes`): the milestones, the journeys walked (from the journey
  store) and the day the pet moved in (care prefs `completedAt`), newest first, plus "next keepsake in N days".
  This is the first half of the roadmap's scrapbook; the Sunday page and room items are still open.
- **Voice**: `homePetLine` now takes the voice chosen in onboarding (`carePrefs.voice`: gentle / warm / plain),
  with a line set per voice for every branch (returning, all done, drained, on edge, progress, morning, evening,
  night, day); unknown or missing falls back to warm, so nothing changes for existing users until they choose.
  Not yet voiced: the task-done toast, the journey lines, the reminders.
- Verified on web with the test account (day 1): the "First day together" sheet on Home, Keepsakes with the
  milestone and "Maple moved in". jest: `milestones.test.ts` new, `homeDialogue.test.ts` extended.

## 2026-10-16 — "Pet the pet" (a calm game) and Sprouts for the first game of the day

- **Pet the pet** (`src/games/petting/`): the pet sits in the middle of the lawn; slow strokes (a drag, or taps)
  fill its contentment, hearts float up and a light haptic lands with each stroke; a frantic rub barely counts;
  stopping lets it ease back a little, never below the last quarter reached. One calm minute, or until the pet is
  fully content; there is no way to lose. Score = contentment + a little for a steady rhythm. Route `PlayPetting`,
  listed on the Play hub and the Pet tab. The rules are pure (`pettingLogic.ts`) and tested in `games.test.ts`.
- **First game of the day earns Sprouts on its own** (roadmap, Play): `recordPlaySession` now makes the "Play with
  {pet}" task row the first time a game is finished on a day when none exists, then completes it as before, so
  playtime counts without any setup. The Play hub's wording says so; the "add the task" buttons remain as the
  explicit option. `GameId` gained `petting` (`GAME_IDS`).
- Not done: Treat Catch, Memory Match, Hide-and-Seek (roadmap); a leaderboard of any kind (by design, none).

## 2026-10-16 — Journey chapters and sequels (part two)

- **Sequels:** three "part two" journeys continue the most-picked areas (`sleep.softer_landing_2` "Both ends of
  the day", `calm.back_to_the_room_2` "Staying in the room", `rest.refill_the_cup_2` "Keeping it filled"), each
  `sequelOf` its part one, same area, seven catalog tasks. `journeysFor` lists a part two only once part one has
  been walked, right after it (callers pass `completed`); `isJourneyUnlocked`, `sequelFor`, `partOneOf`.
- **Chapters:** finishing a journey now keeps the days it was walked (`CompletedJourney.doneDays`; older entries
  without dates still work). The Journey screen of a finished journey shows its chapter (`chapterFor`: when it
  was walked, the seven lines with their dates) and a "Walk part two" button when a sequel exists. The
  Journeys list badges "PART TWO". The chapter is also what Keepsakes lists (the journey entry).
- Started by the linked session that hit its limit (the sequel content was its uncommitted work); finished
  here. Tests: `journeys.test.ts` (one part one per area, sequel invariants, gating, kept dates, chapter).

## 2026-10-16 — Treat Catch (the second active game)

`src/games/treats/`: treats fall from the top of the lawn and the person drags anywhere to slide the pet along
the ground under them; golden ones (about one in seven) count triple; forty-five seconds; a missed treat floats
off and takes nothing away (no way to lose). The whole lawn is the slider (a full-field PanResponder under the
HUD, which is `box-none`), the pet faces the way it moves, every fifth catch in a row and every golden treat
gets a cheer. Pure rules in `treatsLogic.ts` (spawn from one random number, delay and fall time that quicken
over the round, catch radius as a share of the pet's width), tested in `games.test.ts`. Route `PlayTreats`;
listed on the Play hub, the Pet tab caption and the dev previews (`?preview=treats`). `GameId` gained `treats`.
Verified on web: treats fall and land, the score counts, a drag moves the pet, the end card shows a new best.

## 2026-10-16 — "This month": insights v1

What it reads: `daily_user_metrics` for the last thirty days under the existing owner-read RLS
(`fetchDailyMetrics(start, end)` in `src/services/retention.ts`; `fetchLast7DaysMetrics` is now a thin wrapper
with the same seven-row shape, so Home, pet-talk and Our week are unchanged) and the battery answers kept on the
device (`loadEnergyHistory` in `planStore.ts`, the `floura:energy:<uid>:<date>` keys; read only, nothing leaves
the phone). Pure rules in `src/domain/insights.ts`, tested in `insights.test.ts`: the weekday care happens on
(named only when one weekday clearly leads with two or more active days), the longest stretch of days in a row
(two or more; "at least" when it touches the start of the window), the battery set against the small things done
on those days (rounded to "about N"), a headline by the share of active days, at most three observations, memorial
never cheers, nothing counts a miss. UI: `InsightsScreen` (route `Insights`, header "This month"), a Profile ›
Reflect row, a "See the whole month" button at the end of Our week, `?preview=insights`.

What it does not do: no cycle data (the roadmap's mood x energy x cycle insight is the owner's call; the
`cycleOnDevice` allow-list is unchanged), nothing new sent to the server or to pet-talk, no second streak number
(Profile already shows one; the month's longest stretch lives in the pet's narrative instead).

Caveat: `day` is assigned server-side from the client's local day only when it is within a day of the UTC date,
so care logged late at night can land on the next weekday; the copy stays at observations for that reason.

Open for the owner: own route (shipped) versus a section inside Our week; the battery keys are never pruned
(one short entry per day).

## 2026-10-17 — Review fixes for the sequels, Treat Catch and This month block

An adversarial read-only review (five readers, three refuters per finding) over the three change sets; what
it confirmed and what changed:

- **This month** no longer makes a quiet month up out of a failed request: on a failed refetch the month already
  on screen stays and an error line shows; on a failed first load there is an empty state with "Try again"
  instead of "Nothing logged this month". **Our week** got the same treatment for its metrics fetch (it used to
  swallow the failure and tell an empty week). The weekday chart's screen-reader label names only the weekdays
  with care on them; today counts as a weekday only once something happened on it; "mostly" is said only when
  one battery answer clearly leads with more than half the checks; the "at least" stretch line hedges ("may have
  begun before the month did"); the stretch line and the empty battery card stay out of memorial; rows round
  the tasks-per-day once.
- **Journeys:** memorial never cheers (no success haptic, no ding, no "so proud of you" on a journey step or
  start; the hub drops "with {pet}" lines); the done-day check uses `ink.primary` instead of a hex literal; when
  part two is offered the bottom "Walk it again" button is secondary so the page has one primary action; the
  active card says "about <date>, a step a day" rather than "at this pace".
- **Treat Catch:** the end card never counts the misses; the biscuit sprite colours moved to tokens (`brand.biscuit*`,
  `brand.goldRim`); the lawn slider has increment/decrement accessibility actions so a screen-reader user can
  move the pet; Reduce Motion no longer makes treats fall faster (it only drops the flourishes); the catch-radius
  test sits on the boundary on both sides.

Not changed, for the owner: the review also noted that the journey screens compute `today` once per mount (a
step finished after midnight is stamped with the previous date key), the same pattern Home uses; and that
`chapterFor` measures the walked span from the day the journey was started, not from the first step done.

## 2026-10-17 — Memory Match (the third active game)

`src/games/memory/`: cards lie face down on the lawn, each hiding a care glyph (one Ionicons outline glyph per
care category: leaf calm, moon rest, sun energy, bulb focus, walk body, water nourish, heart connection, ball
play; the cycle category is left out). Tap two: a pair stays face up with a small check, two that differ turn
back by themselves after a second (or at once when the next card is tapped, so nobody waits). Three boards, four,
six and eight pairs, dealt one after another with the pairs carried over; no clock and no way to lose. A "Finish
here" pill (shown once a pair is found) ends the round whenever it feels like enough; clearing the third board
ends it on its own. Score = pairs found (18 at most); the end card is the usual one (best score, the first game
of the day completes the play task). Nothing counts a mismatch: the round keeps no tally of them, and the
summary only ever says what was found ("N pairs, M of them from memory" when the card that completed a pair had
been turned over on an earlier turn).

- Pure rules in `memoryLogic.ts` (deal with an injected random source, flip / match / mismatch / board cleared,
  next board, layout four across between the HUD and the pet, summary), tested in `games.test.ts`.
- `MemoryGameScreen.tsx`: GameField + cards as `PressableScale` buttons that flip on a narrowing scaleX (Reduce
  Motion: they just switch) and deal in with a small stagger; colours only from `useTheme().tone(category)` and
  the paper of the hour (backs are `paperOverScene` with a play-gold paw); the pet sits under the cards, faces the
  side of the card just turned, cheers a pair and loves a cleared board; one-shot timers in refs (mismatch, next
  board, end). Every card is a labelled button ("Card 3, face down", "Moon", "Moon, a pair").
- Route `PlayMemory` (fullScreenModal); listed on the Play hub ("Three boards, no clock"), the Pet tab caption
  and the dev previews (`?preview=memory`). `GameId` gained `memory`; the `pet_played` event's category is free
  text, so nothing server-side changes.

Verified on web (375x812, night and `&hour=12` day paper): cards deal, flip, match and turn back; board 1 → 2 → 3
with the hint between boards; "Every board cleared" ends on the end card ("New best! 18"); Play again resets;
"Finish here" ends early with the pairs so far. Signed in as the seeded demo user through Home › Play › Memory
Match: "New best! 10 · +2 Sprouts for the garden", the play task created and completed, the hub showing "Best 10"
and "1 game today". `npm run check` green (45 suites, 354 tests).

For the owner: the roadmap pictures Memory Match with "your pet's moods and outfits" on the cards. That needs the
portrait anchors and the wardrobe (items 1 and 4), so this version uses the care glyphs; the faces are one list
(`MEMORY_FACES`) and can become the pet's moods and outfits once those exist.

## 2026-10-17 — The Sunday scrapbook

Once a week, on Sunday, the pet keeps one page about the week (strategy weekly loop: "[Pet] put together your
weekly scrapbook"; roadmap item 8). `src/domain/scrapbook.ts` (pure) builds the page from the same week story as
Our week (`buildWeekStory`: kept wins, heavier days, the fullest day, energy) plus what the phone already keeps
(journey steps walked that week or a journey finished, the biggest Days Together milestone reached that week):

- a note in the pet's chosen voice (warm / gentle / plain; full, steady, light, quiet or heavier week; memorial
  in the third person and never cheering),
- stickers for what happened (milestone, journey, fullest day, "mostly good", "N days of care", "Tuesday felt
  heavier · {pet} stayed close"), each an outline glyph on its category tone with a slight static tilt,
- the wins from the check-ins as taped notes (four on the page, "and N more" after),
- "Nothing to fix, just a look back", or on the Sunday itself "{pet} keeps adding to this page until tonight".

Which week: the newest page ends on the Sunday just gone (today on a Sunday) and covers Monday to Sunday. No page
for a week that ended before the pet moved in (`prefs.completedAt`, as Keepsakes uses). Nothing counts a miss: no
"of 7", no empty days listed, a quiet week still gets a page ("A quiet week, and that's allowed").

Storage: pages are kept on the device (`floura:scrapbook:<uid>`, `src/services/scrapbookStore.ts`), one per
Sunday, newest first, a year at most, plus the newest page opened. The newest page is rebuilt each time it is
opened and replaces its stored copy; earlier pages open from the book exactly as they were kept. A failed fetch
never makes a quiet week up: the stored page shows with an error line, or there is a "Try again" state. No schema
change, no new RPC: it reads `checkins` and `daily_user_metrics` as Our week does, and on its Sunday it calls the
existing `markWeeklyReflectionViewed` (the `profiles.last_reflection_viewed_week` column), so Profile's Our week
badge clears too.

Where it shows: route `Scrapbook` (`src/screens/ScrapbookScreen.tsx`, "Earlier pages" under the newest one,
`?preview=scrapbook`); Profile › Reflect › Scrapbook with a quiet "New" until the newest page is opened; "Open the
scrapbook" at the end of Our week; on Home the week card's link reads "{pet} put together the week's page" (and
opens it) on its Sunday and the Monday after, only while unopened and never in memorial; the Sunday reminder
("{pet} put together your week") now opens the Scrapbook instead of Our week.

Verified on web as the seeded demo user: Profile showed Scrapbook "New"; the page for 5–11 Oct built from the
seed (note, stickers, four notes + "and 3 more"); with the browser clock moved to Sunday 18 Oct, Home's week card
said "Biscuit put together the week's page", which opened 12–18 Oct (a "Three days together" milestone sticker,
the fullest day, "keeps adding to this page until tonight") with 5–11 Oct under "Earlier pages", which opened as
kept. Day paper and memorial checked in `?preview=scrapbook`. Tests: `scrapbook.test.ts`.

For the owner (strategy differences): the strategy pairs the Sunday page with a room item and, later, voice
notes; neither exists yet (wardrobe/room items are roadmap item 4, voice notes need recording), so the page has
neither. Pages live on the phone they were made on, so a new phone starts a new book; keeping them across devices
would need a table (a schema change, so the owner's call). The shareable card of the real pet next to the
painting (roadmap item 8) is still to come.

## 2026-10-17 — Launch blockers: account deletion, forgot password, privacy policy

The owner asked how close the app is to launch. Features are well past the strategy's MVP; what stands between
`main` and the App Store is plumbing and owner accounts. The living checklist is now `docs/LAUNCH.md` (what blocks
App Review, what blocks a good launch, what can wait for 1.1, and who does each item). This set builds the three
blockers that needed no owner input.

**Delete account (App Store Guideline 5.1.1(v)).** Profile › Account › Delete account opens `DeleteAccount`
(`src/screens/DeleteAccountScreen.tsx`): what goes, in plain words (memorial-aware), one deliberate step (type
"delete"; works the same on phones and web, no dialog), "Keep my account". `src/services/accountDeletion.ts` runs
the order that keeps a failure harmless: (1) remove the person's photos in the private `pets` bucket through the
Storage API (SQL may not delete storage rows); (2) the new `delete_my_account()` RPC
(`local-backend/sql/delete_my_account.sql`, migration `20261017160138_delete_my_account`), SECURITY DEFINER,
deletes `auth.users` for `auth.uid()`, every public row cascades; (3) wipe every AsyncStorage key that carries the
user id (cycle, journal, plan, journeys, scrapbook, milestones...) plus the two legacy global keys, and cancel the
reminders; (4) a local sign-out. A failure at (1) or (2) leaves everything, phone included, as it was.
`local-backend/supabase/tests/05_delete_my_account.test.sql` proves every `user_id` column in public cascades from
auth.users (new tables are covered automatically), that A's delete removes every row of A and none of B's, and
that anon / a token without a user id cannot call it. Verified on web against the local stack with a throwaway
user (pet, check-in, tasks, two photos): after "Delete my account" the database held 0 users, pets, tasks,
check-ins and photos for it, the demo user was untouched, the phone keys were gone and the app was on sign-in.
**On Bloom since 2026-10-17** (owner's OK in chat; applied through the Supabase MCP, which recorded it as
`20261017160138`, so the local file was renamed to match). Checked there, read-only: security definer, `search_path`
pinned, owner `postgres` may delete from `auth.users`, `authenticated` may execute and `anon`/`public` may not,
all 23 public `user_id` columns cascade from `auth.users`, and no foreign key in any schema blocks deleting a user.
The security advisor's only new line is lint 0029 (signed-in users can execute a SECURITY DEFINER function), the
same expected flag `complete_task` and the garden RPCs carry: the function only deletes the caller.

**For the owner, found while applying it:** Bloom holds a 30th migration this repo does not have,
`20261016014418_wardrobe_v1` (tables `wardrobe_items`, `user_wardrobe`, `wardrobe_purchases`, `pet_outfits`; RPCs
`buy_wardrobe_item`, `equip_outfit`). It is in no branch on GitHub, so it was applied from somewhere else (a
claude.ai cloud session or the second PC). Nothing was changed; its tables cascade from `auth.users`, so account
deletion covers them. Its SQL should be committed (from wherever it was written) before anyone runs `db push` from
this repo, or the CLI will report the remote has a migration the repo lacks.

**Forgot password.** "Forgot your password?" on sign-in opens `ForgotPassword`
(`src/screens/ForgotPasswordScreen.js`): email → a one-time code by email → code + new password. A code rather
than a link because a link needs a deep link back into the app (no scheme yet; Expo Go and the web preview cannot
do it). Never says whether an address has an account. A correct code signs the person in (Supabase recovery), the
new password is set right after, a dialog says how it went. Messages in `src/utils/authMessages.ts`
(`resetRequestOutcome`, `resetVerifyOutcome`, tested). The email: `local-backend/supabase/templates/recovery.html`
(just the code). Locally the stack now runs Mailpit (`[inbucket]`, http://127.0.0.1:56324) to catch it. Verified
on web: code arrived in Mailpit, the new password signs in (200), the old one is refused (400). **For Bloom:** paste
that template into Authentication › Emails › Reset password, or the email only has a link the app can't use.

**Privacy policy.** One source, `src/legal/privacy.json`, written from what the code actually does (what is on the
server, what stays on the phone, Supabase us-east-1 for hosting, Google Gemini only when a painting is asked for,
OpenAI only for Pet Talk, no analytics/ads/tracking, local notifications, deletion in the app). Shown in the app at
Profile › Account › Privacy (`src/screens/PrivacyScreen.tsx`, works offline) and exported as a hostable page
`docs/legal/privacy-policy.html` by `node scripts/export-privacy.js`; `privacyPolicy.test.ts` fails if the page
drifts from the JSON. **It is a draft, not legal advice**: the owner should read it (ideally a lawyer too), fill in
`contactEmail` (the contact block stays hidden while it is empty) and host the HTML page for App Store Connect.

Also: `02_storage_isolation.test.sql` sets `storage.allow_delete_query` at the top. Newer local storage images
refuse any direct SQL delete on storage.objects (`storage.protect_delete`), so its delete probes were testing that
guard instead of RLS and the file failed before this change set (pre-existing, unrelated to the new code).

For the owner: Delete account is reachable from Profile, so someone stuck part-way through onboarding cannot reach
it (they can sign out); Apple only asks that it is in the app, which it is. Terms of Use: Apple's standard EULA
covers a free 1.0; the Club (auto-renewing subscription) will need a Terms link on the paywall.

## 2026-10-17 — The app is Luna: store identity, icon, build config

Owner's decision in chat: **launch as Luna**, set up the app identity and make the docs say Luna.

**Identity (`app.json`).** Name and web name `Luna`, slug `luna`, URL scheme `luna`, iOS bundle id and Android
package **`com.lunapet.app`** (my pick: the owner asked for an id without naming one; it can still change freely
until it is registered in the Apple Developer portal, and `com.luna.app`-style ids are almost surely taken).
`supportsTablet: false` for 1.0 (the layout is phone-first; no iPad screenshots or iPad review), and
`usesNonExemptEncryption: false` (HTTPS only), which skips the export-compliance question on every upload.

**Permissions, checked with `npx expo config --type introspect`.** The final Info.plist asks only for photos and
the camera, in Luna's own words. Three defaults were removed because the app never uses them and App Review
questions declared-but-unused capabilities: the microphone string (expo-audio and expo-image-picker both add one;
nothing records), **background audio** (`UIBackgroundModes: audio`, expo-audio's default; Guideline 2.5.4; the
app only plays short sound effects in the foreground) and a generic Face ID string from expo-secure-store (the
session token is stored without biometrics). Android blocks `RECORD_AUDIO`. `src/__tests__/appIdentity.test.ts`
keeps all of this from drifting back.

**Icon.** The old `assets/icon.png` was Expo's grey placeholder grid, which App Review rejects. The new one is the
app's own golden dog (PetRig's default dog, its eight layers captured from the web build into
`assets/brand/luna-dog.svg`) sitting in front of a full moon on the dusk sky from the tokens, on a plum hill.
`node scripts/build-app-icon.js` renders `icon.png` (opaque, as iOS requires), the Android adaptive foreground and
background (dog and moon inside the launcher's safe circle), `splash-icon.png` (on dusk `#3E4878`) and the favicon,
and writes `assets/brand/icon-source.svg` for a designer to start from. A v1 icon the owner may want a designer to
redo; it reads clearly at 60 px.

**Builds (`eas.json`).** `preview` (internal distribution) and `production` (auto-incremented build numbers, remote
version source), both with `APP_ENV=staging`, so `app.config.js` takes the hosted backend from EAS environment
variables and refuses a server key. `eas init` (project id) and the two EAS env vars are the owner's, once the
Expo account exists; steps in `docs/LAUNCH.md` ("First build"). `expo-dev-client` is deliberately not added yet:
installing it makes `expo start` default to a development build, which would break today's Expo Go workflow.

**Name in the app and docs.** The privacy policy (in the app and the exported page), the root `CLAUDE.md`, ROADMAP
(now "Luna Club"), LAUNCH, the design system, READMEs and the strategy summary (with a note that the research
says Flora / Floura) say Luna. Left on purpose: the on-device storage keys (`floura:*`; renaming them would wipe
everyone's journal, cycle notes, plan and scrapbook), the local stack's `floura-local` id and demo emails, the repo
and folder names, and historical records (dev-notes, RESTORATION_*).

For the owner: the App Store *listing* name must be unique across the whole store, so plain "Luna" will very likely
be refused; plan on a subtitle-style name such as "Luna: Self-Care With Your Pet" (the name under the icon stays
"Luna"). A trademark check on "Luna" in the wellness/app classes is still worth doing before launch.

## 2026-10-17 — A crash screen instead of a blank app; App Review notes

Nothing in the app caught a rendering error: one failing screen meant a white page on web and a closed app in a
release build. `src/components/AppErrorBoundary.tsx` now wraps everything in `App.js`: a calm dusk screen (the
splash's sky, a moon, "Something went sideways", "Everything you've saved is safe", "Try again"), drawn with plain
views and token values only, because the error may come from the theme, the pet or navigation. "Try again"
remounts the tree with fresh state. Each crash goes to `diagLog` (`APP_CRASH`, message and the first six
component-stack lines, nothing more, since props can hold user text), which TestFlight testers can copy from
Diagnostics (Profile, tap the version five times). Crash reporting proper (Sentry) waits for the owner's account;
it hooks into `componentDidCatch`. Tests: `appErrorBoundary.test.tsx` (fallback shown, crash logged, retry
remounts, copy never blames or mentions loss). Verified on web with the new dev preview `?preview=crash`; the
previews also gained `privacy`, `delete` and `forgot`.

`docs/LAUNCH.md` gained "App Review: demo account and notes": the review account the owner creates on the TestFlight
build, and reviewer notes pointing at Delete account, Privacy, the on-device cycle tracking and the camera/photos
use.

## 2026-10-17 — Cozy Run (streaks without shame)

Owner's decision in chat: build Cozy Run "using the rules in ROADMAP as written" and drop the "Never a streak" line
from onboarding. That line ("One gentle hello a day, in their voice. Never a streak, never a nag.") had already left
with Onboarding v2 (`b99d97f`); nothing in the app promises "no streaks" now. The closest line, the quiz's "They never
scold and never count what was missed", stays true: the run counts days of care, never misses.

**Rules (`src/domain/cozyRun.ts`, pure, 20 tests in `cozyRun.test.ts`).** Where the ROADMAP left room, my reading:
- A day of care is a cozy day (03:00 to 02:59) with a task or journey step done, a check-in or a game
  (`task_completed`, `checkin_submitted`, `pet_played` in `user_events`, bucketed on the phone by local time).
- The run is the number of days of care. Covered days keep it going without adding to it.
- A quiet day is covered, in order, by a logged period day (only while Cycle tracking is on), a Cozy Pause, one of
  the week's 2 Nap Days (calendar week, Monday to Sunday, per run), or a Warm Blanket (1 per 7 days of care in the
  run, at most 3 held). Today is never judged until it is over.
- With no cover the run rests. The 5 days after it are the mending window; 3 days of care in it mend the run (the
  resting days show as mended, the days of care join the run). Period and paused days in the window extend it by a
  day instead of using it up. When mending can no longer happen the run is kept as a chapter (3 days or more; a
  1-2 day beginning is not a chapter) and the next run starts with the first day of care after the rest.
- Cozy Pause: 1, 3, 7, 14 or 30 days from today; ending it early keeps the days already paused.

**Where it lives.** `services/cozyRunStore.ts` reads only `occurred_at` of those events (paginated, last 200 days),
keeps the last good list on the phone (a failed fetch never shows a run as resting) and stores pauses and kept
chapters per user (`floura:cozy-days|cozy-pauses|cozy-chapters:<uid>`; account deletion wipes them, since its key
filter matches the user id). `services/retention.ts` and `games/playStats.ts` call `noteCare` after a care event is
logged, so the chip moves at once. `hooks/useCozyRun.ts` adds period days from the cycle tracker on the phone, which
is why it joins the `cycleOnDevice.test.ts` reader list (it sends nothing about the cycle anywhere; a test checks
the store never writes to the server and never reads the cycle store).

**Where it shows.** Home: a third chip under Days Together and Sprouts ("12 cozy run" or "resting"), which opens the
Cozy Run screen; hidden in memorial and before the first day of care. Profile: the stat strip is now "days in your
cozy run" and "longest run" (it was the server's strict "days in a row"), plus a Cozy Run row. Pet: the same number.
`CozyRun` screen (`src/screens/CozyRunScreen.tsx`, `?preview=cozy`): the count, a line that never mentions what was
missed, the last two weeks as small marks (care, nap, blanket, period, pause, mended, resting), Warm Blankets,
the pause card, how it works, earlier runs kept. Scrapbook: a run that came to rest that week becomes a "A 21-day
cozy run, Kept as a chapter" sticker. The server's `recompute_pet_state` streak is still computed (Talk uses
`pet_state`); it is no longer shown.

Verified on web as the demo user: the demo's care days (30 Sep, 1 Oct, 15-16 Oct) gave a 2-day run exactly as the
rules say (naps on 2-3 Oct, rest on the 4th, no mending, 2 days not kept as a chapter); marking a task done moved the
Home chip from 2 to 3 at once; Profile showed 3 / 3 and the row; a 3-day pause read "Paused until Monday. Your 2-day
run waits for you." and ending it on its first day removed it.

For the owner: runs live on each phone (pauses, kept chapters), like journeys and the scrapbook; the count itself is
rebuilt from the server's events, so a new phone shows the same run but not older chapters or past pauses. Nap Days
are per run, so a run that starts mid-week gets two fresh ones.

## 2026-10-17 — The TestFlight phone pass and the launch-week numbers

Two launch tools, no app code changed (the owner is working on the EAS setup in the same checkout, so this set
touches only new files and this log):
- `docs/TESTFLIGHT_PASS.md`: a 45-minute script for the first real-phone run (LAUNCH item 12): first run and the
  permission prompts, Home and daily care (Cozy Run included), offline and background, the five games, the rest of
  the app, Larger Text and VoiceOver, reminders overnight, forgot password and delete account on a throwaway
  account, with what each step should show. It complements the owner's `TESTFLIGHT_AUDIT_2026-10-17.md` (automated
  evidence and release gates).
- `scripts/retention_report.sql`: read-only queries to paste into Bloom's SQL editor: sign-ups and onboarding per day,
  D1/D7/D30 by weekly cohort (blank, not 0%, until a cohort's day has come), DAU/MAU over 30 days, and how the
  paintings are doing (ready / processing / stuck / error). Active = a day of care, as Days Together counts it.
  Ran clean against the local database.

For the owner, found while writing the script: game sound effects play even with the silent switch on
(`playsInSilentMode: true` in `src/utils/sfx.js`). Most calm, non-media apps stay quiet on silent; the script asks you
to judge it on the phone. It is a one-line change either way.
**Decided the same day:** the owner chose to respect the silent switch. `sfx.js` now sets
`playsInSilentMode: false` and, explicitly, `interruptionMode: "mixWithOthers"` (expo-audio's default; a ding never
pauses the person's music). `appIdentity.test.ts` guards both; step 3.1 of the phone pass checks it.

## 2026-10-17 — Privacy policy, checked against the facts; Help & support page

From the owner's TestFlight audit, gate "Privacy/support": review the policy's provider, device-backup and backup
wording, and have a support page to host.

**Provider terms, read on 2026-10-17.** Gemini API terms (effective 23 March 2026, ai.google.dev/gemini-api/terms):
on **unpaid** use Google may use what is sent (our users' pet photos) to improve its products and human reviewers may
read it; on **paid** use Google does not, and logs prompts and responses for a limited time only to detect abuse.
Apps that serve users in the UK, the EEA or Switzerland may use **only** paid services. Luna's audience includes the
UK, so **the Gemini key must come from a billing-enabled Google Cloud project** (for the law and for the policy's
words). OpenAI's API docs: API data is not used for training by default; abuse-monitoring logs up to 30 days (only
matters if Talk is ever turned on).

**Policy changes (`src/legal/privacy.json`, re-exported).** "Cycle tracking never leaves your phone" became "stays on
your phone: it is never sent to us or to anyone we work with", and a new paragraph says the phone's own iCloud or
Google backup can include what Luna keeps on the phone (AsyncStorage lives in backed-up app storage on iOS). The
providers say what Google and OpenAI do with what they receive (paid API, abuse logs). Backups: "our database
provider's encrypted backups expire on their own, within 30 days at most" (Supabase Pro keeps daily backups 7 days).
Cozy Run pauses join the on-phone list. Tests pin the backup sentence and the paid-API wording.

**Help & support.** `src/legal/support.json` (nine questions: password, deleting, painting, Cozy Run, reminders, a new
phone, a pet that has passed away, medical, who sees data) is shown at Profile › Account › Help & support
(`src/screens/HelpScreen.tsx`, `?preview=help`) and exported to `docs/legal/support.html` by the same script as the
policy (one contact email, privacy.json's; hidden while empty). A test checks the answers name buttons that exist
("Forgot your password?", "Delete account", "Change pet photo"). Host both HTML files together (the support page links
`privacy-policy.html`); the two URLs go into App Store Connect.

## 2026-10-17 — Sign-up confirmation by code

Bloom has email confirmation on (owner's audit). Its "Confirm signup" email carries a link to the project's Site
URL, and nothing in Luna lives at that address yet, so on a phone the link opens a dead page right after sign-up
(the account is confirmed anyway, but it looks broken). Same answer as the password reset: a 6-digit code typed into
the app, which needs no website and no deep link.

- Sign-up: when signUp returns no session, the app opens `ConfirmEmail` (`src/screens/ConfirmEmailScreen.js`,
  `?preview=confirm`): the code (verifyOtp type "signup"), "Send a new code" (auth.resend type "signup"), "Tapped the
  link instead? Then you're confirmed: go back and sign in", Back to sign in. A correct code signs in and onboarding
  starts on its own.
- Sign-in with an unconfirmed address: the notice now mentions the code and the link, with "Enter the code from the
  email" opening the same screen.
- Messages: `signupConfirmOutcome` in `authMessages.ts` (tested); the sign-up and not-confirmed notices mention the code.
- Email: `local-backend/supabase/templates/confirmation.html` (code only, like the reset email). **For Bloom:**
  paste it into Authentication › Emails › Confirm signup, next to the Reset password one. Until then Bloom's email has
  only the link: the screen's "tapped the link instead" line still gets people through.
- Local config: `enable_confirmations` stays false (instant local sign-ups); the comment says how to flip it.

Verified on web against the local stack with confirmations switched on for the test (restarted with the CLI
directly, not `npm run backend:start`, so the owner's in-progress migration build was not re-run), then switched
back: sign-up opened Check your email, Mailpit had "Your Luna code", a wrong code said "That code didn't work…", the
right one landed in onboarding; an unconfirmed account's sign-in showed the notice and the link, "Send a new code"
said "A new code is on its way" and the newest code worked. The two probe accounts were deleted afterwards.

## 2026-10-17 — Accessibility pass: VoiceOver and Larger Text (Home, onboarding, Cozy Run, sign-in)

Owner's request. Audited on web (RN web turns labels and roles into the accessibility tree) with a script that lists
every control without a spoken name, then fixed the shared kit first, since every screen builds on it.

**VoiceOver**
- `TextField`: the input is named by its label ("Email"), not its placeholder ("you@example.com"); the note is its
  hint; the visible label is not read twice.
- `Chip`: a `role` prop. Action chips are buttons (Cozy Run's pause chips used to read "checkbox, unchecked"); one-of-a-
  set chips are radios (reminder and onboarding times, name ideas, Add-your-own's colour and minutes).
- `Card`: a labelled card is now one element (iOS ignored a label on a view that was not `accessible`); Keepsakes'
  label gained the date, since grouping hides the line that showed it.
- Home: the pet was two focus stops (an unnamed pressable around "Your pet, looking sleepy"); it is one button, "Say
  hello to Biscuit" (or "Biscuit, resting"), via `GardenStage`'s new `petLabel`. Hero chips read "6 days together",
  "Cozy Run: 3 days" (hint: opens it), "5 Sprouts". The care toast is announced (Android had a live region, iOS
  nothing). The focus header and the prompt card no longer share a name. Energy radios carry `checked` too.
- Cozy Run: the big number is one sentence; the two-week strip (fourteen dots, labelled "S: …", ambiguous) is one
  summary from `recentSummary` ("The last two weeks: 3 days of care, 2 Nap Days. Today is still open."); the Warm
  Blankets card, the rules and the kept runs each read as one line.
- Sign-in: `AuthLayout` no longer labels the garden, which on iOS made it one element and hid "Welcome back" and the
  subtitle from VoiceOver. Errors and notices on Login, Sign-up, Forgot password and Confirm email are announced as
  they appear (`useAnnounce` in `src/utils/a11y.ts`).
- Every stack screen's back button says "Back" (`headerBackTitle`; the minimal chevron kept the route behind,
  "MainTabs", as its spoken title).
- Onboarding was already in good shape (choice cards, back, progress, headings); the species radios now carry
  `checked` like ChoiceCard.

**Larger Text**
- `Button`: `minHeight` instead of `height`, two lines, centred: a big label wraps instead of becoming "Delete my acc…".
- Pills on Home's cards grow (`minHeight`); task meta and reasons, the energy labels, "More with…" titles and the
  onboarding plan rows wrap to two lines instead of being cut at one.
- Tight spots that sit on the painting or in a row of equal cells grow only so far (`TIGHT_TEXT_SCALE` 1.3): the hero
  chips and the strip's weekday letters. Tab labels keep their size like iOS's own tab bars
  (`tabBarAllowFontScaling: false`; VoiceOver still reads them).

Tests: `accessibility.test.tsx` (Button name/state/wrapping, Chip roles, TextField naming, Card grouping) and
`recentSummary` in `cozyRun.test.ts`. Verified on web: no unnamed controls on Home, Cozy Run, sign-in or the first
onboarding steps; the labels above as listed. Not provable on web: Dynamic Type itself (RN web ignores system font
size) and state attributes (this RN web build drops `accessibilityState`; iOS reads it natively). Both are in the
TestFlight pass (4.8 Larger Text, 4.9 VoiceOver).

## 2026-10-18 — Accessibility pass, part two: the rest of the app and the games

Owner's request: carry the pass through Garden, Pet, Profile, the games, journal, check-in and the other screens.
Audited every screen through its dev preview with the same script (controls without a spoken name, roles, headings).
Garden, Profile, Check-in, Journal, Breathing, Our week, Scrapbook, This month (its bars already had labels), Cycle,
Reminders, Memorial, Play, Tasks, Habits, Journeys and Keepsakes came back clean. `JournalScreen.tsx` has the
owner's uncommitted work and needed nothing, so it was left alone.

**Fixes**
- Pet tab: the pet says "Say hello to Biscuit" (`petLabel`, as on Home); Profile's portrait is named; the hidden
  version line is text, not a nameless control; the focus picker's backdrop and Diagnostics' buttons have roles.
- Breathing: each phase is spoken ("Breathe in", "Hold", "Breathe out") with its haptic, so it can be followed
  with eyes closed or VoiceOver on.
- Larger Text: plant names, journey titles and the reminder preview wrap to two lines; the games' score bar and hint
  sit on the play field and grow to 1.3x at most (the check-in mood words already shrink to fit).

**The games, by ear** (they had labels but needed a drag or a stroke, or showed what VoiceOver could not say)
- Fetch: double-tap the ball throws it; "Short throw" / "Long throw" are in its actions (`accessibleThrow`, the
  same physics as a flick, so it scores like any throw).
- Pet the pet: each double-tap is one stroke (a steady rhythm still builds the purr), and the meter's stages are
  spoken as they are reached.
- Treat Catch: swipe up/down moves the pet a third of the lawn at a time, to the middle of it; each new treat is
  announced by third ("Left", "Golden, right"); the control's value is where the pet stands. From the middle of a
  third the pet's reach (99 px) covers the whole third on every iPhone width, so playing by ear is fair; a test
  checks it for 320 to 440 pt.
- Memory Match: each turned card and its outcome are spoken ("Moon. A pair!", "Not a pair; they turn back.").
- Every game's end card reads the result aloud ("Good game. Score 12. …"); the score number says "Score 12".

Tests: `gamesByEar.test.ts` (the throw, thirds and cues, the fairness check, flip cues, and that each game keeps its
action and its announcements). The phone pass gained step 3.4 (each game with VoiceOver). Not provable on web:
VoiceOver actions and announcements themselves (RN web has neither); the pass covers them on the phone.

## 2026-10-18 — The welcome-back moment

Owner's request: what someone sees after days away, with the Cozy Run resting or kept as a chapter.

Before: after 2+ days away Home's header said "Welcome back" (5+: "You're back!") for the day, the pet reacted, and
the plan was kept small (Graceful Hibernation, `hibernation.ts`). That stays. New: the first open of the return day
also brings a small sheet over Home (`WelcomeBackSheet`, rules in `src/domain/welcomeBack.ts`, 7 tests), once per
return (`floura:welcome-shown:<uid>`):
- a title and a line in the pet's chosen voice (warm, gentle, plain; a longer version after 5+ days);
- "Still 34 days together. Nothing was lost.";
- the Cozy Run, read from its own marks since the last open: "Your 12-day cozy run kept going: 2 Nap Days and a Warm
  Blanket covered the quiet days." / "… is resting. 2 days of care by Tuesday, today included, and it mends." /
  "Your 12-day cozy run is kept as a chapter. Today's first small thing starts a new one.";
- "Today is small on purpose. One thing is plenty." Buttons: "Let's start small", and "See the Cozy Run".
It never says how long someone was away or what they missed (a test checks the words). Memorial keeps its own quiet
greeting and gets no sheet. It waits for the Cozy Run (and up to 2.5 s for Days Together) so nothing pops into it,
and a Days Together milestone reached the same day waits until it is closed: one sheet at a time. The last-seen day
is per phone, so if the run started on another device since, the run line is left out rather than guessed.

Verified on web as the demo user by moving `floura:last-seen` back: three days away showed "Biscuit saved your spot",
the together line, "Your 3-day cozy run kept going." and the small-day line; "See the Cozy Run" opened it; a reload the
same day did not show it again; a week away showed "Biscuit is so glad you're here". The resting and chapter wordings
are covered by the tests (the demo's data has neither).

## 2026-10-18 — The shareable card (ROADMAP item 8)

Owner's request: the real pet next to the painting, ready to post. Pet tab › "Share a card" (only when there is a real
photo; never for an adopted companion) opens `ShareCard` (`src/screens/ShareCardScreen.tsx`, `?preview=share`): a 9:16
card (`src/components/share/PetShareCard.tsx`, the shape of TikTok, Reels and Stories) on the app icon's dusk sky:
"LUNA", "Meet Biscuit" ("Always Biscuit" in memorial), the real photo as a tilted polaroid ("Real life"), the painting
as a second one ("Painted by Luna", or the drawn pet, "Drawn by Luna", until a painting exists), and "Made with Luna ·
self-care with your pet". Wording in `src/domain/shareCard.ts` (5 tests). "Share the card" waits until both pictures
have loaded, then turns the card into a PNG on the phone with `react-native-view-shot` (already a dependency, so
`package.json` is untouched) and hands it to the iOS share sheet through React Native's `Share` (TikTok, Instagram,
Messages, Save Image). Nothing is uploaded (a test checks the screen has no upload or network call). The card's text
does not scale with Larger Text on purpose: it is a picture with a fixed layout; the screen around it does.

Verified on web as the demo user (who has a photo and a painting in local storage): the card, the button becoming
ready once the pictures loaded, and a 670x1192 PNG with both pictures. On web the card downloads instead of sharing,
and the web capture library draws the tilted frames a little off (the first nudges into the title); on iPhone the
capture is a native snapshot. For the owner: Android's `Share` cannot send a file (1.0 is iPhone only; expo-sharing
would be the Android answer later), and the painting reveal screen would be a natural second place for the button
(left out: it is part of the painting flow you are working on). Phone pass: step 4.2b.

## 2026-10-18 — The share card at the painting reveal

Owner asked to offer the card at the painting reveal as well, without touching `src/services/petStylize.js` (it is
not touched). Two places now offer it, both only once the painting really exists, so the first card someone posts is
the painted one (`canShareAtReveal` in `src/domain/shareCard.ts`: painted, a painting stored, a real photo, not an
adopted companion):
- Onboarding's reveal step: a quiet "Share Biscuit's card" under "Looks good" once the painting finished (not when
  the photo was kept or the painting failed). New accounts are still in the pet-setup stack there, so `ShareCard` is
  also registered in that stack in `app/navigation/RootNavigator.js`, with the same themed header as in the app.
- The painting result screen (`app/screens/PetStylizeResultScreen.js`): "Share the card" between Done and Try again
  when the painting was saved with the pet.

2 more tests in `shareCard.test.ts` (the reveal rule; the route exists in both stacks and onboarding uses the rule).
Verified on web as the demo user: the result screen shows "Share the card", and it opens the card with the real photo
and the painting. The onboarding reveal needs a real painting (Gemini), so it is on the phone pass (step 1.7).

## 2026-10-18 — App Store privacy label drafted (LAUNCH.md item 6)

The App Privacy answers now live in `src/legal/appPrivacy.json`, and `node scripts/export-privacy.js` turns them
into `docs/store/app-privacy.md`: the sheet to copy into App Store Connect > App Privacy, in the questionnaire's
order (collect data: yes; the types to tick; purposes, linked, tracking for each; what the store page will show;
what is not ticked and why; where each piece lives). The draft: Email Address, Health (the check-in mood, declared
to be safe), Photos or Videos, Gameplay Content, Other User Content, User ID, and Product Interaction (App
Functionality plus Analytics, because `scripts/retention_report.sql` counts events across everyone). Everything is
linked to the account; nothing is used for tracking. Cycle tracking stays off the label because it never leaves
the phone.

`src/__tests__/appPrivacy.test.ts` (9 tests) keeps it honest: it reads the app's code for every table, database
function, server function and storage bucket, and fails when one is missing from the label or the label lists one
the app no longer uses; checks that every type is Apple's own wording and that every type Apple asks about is
either ticked or explained; fails if an SDK that tracks, advertises, measures or reports crashes is added (Sentry
included, so wiring it means updating the label first); and checks that the policy says the same things.

Three small changes came out of reading the data flows:
- The check-in event (`user_events`, via `logCheckinSubmitted` in `src/services/retention.ts`) no longer copies the
  check-in's note: it records the mood and `wrote_note: true/false`. Nothing read the copy. Verified on the local
  stack: the check-in kept the note, and the event held `{"mood": 4, "wrote_note": true}`. Events already on Bloom
  still hold old notes; if you want them gone (it is a few beta accounts), this is the one-off, **not run**:
  `update public.user_events set meta = meta - 'win_text' where event_type = 'checkin_submitted' and meta ? 'win_text';`
- The startup "is the internet up" probe to `www.google.com/generate_204` (`src/utils/net.ts`) now runs only in
  development, so a release build talks to no one but its own backend when it starts. The Supabase health probe
  stays.
- The privacy policy (`src/legal/privacy.json`, dated 18 October, page re-exported) now says app events never carry
  the words you write, and that they are added up across everyone in our own database to see whether Luna helps
  people keep coming back. That sentence is there because Analytics is a declared purpose.

For the owner: tick item 6 as drafted in LAUNCH.md (I left that file alone while you edit it). Health for the mood is
a judgement call: Apple reviewers do not object to declaring more, and leaving it out could be. Section 7 of the
sheet lists what changes the label later (Sentry, the Club, Health steps, social sign-in).

## 2026-10-18 — TestFlight readiness audit, and five fixes before testers

Owner asked whether anything else is needed before TestFlight. A read-only audit (five areas, each finding re-checked
by a skeptic) found the repo side ready: an EAS-style dry run of the files EAS uploads evaluated the config and
plugins, Expo Doctor passed 21/21, the lockfile is in sync, the iOS Hermes bundle builds, and EAS's default SDK 57
image (Xcode 26.6) meets Apple's Xcode 26 / iOS 26 SDK upload rule. Bloom has all 31 migrations and every table, RPC,
bucket and function the app calls. What is left is the owner's (now spelled out in LAUNCH.md: "What each stage
needs", "First build", "From upload to your iPhone"): the Apple membership and App Store Connect record, committing
the release-prep work before building, sign-up email (Supabase's built-in mailer only delivers to the project's team
addresses, 2 an hour, so other testers never get their code), both email templates, and a billing-enabled Gemini key.

Fixed here, with the owner's go-ahead (including app.json and LAUNCH.md, keeping the owner's own edits in both):
1. `NSPhotoLibraryAddUsageDescription` in app.json ("Luna saves a share card to your photos when you choose Save
   Image."), so Save Image from the share card's share sheet works. Guarded in `appIdentity.test.ts`.
2. Painting failures in plain words: `src/domain/paintingErrors.ts` maps the painting function's developer messages
   ("Missing gemini_api_key secret." used to show on the Pet tab) and the client's own failures to a few sentences:
   switched off, busy, slow (a timeout, not "check your connection", as petStylize.js intends), offline, the photo
   never saved, the photo itself, or other. Used when storing `pet.processing_error` (onboarding, the older
   change-photo wait) and when showing it (Pet tab, which also covers raw strings already stored on Bloom).
   `petStylize.js` is untouched. 6 tests.
3. The offline / auth / dev banners no longer sit under the notch: RootNavigator stacks them in one column at the
   window's top inset plus the 44 pt native header, so Back and the title stay tappable while one shows.
4. After "Don't Allow" for photos or the camera, `src/utils/photoAccess.ts` explains and offers Open Settings (iOS
   never asks twice), in onboarding and pet setup.
5. LAUNCH.md (stages, first-build steps, the email blocker, both templates, the billing-enabled key, states of items 3,
   5, 6, 8, 9, 10, 12, 14) and TESTFLIGHT_PASS.md (the code-based sign-up, feedback through TestFlight, the build
   number, offline journal, relaunch, a long background, Save Image, Change pet photo, Help, Diagnostics, the
   photo-denied path, the welcome-back sheet, the memorial, section 6 moved last because it clears reminders).

The fixes went through a second review (four angles, each finding re-checked), which caught a wrong timeout message,
"your photo is safe" after a failed upload, Gemini's "rejected" blamed on the photo, the banner covering the header,
and several script rows that could not be followed as written; all fixed before this commit. Verified on web: the
Pet tab shows "Painting isn't switched on yet…" for a raw stored "Missing gemini_api_key secret." (local demo pet,
restored afterwards). Phone-only: Save Image, the banner position on a notched iPhone, Open Settings.
Watch the first upload's processing email for ITMS-90683 (microphone): expo-audio contains recording code the app
never uses; the fix would be one purpose string and a rebuild.
