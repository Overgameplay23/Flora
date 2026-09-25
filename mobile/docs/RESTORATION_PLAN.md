# Floura Restoration Plan

Companion to `RESTORATION_BASELINE.md` (2026-09-16). Risk ids (R-nn) refer to the baseline's risk register. Each phase lists the goal, the concrete work, the acceptance evidence required before the phase is called done, and the owner decisions it needs. Phases are ordered by the product question they answer.

Rules carried through every phase: no `git reset/clean/checkout`, no mass deletes, no blind reinstall; `.env` values are never printed; nothing is deployed, migrated remotely, published, or rotated without an explicit, action-time owner confirmation; `liftiq/`, `../srcd`, `../supabase` are not modified; schema-compat fallbacks stay until a live schema is proven.

---

## Phase 0 — Preserve (needs owner approval)

Goal: make the only surviving copy recoverable.

1. **Initial commit** on `supabase-only-mvp` of the Floura tree. Proposed contents: everything `git ls-files --others --exclude-standard` lists today (282 files) **plus** the restoration docs, **minus** nothing the owner has not explicitly excluded. Questions the owner must answer first (baseline section 11): include `android/` (stale prebuild, 44 files), `mobile/liftiq/` (84 files, separate product), `mobile/meadow.png` (3 MB duplicate of `assets/meadow.png`), `supabase/.temp/` (CLI cache; the first change set adds it to `.gitignore`)?
2. Optionally push to a private remote the owner controls. Not done by this engagement without a URL and approval.

Acceptance: `git log` shows the commit; `git status` clean except intentionally ignored files; `docs/baseline/manifest.sha256` re-verifies (`sha256sum -c`) for every unmodified file.

---

## Phase 1 — Can it launch? (local, no backend needed)

Goal: a reproducible green check surface and a bundle that builds.

**First change set (applied in the working tree, uncommitted, originals in `docs/baseline/originals/`):**
- `tsconfig.json`: explicit `include` (`App.js`, `index.js`, `app/**/*`, `src/**/*`, `nativewind-env.d.ts`, `expo-env.d.ts`) and `exclude` (`node_modules`, `liftiq`, `supabase`, `android`, `ios`, `dist`, `.expo`, `.expo-export-check`, `scripts`, `server`, `dataconnect`, `tmp`, `docs`). LIFTIQ keeps its own `liftiq/tsconfig.json`; nothing there is touched.
- `supabase/functions/deno.json` (new): pins the Deno lockfile location beside the functions so Deno stops writing `deno.lock` next to `package.json`; no import map (all imports are absolute URLs).
- `src/components/finchHome/FinchGardenHeader.tsx`: type the `SPARKLES` constant (`top`/`left` as `` `${number}%` ``) — the real fix for R-32, no cast.
- `supabase/functions/pet-stylize/index.ts`: narrow the background-removal response candidate to `string` before `stripBase64Prefix` (~611), and guard the `null` that `callBackgroundRemovalApi` returns when unconfigured (~788). These clear all six Deno diagnostics. Behaviour for a non-string candidate changes from a runtime `TypeError` inside the pipeline to the existing "missing image data" error; a null result now fails into the existing catch with a clear message.
- `package.json` scripts: `typecheck` (client tsc), `typecheck:functions` (Deno check of the three functions via a pinned `npx deno@2.9.6`), `test` (Jest), `export:web` (non-interactive web export to `.expo-export-check/`), `check` (all of the above). Dev dependencies `jest ~29.7.0`, `jest-expo ~54.0.18` (the SDK 54 line), `@types/jest ~29.5.14`; `jest.config.js` restricted to `src/**` and `app/**` tests.
- First unit tests (42) on pure modules: `src/utils/dateKeys.ts`, `src/domain/*.ts`, `src/utils/petState.ts`, `src/utils/env.ts`, `src/utils/guards.js`, and the pure exports of `src/services/dailyLoop.ts` / `taskCompletion.ts` with the Supabase client and native modules mocked.
- Two defects the tests exposed were fixed in the same change set (originals preserved): `getISOWeekKey` drifted one ISO week during daylight-saving time (verified against GNU `date +%G-W%V`), and `getTaskPoints` turned a NULL `points` value into 1 point instead of using the heuristic. Baseline risks R-53 and R-54.
- `.gitignore`: add `supabase/.temp/` and `.expo-export-check/`.
- `scripts/check-export-web.js` (new): sets `CI=1` and runs the local Expo CLI export so the check is identical on Windows and POSIX.

