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
