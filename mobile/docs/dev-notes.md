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