Acceptance (all must be shown, not claimed): `npm run typecheck` exit 0 with 0 errors over ~77 client files; `npm run typecheck:functions` exit 0 for all three functions; `npm test` green; `npm run export:web` exit 0; project-wide `npx tsc --noEmit` no longer reports `liftiq/` or `supabase/functions` diagnostics (they are excluded, not suppressed); `liftiq/` byte-identical.

**Then, still Phase 1:**
- Decide native strategy (owner): regenerate `android/`/`ios/` with `npx expo prebuild --clean` under a real app identity, or delete the stale folders and go CNG (config-driven). Either way R-05/R-06 close and expo-doctor's config-sync warning disappears.
- Record Node/Expo/platform versions in `docs/` for every launch check (done for web in the baseline).

---

## Phase 2 — Can a user enter safely? (backend decision + auth gate)

Goal: a signed-up user reaches Home or Pet Setup deterministically, with honest error states.

**Owner decision gate (blocking): where does the backend live?**
- Option A — **new Supabase project in this account** (recommended for a revival): fresh ref and anon key; rewrite the six `supabase:*` scripts, README, `docs/dev-notes.md`, and `.env` (owner edits `.env`); `supabase link` from `mobile/` after adding a `mobile/supabase/config.toml`.
- Option B — **another account still holds `gghesvpmskjlrlpoosgf`**: owner authenticates that account; then a read-only audit (migration history, tables, functions, bucket, secrets names) runs before anything else.
- Option C — **local Docker stack** for development while A/B is decided: owner starts Docker Desktop; `supabase start` needs `config.toml` in the workdir.

**Schema reconciliation (before any apply, produce as files for review):**
1. Rename migrations to `YYYYMMDDHHMMSS_name.sql` preserving order (`20251231000100_stabilize_schema.sql`, `20251231000200_daily_loop_schema_fix.sql`, `20260101000000_checkins_date_fix.sql`, ... `20260223000300_pet_name.sql`). Keep the originals in `docs/baseline/originals/` for history.
2. Add a `00000000000000_bootstrap` migration set generated from the six `schema_*.sql` files in dependency order (mvp -> tasks -> seed_tasks -> garden -> pet_stylize -> daily_loop_v1), made idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, guarded triggers).
3. Add the missing objects the client already expects: `pet.original_photo_url`, `tasks.points/type/difficulty/category` (or remove the client reads — decision), `garden_items.required_points`, the `pets` storage bucket with policies (see Phase 3), and either `journal_entries` + an `aiPrompt` implementation or retirement of the Journal route (decision).
4. Remove destructive statements from the reconciliation path (dedupe DELETEs run only against an empty or backed-up database).
5. Apply to a **local** stack or a **new empty** project only after the owner has read the plan; capture `supabase migration list` and `list_tables` output as evidence.

**Client work (no backend required to code, needs one to verify):**
- Auth gate (R-04): distinguish "profile unknown" from "profile has no pet"; keep the user on a loading/error state with retry instead of Pet Setup when the fetch failed; do not flip `needsPetSetup` until hydrate has settled.
- Config warning in production builds (R-07) with a clear "app is not configured" screen instead of a generic sign-in failure.
- Signup feedback when email confirmation is on (R-08); rely on the client-side profile upsert or add an `auth.users` trigger (decision — trigger is the safer default and also seeds tasks server-side).
- Stop logging emails and non-OK bodies in production (R-10); gate `Diagnostics`/`NetworkDebug` behind `__DEV__` or an explicit flag (R-11).
- Measure the persisted session size against SecureStore's 2048-byte cap (R-09); if exceeded, chunk or move the session to a large-value store.

Acceptance checklist (record evidence per item): sign-up -> profile row -> user_stats row -> 3 seeded tasks; sign-in with valid/invalid credentials; sign-out; cold start restores the session; airplane-mode start shows the network banner, not Pet Setup; placeholder config shows the config screen; no email/token/UUID in production logs.

---

## Phase 3 — Can the pet be created and rendered?

Goal: photo -> stylized pet visible on Home, Pet, Garden; never blank, stretched, another user's, or stuck.

- Storage design (R-13/R-14/R-23): one **private** `pets` bucket with `storage.objects` policies scoped to `auth.uid()` on the `original/<uid>/...` and `processed/<uid>/...` prefixes; serve processed images through short-lived signed URLs minted on read (or a signed-URL RPC), not permanent public URLs; stop persisting expiring URLs in `pet.photo_url`/`profiles.pet_photo_url` (store paths, resolve on read).
- Timeouts (R-16): give the stylize call its own budget (e.g. 90 s) via `netFetch(..., { timeoutMs })`, or make the function asynchronous (return a job id, poll `pet.processing_status` written **by the server**).
- Stuck state (R-17): server writes `processing_status` transitions; client treats `processing` older than N minutes as stale and offers Retry; Retry available from `processing`.
- Cache correctness (R-18): key the processed cache by `(uid, sourceHash)` and write `last_source_hash` only after successful upload.
- Secrets/logging (R-19): Gemini key via `x-goog-api-key` header; never log URLs containing keys; keep user ids truncated in logs.
- CPU budget (R-20): resize the input client-side (expo-image-manipulator, max ~1024 px) before upload; on the server avoid re-decoding on cache hits and reduce per-pixel passes; measure with real logs once a project exists.
- Schema (R-15): add `pet.original_photo_url` in the reconciliation; keep the legacy fallbacks until verified on the new database.
- Remove the SSRF surface (R-21): accept only `imageUrl` values under the project's own storage host, or drop `imageUrl` in favour of `imageBase64`/storage paths.
- Rendering: keep `resizeMode="contain"` for processed images; verify placeholder states; single shared pet-render component replaces the three copies (Phase 5).

Acceptance checklist: permission denied -> friendly alert; pick -> masked preview immediately; stylize success -> `stylized.png` on Home/Garden/Pet within one refresh; provider failure -> `cutout.png` shown, Retry offered; app killed mid-stylize -> not stuck after relaunch; second account cannot fetch the first account's originals or processed files (policy test); pet naming enforces 1-24 chars and persists.

---

## Phase 4 — Does the daily loop and garden persist?

Goal: one consistent day boundary, one streak, atomic points, no forgeable balances.

- Day boundary (R-28/R-33): choose one date family for the product (local day is the humane choice for a wellness app) and make the server RPCs accept the client's date key (validated to be within +/-1 day of `now()`), or convert everything to UTC and label it; re-derive memoized keys on focus.
- Streak (R-25/R-27): single source of truth — server `recompute_pet_state` extended to the chosen day basis and to count check-ins + habits, or the client `applyGentleStreakUpdate` made idempotent for same-day re-saves; retire the other two stores from the UI.
- Queue (R-29): scope `pending_completions` by user id; cap attempts; drop items with terminal errors (P0002, 401/403); surface "n items could not sync".
- `fetchTodayCheckIn` (R-30): keep the date filter in the legacy fallback; only fall back on schema-shaped errors.
- Garden (R-31/R-37/R-38): remove client INSERT/UPDATE/DELETE on `task_completions` and `user_plants` (RPC-only writes); either retire the legacy `garden_items` unlock or move it behind an atomic RPC that spends points; disable unaffordable buttons and parse the RPC's `detail` JSON for "Not enough points".
- Home load (R-34/R-35): coalesce focus loaders, debounce queue sync, show an explicit "offline, showing cached tasks" state instead of silently swapping to defaults.

Unit tests to add (deterministic): `getLocalDateKey`/`utcDateKey`/`addDaysToDateKey`/`getISOWeekKey` (including DST week boundaries and Dec 29-Jan 3), `isConsecutiveDay`/`hasMissedDay` with injected "now", streak update table (yesterday/today/gap/same-day re-save), `determinePetMood`/`isProtectedMood`/`derivePetState`, `getTaskPoints`, `getRequiredPointsForNextUnlock`/`getNextUnlockProgress`, `getPointsDebugSnapshot`, `toUpgradeCost` vs the SQL formula for the 10 seeded plants, `normalizeRpcResult`/`isRetryableFailure`, queue dedupe/backoff/cap.

Acceptance checklist: check-in twice in a day keeps the streak; completing a task at 23:30 local and 00:30 local land on the right days; offline completion syncs once and only once on reconnect; double-tap awards once; insufficient points shows the required amount and disables the button; a forged `task_completions` insert is rejected by RLS.

---

## Phase 5 — Can the backend operate safely?

- RLS/grants audit on the rebuilt database: `select proacl ...` for all six RPCs; revoke `anon` where present; fix `consume_pet_chat_quota` to derive or verify the user (R-39) or keep it service-role-only **and** prove the grant; tighten `pet_stylize_requests` (R-24), `user_memories`/`pet_state`/`user_events` client writes (R-41).
- `complete_task` bounds on `completed_at`; `log_event_and_rollup` recomputes points server-side (R-40).
- pet-chat (R-42/R-43): refund quota on provider failure (or consume after success within the same transaction pattern), fall back on 4xx/missing key, log provider failure codes (never bodies with content), document and minimise what is sent to providers, add a retention cap for `user_memories`.
- weekly-summary (R-44/R-45): either wire it (scheduler + client reader) with a per-request deadline and paging, or retire it; stop returning raw error text.
- Observability: correlation id on every function log line (already present in pet-chat/pet-stylize), structured error codes to the client, redaction helper shared via `supabase/functions/_shared/`.
- Deploy hygiene (R-46): `mobile/supabase/config.toml` with `[functions.<name>] verify_jwt` pinned; scripts read the project ref from config, not literals.
- **Stop for authorization** before `supabase db push`, `functions deploy`, or `secrets set` against any hosted project; present the exact ordered command list first.

Acceptance: advisor reports (security/performance) clean or explained; concurrency test on `upgrade_plant` and `consume_pet_chat_quota` (parallel calls) shows no overshoot; cross-user read attempts on `pets` bucket and every table denied.

---

## Phase 6 — Polish and release readiness (only after green)

- Dependency alignment with Expo SDK 54 using `npx expo install --fix` one group at a time, explaining each version and lockfile change; pin `@react-native-community/cli`; move `sharp`/`axios` out of runtime deps (scripts get their own `package.json` or `devDependencies`); remove `expo-router` dependency and plugin (unused; SDK 56 blocker) after confirming no import; declare `expo-clipboard` or drop the dynamic import.
- Assets (R-26, **done 2026-09-17** for the garden: `scripts/build-garden-scene.js` produces a 532 kB background and four small sprites lifted from the painting; baseline 6.11): still to do — delete the unreferenced pet/meadow/flower PNGs (~30 MB) in a separate reviewable change once the owner approves.
- Accessibility and motion (R-49; the garden scene already respects Reduce Motion and carries a scene `accessibilityLabel`, baseline 6.11): respect `AccessibilityInfo.isReduceMotionEnabled` for the remaining animations; labels and roles on task/plant buttons; contrast on the garden header text; 44 pt touch targets; image `accessibilityLabel`s; empty states.
- Structure: split `HomeScreen.js` into hooks (`useHomeLoaders`, `useTaskCompletion`, `usePetNaming`) and sections; split `dailyLoop.ts` into `checkins.ts`, `habits.ts`, `streaks.ts`, `gardenLegacy.ts`; one `PetImage` component; shared `_shared/` for the Edge Functions; migrate remaining JS services to TS around shared domain types (`Pet`, `Profile`, `Task`, `DateKey`).
- Remove dead code (baseline section 10) only after this plan's tests prove no runtime callers, one reviewable change per group.
- App identity: real `name`/`slug`/`bundleIdentifier`/`package`/`scheme`, `eas.json` with development/preview/production profiles, `ios.infoPlist` without `NSAllowsArbitraryLoads` — all values supplied by the owner.

---

## Status update — 2026-09-17

Done (details and evidence in `RESTORATION_BASELINE.md`, section 6.9):
- **Phase 2, Option C is live:** `local-backend/` runs a local Supabase stack; all 20 reconciled migrations apply cleanly on a fresh database; a demo account was seeded through the app's own RPCs and storage policies. `npm run backend:start | backend:env | backend:seed | backend:stop | backend:reset`.
- **Four launch/entry blockers fixed:** the Windows Metro "ESM URL scheme" failure (working-directory dependence), unconfigured production bundles (`env.ts` dynamic lookups), the web splash-screen deadlock in `AuthContext`, and the always-failing `complete_task` RPC (shipped as a new forward migration). Web sessions now persist; the Garden screen's mis-encoded separators are fixed.
- The app was exercised end to end on web (production export) and 14 screens were captured.

Still pending, unchanged: initial commit approval; hosted backend decision; app identity and native strategy; auth-gate fix (R-04); stylize timeout/status lifecycle (R-16/R-17); same-day streak reset (R-25); check-in fallback (R-30); RLS hardening (R-37/R-38/R-39); tab label clipping (R-61); "Legacy Progress" overlap (R-62).

**Phone target (corrected 2026-09-17): iPhone + Expo Go from the App Store, which is the SDK 54 build.** The project stays on SDK 54; packages were aligned to SDK 54 and an iOS bundle builds (baseline section 6.10). Do not upgrade the SDK while this is the target: SDK 55+ on a physical iPhone needs `eas go` plus a paid Apple Developer membership. When an upgrade does happen later, it must include: `expo-av` -> `expo-audio` (removed from Expo Go in SDK 55; used by `src/utils/sfx.js` and `JournalScreen`), removing the `newArchEnabled`/`edgeToEdgeEnabled` app.json keys (SDK 55), removing the unused `expo-router` and adding `@expo/vector-icons` or its replacement explicitly (SDK 56), and an explicit `react-native-reanimated` + `react-native-worklets` dependency because NativeWind needs reanimated and it currently arrives only through `expo-router`.

**Garden scene (2026-09-17, night; baseline 6.11):** the pet and the plants are now drawn as part of the painting through one shared `GardenStage` (Home header and Garden tab), anchored in the painting's own coordinates with ground contact, a shared lighting wash and reduce-motion-aware idle motion. The plant PNGs the app shipped were opaque pictures of a checkerboard (R-63), which is why they never looked transparent; the scene now uses plants lifted from the painting itself and driven by the user's owned plants and levels. The `pet-stylize` prompt now demands a full-body pet (v2), untested until a provider key exists (R-67). Screens: `docs/screenshots/2026-09-17-garden-scene/`.

To run on the iPhone: `npm run backend:start`, `npm run backend:env`, `npm run start:phone`, then scan the QR with the Camera app. The PC must accept inbound connections from the phone (see baseline 6.10: Public network profile blocks `node.exe`; tunnel mode is unavailable because `ngrok.exe` is missing).

## Status update — 2026-09-24

The owner handed over direction on 2026-09-24 ("take the lead"; vision: the pet as the mascot throughout, a great first run, the pet living in the garden while the person does self-care, maybe a period tracker and mini games). Six change sets landed that day, each verified in the production web build and documented in `RESTORATION_BASELINE.md` 6.12–6.15:

- **The pet everywhere** (6.12): one shared pet store/hook, `PetPortrait` (moods, reactions), the pet on its tab, in the Home header (cheers on task completion), the check-in, the Profile and a rebuilt Pet tab. R-04 (auth gate), R-25, R-30, R-33, R-61, R-62 fixed.
- **First run** (6.12): welcome -> photo -> name -> painting -> meet -> one small thing; also the "change photo" flow. Painting failure is soft (photo kept, retry from the Pet tab).
- **The product day is the person's day** (6.13): forward migration `local_day_rpcs` so `complete_task`, `log_event_and_rollup`, `recompute_pet_state` bucket by the client's local day (validated); the client falls back to the old signatures. R-28 fixed.
- **Play** (6.14): Fetch and Bubbles in the garden with the person's pet; play can be a daily task that earns garden points through `complete_task`.
- **Cycle tracker** (6.15): opt-in, on-device only, estimates with clear disclaimers; Home card and Profile entry.

Phase 3 (pet created and rendered) is now done on the client side except for the stylize lifecycle (R-16/R-17) and the untested full-body prompt; Phase 4 (loop persistence) has its day-boundary and streak-reset items done; Phase 6 items that landed: reduce-motion handling, accessibility labels on the new screens, the garden assets, the single pet component. Still pending and unchanged: initial commit approval; hosted backend decision; app identity and native strategy; R-16/R-17; R-27 (three streak stores); RLS hardening (R-37..R-39); on-device verification in Expo Go (owner-only machine settings, see 6.10).

Run locally: `npm run backend:start`, `npm run backend:env`, `npm run backend:seed`, `npx expo start` (web) or `npm run start:phone` (iPhone). New migrations on a running stack: `npx supabase migration up --workdir local-backend`.

## Immediate next decisions for the owner

1. Approve (or amend) the **initial commit** contents (Phase 0).
2. **Does any backup, dump, or export of the deleted Supabase project exist** (auth users, table data, storage objects, `schema_migrations`)? If not, Phase 2 is a recreation with total data loss, and the reconciliation can author the schema deliberately instead of preserving every historical fallback; retire compatibility code only after the new schema is applied and verified.
3. Choose the **backend home** (Phase 2, Option A/B/C). Until then, all backend-dependent acceptance items stay "pending".
4. **Auth policy** for the new project: email confirmation on or off; DB trigger for profile creation vs the current client-side upsert.
5. Confirm the **native strategy** (regenerate vs CNG) and supply the **app identity** values (bundle identifier, Android package, scheme).
6. Decide the fate of **Journal / Breathing / PlantStore / weekly-summary** and the **two garden economies**; decide which of the three streak/mood stores is canonical and whether the product day is local or UTC.
7. **Pet chat data flow:** confirm it is acceptable to send mood, streak, risk, 7-day activity, extracted disclosures and chat turns to OpenRouter and Groq, and which provider keys will exist for the new deployment.
8. If the Windows ESM export error recurs, send the **exact command and log**.
