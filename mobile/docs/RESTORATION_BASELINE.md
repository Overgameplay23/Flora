# Floura Restoration Baseline

Captured: 2026-09-16 (America/New_York), before any code change.
Scope: `C:\Users\donov\floura\mobile` (the Floura Expo client, `supabase/` schema and Edge Functions, `assets/`, `docs/`, `scripts/`).
Out of scope, inventoried for provenance only: `mobile/liftiq/` (unrelated March 2026 workout prototype), `C:\Users\donov\floura\srcd`, `C:\Users\donov\floura\supabase`.

Method: read-only shell probes run by the lead engineer, plus twelve independent read-only code mappers (one per subsystem) whose structured output was cross-checked. Every claim below is either **verified** (observed by running a command or reading the file) or marked **inference**. `.env` was never opened; only key presence was tested programmatically.

Mapper coverage (computed): 94 of the 101 files under `app/`, `src/`, `supabase/` (excluding `.temp`) and `scripts/` appear in at least one mapper's file list. The seven not covered are `src/components/ui/{Card,SectionTitle,StatPill}.js` (small presentational components, 1-2 importers each), `src/components/ui/PrimaryButton.js` (no importers), `src/screens/DetailsScreen.js` and `src/screens/QuizScreen.js` (no importers; listed as dead in section 10), and `scripts/check-export-web.js` (added by this engagement).

---

## 1. Headline findings

1. **The production backend no longer exists.** Every local reference (package.json scripts, README, docs/dev-notes.md, both `supabase/.temp/project-ref` files, and the URL and anon key in `.env`) points at Supabase project ref `gghesvpmskjlrlpoosgf`. That host returns `Non-existent domain` on DNS, the Supabase management API returns `404 Resource has been removed`, and the project is absent from the authenticated account's project list (which holds only three unrelated "AuraMind" projects). Consequences: nothing remote can be verified; the SQL under `supabase/` is the only surviving copy of the schema; the app cannot sign in anywhere today.
2. **Zero commits.** The parent repo (`C:\Users\donov\floura`, branch `supabase-only-mvp`) has no commits; the whole `mobile/` tree is untracked. A SHA-256 manifest of 182 source/config/asset files is at `docs/baseline/manifest.sha256`. No other copy of Floura was found on this machine (bounded search of the user profile).
3. **The client builds and, as of 2026-09-17, runs end to end against a local backend** (section 6.9). `npx expo export --platform web` succeeds under `CI=1` (Node 22.17.0, Expo CLI 54.0.20, Windows 11). The reported Windows "ESM URL scheme" failure was traced to starting Expo from outside `mobile/` and is fixed (R-55). The App Store's Expo Go is the SDK 54 build, which matches this project (R-59, corrected).
4. **Type health, correctly scoped:** client (`app/`, `src/`, `App.js`, `index.js`) = **1 error** (`src/components/finchHome/FinchGardenHeader.tsx:203`). Deno Edge Functions under Deno's own checker (2.9.6, strict by default): `pet-chat` **0**, `weekly-summary` **0**, `pet-stylize` **6** (`index.ts:621` a non-string passed to `stripBase64Prefix`, plus five `'apiResult' is possibly 'null'` at 787-815 because `callBackgroundRemovalApi` returns `null` when unconfigured). The 109-diagnostic figure from a project-wide `tsc` decomposes as 88 `liftiq/` + 20 Deno-under-RN-tsconfig + 1 real. All of these are fixed in the first change set (section 6.8).
5. **Dependencies are internally consistent** (manifest = lockfile = installed) but 16 packages drift from Expo SDK 54's expected versions, 5 of them by a major version (section 4.3). `expo-router` is installed and configured as a plugin but never imported; Expo SDK 56's CLI refuses to bundle a project that has both expo-router and react-navigation, so this leftover is a forward-compatibility hazard.
6. **Native folders are stale and partial.** `android/` is a consistent but stale Expo SDK 54 prebuild from 2025-11-26 (debug keystore, `com.anonymous.mobile`); `ios/` is not a prebuild at all, just a hand-written `Info.plist` fragment with `NSAllowsArbitraryLoads=true` that `expo prebuild --clean` would discard. `app.json` is generic (`name`/`slug` "mobile", `com.anonymous.mobile`, no iOS bundle id, no scheme); `eas.json` is absent. Eight runtime dependencies have zero import sites in client code (`lottie-react-native`, `react-native-view-shot`, `axios`, `react-native-svg`, `expo-status-bar`, `expo-linking`, `expo-router`, `react-native-gesture-handler`; the last may still be a transitive requirement).
7. **The schema cannot be rebuilt from `supabase/migrations` alone.** The six `supabase/schema_*.sql` files are the real bootstrap (they create `profiles`, `pet`, `checkins`, `tasks`, `habits`, ...); every migration only ALTERs those tables. Migration filenames (`2025_12_31_*.sql`, `2026_02_*.sql`) do not follow the CLI's `<14-digit timestamp>_name.sql` convention and would collapse to duplicate versions `2025` and `2026`. The storage bucket `pets` and the `journal_entries` table are used by the client but defined nowhere.

---

## 2. Environment and toolchain (verified)

| Item | Value | How verified |
|---|---|---|
| OS | Windows 11 Home 10.0.26200, x86_64 | `uname`, session env |
| Shell used | Git Bash (MINGW64) and PowerShell 5.1 | session |
| Node | v22.17.0 | `node --version` |
| npm | 11.9.0 | `npm --version` |
| git | 2.49.0.windows.1 | `git --version` |
| TypeScript (local) | 5.8.3 | `npx tsc --version` |
| Expo CLI (local, from `expo` pkg) | 54.0.20 | `npx expo --version` |
| `expo` package installed | 54.0.30 (manifest `~54.0.0`; SDK expects `~54.0.37`) | `node_modules/expo/package.json` |
| react-native | 0.81.5 | installed |
| react / react-dom | 19.1.0 | installed |
| Supabase CLI | 2.67.1 (scoop; latest is 2.117.0) | `supabase --version` |
| Deno | not installed; `npx --yes deno@2` yields Deno 2.9.6 (used for checks, cached in the session scratchpad only) | `npx deno --version` |
| Docker | 29.2.0 installed, **daemon not running** (Docker Desktop stopped) | `docker info` |
| Java / adb / ANDROID_HOME | absent / absent / unset | shell |
| Global npm packages that can shadow local tools | `expo-cli@6.3.12` (legacy, on PATH as `expo`), `eas-cli@20.5.1`, `supabase`, `firebase-tools`, `pnpm`, `vercel` | `npm ls -g --depth=0`, `which -a expo` |

The global legacy `expo` binary is what runs when someone types `expo ...` in this shell. It is unsupported on Node 17+ and fails on this project. Always use `npx expo` (local CLI).

---

## 3. Repository and preservation state

- Repo root: `C:\Users\donov\floura`; branch `supabase-only-mvp`; `git log` -> "does not have any commits yet"; no remotes; no root `.gitignore`.
- `git status`: `?? mobile/`, `?? supabase/`. `srcd/` is not listed because it contains only an empty `screens/` directory.
- `mobile/.gitignore` ignores `node_modules/`, `.expo/`, `dist/`, `web-build/`, `.env`, `.env*.local`, `*.tsbuildinfo`, native secrets patterns. It does **not** ignore `supabase/.temp/` (Supabase CLI cache) or `android/`.
- What an initial commit would capture (`git ls-files --others --exclude-standard`): **282 files** = `mobile/liftiq` 84, `mobile/src` 63, `mobile/android` 44, `mobile/supabase` 31, `mobile/assets` 14, `mobile/app` 11, `mobile/docs` 10, `mobile/scripts` 3, `mobile/dataconnect` 2, `../supabase/config.toml`, `../supabase/.gitignore`, and the root config files.
  - Secret-named candidates: only `mobile/.env.example` (template, no values) and `mobile/android/app/debug.keystore` (the standard React Native debug keystore, not a production secret). `mobile/.env` **is** ignored (`.gitignore:37`).
  - Files over 1 MB that would be committed: `assets/garden.png` 6.37 MB, `assets/garden/flower_sprout.png` 5.32 MB, `flower_seeded.png` 5.00 MB, `flower_bloomed.png` 4.97 MB, `meadow.png` 3.25 MB (root) and `assets/meadow.png` 3.25 MB (identical size), `assets/pets/dog1.png` 3.16 MB, `assets/pets/cat1.png` 2.90 MB, `assets/pet.png` 2.37 MB, plus two `liftiq/.expo-export-check` artefacts.
- Baseline artefacts created by this engagement (additive only):
  - `docs/baseline/manifest.sha256` — SHA-256 of 182 files (app/, src/, supabase/ minus `.temp`, scripts/, docs/ minus baseline, assets/, android/, ios/, dataconnect/, root configs, `meadow.png`).
  - `docs/baseline/originals/` — byte-for-byte copies of every pre-existing file the first change set modifies.
- File mtimes of `Oct 26 1985` on `index.js`, `gradlew`, `gradlew.bat`, `android/.gitignore` are a zip-extraction artefact (inference), consistent with the tree having been restored from an archive.

---

## 4. Inventory

### 4.1 Directory manifest

| Path | Files | Lines | Role |
|---|---|---|---|
| `App.js`, `index.js` | 2 | 26 | Live entry: `registerRootComponent(App)`; `App.js` wraps `RootNavigator` in `AuthProvider` and fires startup network probes |
| `app/` | 11 | 2,891 | Navigators (`RootNavigator.js`, `AppNavigator.js`) and tab screens (Home 1,033 lines, Garden, Pet, Profile, PlantStore, PetStylize loading/result, an unrouted duplicate `LoginScreen.js`, an empty `app/App.js`) |
| `src/` | 63 | 8,960 | Screens (TS), services, domain, utils, components, `contexts/AuthContext.js`, `lib/supabase.ts` |
| `supabase/functions/` | 5 (+1 empty dir `cartoonize-pet/`) | 3,411 | Deno Edge Functions `pet-stylize` (1,559), `pet-chat` (651 + `llm.ts` 280), `weekly-summary` (574 + `llm.ts` 347) |
| `supabase/migrations/` | 12 | 1,342 | ALTER-style migrations 2025-12-31 .. 2026-02-23 (non-CLI filenames) |
| `supabase/schema_*.sql` | 6 | ~440 | Real bootstrap DDL (mvp, tasks, seed_tasks, garden, pet_stylize, daily_loop_v1) |
| `supabase/.temp/` | 8 | — | Supabase CLI link cache (project-ref etc.); not gitignored |
| `assets/` | 13 png + 1 wav | — | see 4.5 |
| `docs/` | 5 md (+ this baseline) | 142 | daily-loop-v1, dev-notes, finch-home-v1, pet-cartoon-v2, regression_checklist |
| `scripts/` | 3 | — | `pet-mask-to-alpha.js`, `strip-plant-sprite-backgrounds.js` (Node + sharp, one-off), `retention_sanity.sql` |
| `android/` | 44 | — | Prebuilt Android project (Kotlin MainActivity/MainApplication, autolinking); incomplete resources |
| `ios/` | 1 | — | `ios/mobile/Info.plist` only |
| `dataconnect/` | 2 | — | Firebase Data Connect leftovers (`dataconnect.yaml`, `connector/connector.yaml`), no schema, no code references |
| `server/`, `tmp/` | 0 | — | empty directories |
| `.expo/` | — | — | local Expo cache (gitignored) |
| `liftiq/` | 84 tracked-candidate files | — | **out of scope**; separate Expo app with its own package.json/lockfile/tsconfig/node_modules |
| root configs | — | — | `package.json`, `package-lock.json` (v3), `app.json`, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`, `tsconfig.json`, `.env`, `.env.example`, `README.md`, `cleanup-ios.sh` (macOS-only), `meadow.png` (stray 3.25 MB copy) |

Largest source files: `supabase/functions/pet-stylize/index.ts` 1,559; `app/screens/HomeScreen.js` 1,033; `src/services/dailyLoop.ts` 711; `supabase/functions/pet-chat/index.ts` 651; `supabase/functions/weekly-summary/index.ts` 574; `src/services/petStylize.js` 564; `src/screens/PetChatScreen.tsx` 502; `src/utils/net.ts` 485; `src/components/finchHome/FinchGardenHeader.tsx` 432.

### 4.2 Package manifest

`package.json`: name `mobile`, version 1.0.0, `main: index.js`, private. Scripts: `start/android/ios/web` (Expo launchers) and six `supabase:deploy:*` / `supabase:logs:*` scripts hard-wired to `--project-ref gghesvpmskjlrlpoosgf`. **No `test`, `typecheck`, `lint`, or export script.**

Notable dependency facts (verified by grep):
- `expo-router ~6.0.21` + `"expo-router"` plugin in `app.json`: zero imports in `app/`, `src/`, `App.js`, `index.js`; `main` is `index.js`, not `expo-router/entry`. Inert, but see headline 5.
- `sharp ^0.34.5` (Node native module) is a **runtime** dependency but only `scripts/*.js` import it.
- `axios` is listed; no import in `app/` or `src/`.
- `@react-native-community/cli: "latest"` (unpinned) in devDependencies.
- `expo-clipboard` is dynamically imported by `src/screens/DiagnosticsScreen.tsx` but not declared (always falls through to Share).
- No `jest`, `jest-expo`, or any test framework; no `__tests__`, `*.test.*`, `*.spec.*` anywhere under `mobile/` outside `node_modules`/`liftiq`.
- No path aliases (`@/`, `~/`) are used in client code (liftiq uses `@/*` inside its own tsconfig).

### 4.3 Dependency consistency and SDK drift

- `npm ls --depth=0`: completes, 36 top-level packages, no missing/invalid/extraneous.
- Manifest vs lockfile root specs: **no drift** (32 deps, 4 devDeps identical). Installed versions match the lockfile for all spot-checked packages (expo 54.0.30, react-native 0.81.5, expo-router 6.0.21, nativewind 4.2.1, typescript 5.8.3, `@react-native-community/cli` 20.1.1, supabase-js 2.89.0, react-native-web 0.21.2, sharp 0.34.5).
- `CI=1 npx expo install --check` (exit 1) and `npx expo-doctor@latest` (16/18 checks passed) report the following drift from Expo SDK 54 expectations:

| Package | Installed | Expected | Drift |
|---|---|---|---|
| `@react-native-community/slider` | 4.5.6 | 5.0.1 | major |
| `expo-image-picker` | 16.1.4 | ~17.0.11 | major |
| `expo-linear-gradient` | 14.1.5 | ~15.0.8 | major |
| `expo-secure-store` | 14.2.4 | ~15.0.8 | major |
| `expo-status-bar` | 2.2.3 | ~3.0.9 | major |
| `lottie-react-native` | 7.2.2 | ~7.3.1 | minor |
| `@types/react` | 19.2.7 | ~19.1.10 | minor (installed is newer) |
| `typescript` | 5.8.3 | ~5.9.2 | minor |
| `expo` | 54.0.30 | ~54.0.37 | patch |
| `expo-constants` | 18.0.13 | ~18.0.14 | patch |
| `expo-crypto` | 15.0.8 | ~15.0.9 | patch |
| `expo-linking` | 8.0.11 | ~8.0.12 | patch |
| `expo-router` | 6.0.21 | ~6.0.24 | patch |
| `@react-navigation/*` | ^7.4.2 / ^7.1.17 / ^7.3.26 | ^7.4.0 / ^7.1.8 / ^7.3.16 | range only |

expo-doctor's other failed check: "app config fields that may not be synced in a non-CNG project" — `android/` and `ios/` exist, so `orientation, icon, userInterfaceStyle, splash, ios, android, plugins` in `app.json` are not applied unless prebuild runs.

None of this was changed. Version alignment is a Phase 5 decision (see plan).

### 4.4 Configuration presence (values never printed)

| Key / file | Status |
|---|---|
| `.env` (669 bytes, gitignored) | 8 keys present, all non-empty, none placeholder-shaped: `EXPO_PUBLIC_FIREBASE_*` x6 (unused by any code), `EXPO_PUBLIC_SUPABASE_URL` (valid `https://<20-char-ref>.supabase.co` shape; ref **equals the removed project**), `EXPO_PUBLIC_SUPABASE_ANON_KEY` (JWT-shaped, role `anon`, `ref` claim matches the URL, expires 2035-11-27). `EXPO_PUBLIC_API_URL` (needed by JournalScreen) is **absent**. |
| `.env.example` | template; documents client keys and Edge Function secret names (`SUPABASE_*`, `GEMINI_*`, `BACKGROUND_REMOVAL_*`) but not `OPENROUTER_*`, `GROQ_*`, `PROVIDER_*`, `MAX_REQ_PER_DAY`, `REQUEST_TIMEOUT_MS`, `PET_CHAT_ALLOW_FALLBACK_REPLY`, `WEEKLY_SUMMARY_ADMIN_SECRET` |
| `app.json` | `name`/`slug` "mobile"; `android.package` `com.anonymous.mobile`; no `ios.bundleIdentifier`; no `scheme`; `extra` block holds `<your-project>` placeholders that **no code reads** (client reads `process.env.EXPO_PUBLIC_*` via `src/utils/env.ts`); plugins `expo-router`, `expo-secure-store`; `newArchEnabled: true` |
| `eas.json` | absent |
| `mobile/supabase/config.toml` | absent (so `supabase start` / `db reset` from `mobile/` cannot run as the README says) |
| `../supabase/config.toml` (parent) | present; `project_id = "floura"`, Postgres major 17, default ports; no `[functions.*]` blocks (so `verify_jwt` per function is unknown) |
| `mobile/supabase/.temp/project-ref`, `../supabase/.temp/project-ref` | both equal the removed ref (20 bytes) |

### 4.5 Assets

`assets/`: `garden.png` (1696x2528, 6.37 MB), `garden/flower_sprout.png` (2500x1536, 5.32 MB), `garden/flower_bloomed.png` (2472x1536, 4.97 MB), `garden/flower_seeded.png` (2048x1724, 5.00 MB, bundled but never displayed), `pets/cat1.png` 2.90 MB, `pets/dog1.png` 3.16 MB, `pets/panda1.png` 0.63 MB, `pet.png` 2.37 MB, `meadow.png` 3.25 MB, `icon.png`, `splash-icon.png`, `adaptive-icon.png`, `favicon.png`, `sfx/ding.wav` 17.7 kB. Code references only `garden.png`, the three flower sprites, and `ding.wav`; the pet/meadow images (about 12 MB) are unreferenced. The web export bundles ~22 MB of garden PNGs, drawn at 24-68 px in Home and Garden simultaneously (risk R-26).

---

## 5. Architecture map

### 5.1 Runtime shape

```
index.js -> registerRootComponent(App)
App.js   -> import ./global.css (NativeWind) ; void runStartupNetworkDiagnostics()  [GET google.com/generate_204, GET {SUPABASE_URL}/auth/v1/health]
         -> <AuthProvider>            src/contexts/AuthContext.js
              <RootNavigator/>        app/navigation/RootNavigator.js
```

Auth gate (`RootNavigator.js:55-74`): `hasUser = !!session.user`; `needsPetSetup = hasUser && !profile?.pet_photo_url`.
- no user -> AuthStack: `Login` (src/screens/LoginScreen.js), `Signup`
- user && needsPetSetup -> `PetSetup` -> `PetStylizeLoading` -> `PetStylizeResult`
- else -> `MainApp` = AppNavigator: tabs `Home`, `Garden`, `Pet`, `Profile` + stack routes `CheckIn`, `Habits`, `GardenProgress`, `Tasks`, `Journal`*, `Breathing`*, `WeeklyReflection`, `PetSetup`/`PetStylizeLoading`/`PetStylizeResult` (re-registered), `PetChat`, `PlantStore`*, `NetworkDebug`, `Diagnostics`. (* registered but never navigated to.)
- Overlays: `EnvWarningBanner` (dev only), `NetworkBlockBanner`, `AuthStatusBanner`.

Because `profile` is `null` whenever the profile fetch failed, was denied by RLS, is offline, or is still in flight, an existing user is routed into Pet Setup on any error (R-04).

Data layer: one Supabase client (`src/lib/supabase.ts`) with an `expo-secure-store` session adapter (2048-byte value limit, errors swallowed) and `resilientFetch` (`src/utils/net.ts`) installed as the global fetch: NetInfo check before every request, 15 s abort per attempt, retries only `/auth/v1/` on 502/503/504/521, converts non-JSON error bodies to structured errors. Missing config falls back to `https://invalid.supabase.co` so `createClient` never throws; requests are then blocked with `NETWORK_FAIL`.

### 5.2 Feature areas -> files -> backend objects

| Area | Client files | Backend objects |
|---|---|---|
| Auth & profile | `AuthContext.js`, `LoginScreen.js`, `SignupScreen.js`, `ProfileScreen.js` | GoTrue email/password; `profiles` select/upsert (client creates the row; **no `auth.users` trigger exists** despite the comment in SignupScreen); `user_stats` select/upsert; DB trigger `profiles_seed_tasks` seeds 3 `tasks` |
| Pet setup & stylize | `PetSetupScreen.tsx`, `pickImage.ts`, `PetStylizeLoadingScreen.js`, `PetStylizeResultScreen.js`, `PetScreen.js`, `services/petStylize.js`, `services/petService.js`, `utils/petImageCache.js`, `utils/petImages.js`, renderers `Pet.js`, `GardenScene.js`, `FinchGardenHeader.tsx`, `PetAvatar.tsx` | storage bucket `pets` (`original/<uid>.<ext>` via 365-day signed URL; `processed/<uid>/{stylized,cutout,mask}.png` via permanent public URL); `pet` table (incl. `original_photo_url`, which **no SQL defines**); `profiles.pet_photo_url`; Edge Function `pet-stylize` (direct POST to `<ref>.functions.supabase.co` when URL configured; `functions.invoke` otherwise) |
| Daily loop | `CheckInScreen.tsx`, `HabitsTodayScreen.tsx`, `DailyTasksScreen.tsx`, `HomeScreen.js`, `WeeklyReflectionScreen.tsx`, `services/dailyLoop.ts`, `taskCompletion.ts`, `habitsService.ts`, `habitOverrides.ts`, `retention.ts`, `utils/dateKeys.ts`, `domain/*` | `checkins` (dual legacy+v2 columns), `habits`, `habit_completions`, `user_stats`, `profiles.current_streak/best_streak/last_reflection_viewed_week`, `tasks`, `task_completions` (read), RPC `complete_task`, RPC `log_event_and_rollup`, RPC `recompute_pet_state`, `daily_user_metrics` (read); AsyncStorage `pending_completions`, `finch_tasks:<uid>:<date>`, `user_habits_v1`, `habit_overrides_v1:<uid>` |
| Garden | `GardenScreen.js`, `PlantStoreScreen.js`*, `GardenProgressScreen.tsx`, `services/garden.ts`, `domain/gardenProgress.ts`, `domain/taskPoints.ts`, `domain/progressDebug.ts`, `components/GardenScene.js`, `finchHome/*` | New economy: `plant_catalog` (10 seeded rows), `user_plants`, `user_plant_upgrades`, RPC `get_garden_points`, RPC `upgrade_plant` (atomic, advisory-locked). Legacy economy: `garden_items` (+ `required_points`, **undefined in SQL**), `garden_unlocks` (client-gated upsert, unreachable UI) |
| Pet chat | `PetChatScreen.tsx`, `services/petChat.ts`, `PetAvatar.tsx` | Edge Function `pet-chat` (`functions.invoke` + Bearer); server-side `consume_pet_chat_quota` RPC (service role only), reads `pet_state`, `daily_user_metrics`, `user_memories`; providers OpenRouter -> Groq |
| Weekly summary | none on the client | Edge Function `weekly-summary` writes `weekly_summaries`, `user_memories`; **no caller, no reader, no scheduler** in the repo. The in-app "Weekly Reflection" is a client-side aggregation of `checkins`. |
| Journal | `JournalScreen.tsx`* | `journal_entries` (**undefined in SQL**) and `POST ${EXPO_PUBLIC_API_URL}/aiPrompt` (**no implementation anywhere**; env var absent) |
| Diagnostics | `DiagnosticsScreen.tsx` (reachable in production via 5 taps on the Profile version label), `NetworkDebugScreen.tsx` (dev-gated entry), `utils/diagLog.ts` (redacts by key name) | raw GETs to `/rest/v1/`, `/auth/v1/health`, `/functions/v1/pet-stylize` |

### 5.3 Backend object inventory vs local SQL

| Object | Kind | Local SQL status |
|---|---|---|
| `profiles` | table | `schema_mvp.sql`; + `2026_02_06` columns |
| `pet` | table | `schema_mvp.sql`; `2026_02_05`, `2026_02_23_pet_name`; **`original_photo_url` / `original_url` missing** (client selects/writes them, falls back) |
| `checkins` | table | `schema_mvp.sql` legacy cols + `schema_daily_loop_v1.sql` v2 cols (+ three repeated ALTER migrations) |
| `habits`, `habit_completions`, `user_stats`, `garden_items`, `garden_unlocks` | tables | `schema_daily_loop_v1.sql` (habits only created here); **`garden_items.required_points` missing** |
| `tasks` | table | `schema_tasks.sql`; **`points`, `type`, `difficulty`, `category` missing** (client reads defensively; `complete_task` tolerates) |
| `task_completions` | table | `schema_tasks.sql` (bigint id) retrofitted by `2026_02_17` (canonical `completed_date`, `points`) |
| `pet_stylize_requests` | table | `schema_pet_stylize.sql` (server-only rate limiter; but owner RLS allows client writes) |
| `pet_chat_usage` | table | `2026_02_17` / `2026_02_23_hotfix` |
| `user_events`, `daily_user_metrics`, `pet_state`, `weekly_summaries`, `user_memories` | tables | `2026_02_22_retention_engine_v1` |
| `plant_catalog`, `user_plants`, `user_plant_upgrades` | tables | `2026_02_23_garden_upgrade_system` |
| `garden_plants` | table | `schema_garden.sql` — **no client reference (orphan)** |
| `journal_entries` | table | **not defined anywhere** |
| `complete_task`, `log_event_and_rollup`, `recompute_pet_state`, `get_garden_points`, `upgrade_plant` | RPC | defined; all `SECURITY DEFINER`, `search_path = public`, identity from `auth.uid()`, execute granted to `authenticated, service_role` |
| `consume_pet_chat_quota` | RPC | defined; `SECURITY DEFINER`; **trusts caller-supplied `p_user_id`**; execute revoked from `public` and `authenticated`, granted to `service_role`; **never revoked from `anon`** (inference on default grants) |
| storage bucket `pets` | bucket | **no `storage.buckets` insert or `storage.objects` policy anywhere** |
| `pet-stylize`, `pet-chat`, `weekly-summary` | Edge Functions | source present; deployment state unknowable (project gone) |

### 5.4 Migrations and bootstrap order

Effective order to build a fresh database from local SQL (inference from dependencies, not executed):
`schema_mvp.sql` (pgcrypto, `set_updated_at()`, profiles, pet, checkins) -> `schema_tasks.sql` -> `schema_seed_tasks.sql` -> `schema_garden.sql` -> `schema_pet_stylize.sql` -> `schema_daily_loop_v1.sql` -> migrations in date order (`2025_12_31_stabilize_schema`, `2025_12_31_daily_loop_schema_fix`, `2026_01_01`, `2026_01_02`, `2026_02_05`, `2026_02_06`, `2026_02_17_task_completion_atomic`, `2026_02_17_pet_chat_usage`, `2026_02_22`, `2026_02_23_garden_upgrade_system`, `2026_02_23_pet_chat_quota_hotfix`, `2026_02_23_pet_name`).

Hazards: `schema_mvp.sql` is not idempotent (unguarded `CREATE TRIGGER`/`CREATE POLICY`); `2025_12_31_daily_loop_schema_fix.sql:107` ALTERs `garden_unlocks` before creating it at line 120; `2025_12_31_stabilize_schema.sql:17-22` and `2026_02_17:55-61` contain destructive dedupe DELETEs; `2026_02_17` creates `task_completions` with a uuid id on a fresh DB but retrofits the bigint legacy table on an existing one; the Supabase CLI (regex `^([0-9]+)_(.*)\.sql$`, verified in the 2.67.1 binary) would parse `2025_12_31_x.sql` as version `2025`, so the files must be renamed before any CLI-driven apply.

### 5.5 Edge Functions (Deno)

Common: `serve` from `https://deno.land/std@0.224.0/http/server.ts` (deprecated in favour of `Deno.serve`), `createClient` from `https://esm.sh/@supabase/supabase-js@2.50.3` (client has 2.89.0), CORS `*`, no shared module, no `deno.json`/import map. `pet-chat/index.ts` and `weekly-summary/index.ts` start with `// @ts-nocheck`; `pet-stylize` does not.

- **pet-stylize**: verifies the caller with `auth.getUser()`; body `userId` must equal the verified uid; all storage/DB writes via service role; 45 s per-user rate limit + `last_source_hash` cache in `pet_stylize_requests`; pipeline = background removal (Gemini SDK, no timeout -> custom HTTP API 20 s -> colour-key fallback) -> Gemini REST stylize (25 s; **API key in the URL query string**) -> alpha polish; heavy pure-JS PNG decode/encode per request against Supabase's documented 2 s CPU budget; returns HTTP 200 `ok:true` even when stylization failed; uploads to `processed/<uid>/*` and returns permanent public URLs; the client (not the server) writes `pet.processing_status`.
- **pet-chat**: verifies user via GoTrue; consumes quota atomically **before** the provider call (never refunded); sends mood/streak/risk/7-day metrics/5 memories + chat turns to OpenRouter (fallback Groq); shapes output; regex-extracts a "memory" from the user message and inserts `user_memories`; logs contain no content, keys, or full user ids.
- **weekly-summary**: user mode scoped to the JWT; admin/batch mode via service-role bearer or `WEEKLY_SUMMARY_ADMIN_SECRET`; sequential batch with no deadline; provider failure silently replaced by a templated summary; nothing in the app calls it.

### 5.6 External dependencies

Supabase Auth/PostgREST/Storage/Functions (project **gone**); Google Gemini (`GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL` default `gemini-2.5-flash-image`); an unidentified background-removal HTTP service (`BACKGROUND_REMOVAL_URL/_API_KEY/_AUTH_HEADER/_PROVIDER`); OpenRouter (`OPENROUTER_API_KEY`, default model `openrouter/free`); Groq (`GROQ_API_KEY`, default `llama-3.1-8b-instant`); `https://www.google.com/generate_204` (startup probe, all builds); `${EXPO_PUBLIC_API_URL}/aiPrompt` (Journal; no implementation). Firebase: env keys only, zero code.

---

## 6. Verification commands and results (exact)

All commands were run from `C:\Users\donov\floura\mobile` unless noted. Nothing was installed into the project; `npx --yes` downloads went to the npm cache and Deno's module cache was redirected to the session scratchpad (`DENO_DIR`).

### 6.1 Git and inventory
```
git status --porcelain=v1 -b        -> "## No commits yet on supabase-only-mvp", ?? mobile/, ?? supabase/
git log --oneline -5                -> fatal: your current branch 'supabase-only-mvp' does not have any commits yet
git ls-files --others --exclude-standard | wc -l   -> 282
git check-ignore -v mobile/.env     -> mobile/.gitignore:37:.env
sha256sum (182 files)               -> docs/baseline/manifest.sha256
```

### 6.2 Dependencies
```
npm ls --depth=0                    -> exit 0, 36 packages, no problems
node (manifest vs lock root drift)  -> none
CI=1 npx expo install --check       -> exit 1, 16 packages "should be updated" (table 4.3)
CI=1 npx --yes expo-doctor@latest   -> exit 1, 16/18 passed; failures: non-CNG config sync, package versions
```

### 6.3 TypeScript, project-wide (reproduces the reported figure)
```
npx tsc --noEmit -p tsconfig.json   -> exit 2, 109 "error TS" lines
   by path: liftiq/ 88, supabase/functions/pet-stylize/index.ts 20, src/ 1
   src/components/finchHome/FinchGardenHeader.tsx(203,17): TS2322 ... top: string ... not assignable to ... `${number}%` ...
```

### 6.4 TypeScript, client-scoped (dry run from a scratchpad tsconfig with absolute include paths, no project file changed)
```
include: App.js, index.js, app/**/*, src/**/*, nativewind-env.d.ts ; exclude: node_modules, liftiq, supabase, android, ios, dist
files checked: 77 (App.js 1, index.js 1, app 11, src 63, nativewind-env.d.ts 1)
result: exit 2, exactly 1 error (FinchGardenHeader.tsx:203)
```

### 6.5 Deno Edge Functions (Deno 2.9.6 via `npx --yes deno@2`, remote imports fetched on first run)
```
deno check supabase/functions/pet-chat/index.ts      -> exit 0
deno check supabase/functions/weekly-summary/index.ts-> exit 0
deno check supabase/functions/pet-stylize/index.ts   -> exit 1, 6 errors on the ORIGINAL source (re-verified from docs/baseline/originals with and without deno.json, identical result):
   TS2345 index.ts:621:43  argument of type '{}'/'unknown' is not assignable to 'string'   (decodeBase64(stripBase64Prefix(outputBase64)))
   TS18047 x5 index.ts:788, 804, 805, 814, 815  'apiResult' is possibly 'null'          (callBackgroundRemovalApi returns null when BACKGROUND_REMOVAL_URL is unset)
```
The very first probe's filtered output showed only the TS2345 line; the re-verification above is authoritative. Side effect noticed and reverted: with no `deno.json`, Deno wrote a `deno.lock` at `mobile/` (because of `package.json`); that stray file, created at 00:22 by this session, was deleted. The first change set adds `supabase/functions/deno.json` so the lock lands beside the functions.

### 6.6 Expo web export and the reported Windows ESM failure
```
node v22.17.0 / npm 11.9.0 / Expo CLI 54.0.20 / MINGW64_NT-10.0-26200 x86_64
CI=1 npx expo export --platform web --output-dir <scratchpad>/web-export
   -> exit 0; "Web Bundled 15002ms index.js (842 modules)"; 35 assets; index.html + 1.92 MB JS + 12.1 kB CSS
   warnings: "Browserslist: caniuse-lite is 9 months old" only
CI=1 npx expo export --platform web --non-interactive ...
   -> "--non-interactive is not supported, use $CI=1 instead" (bundling still completed; exit 7 from the flag)
expo export --platform web --non-interactive   (GLOBAL legacy expo-cli 6.3.12)
   -> exit 1: "The legacy expo-cli does not support Node +17" ... "react-native is not installed" (different failure, not the ESM error)
CI=1 npx --yes expo@54.0.37 export --platform web   -> exit 1: ERR_PACKAGE_PATH_NOT_EXPORTED './rn-get-polyfills' (CLI run from npx cache against project node_modules; not a supported setup, not the ESM error)
CI=1 npx --yes expo@latest export --platform web    -> exit 1: "As of SDK 56, expo-router is no longer compatible with react-navigation" (SDK 56 CLI; confirms the expo-router leftover hazard; not the ESM error)
node -e "import('C:\\...\\metro.config.js')"        -> ERR_UNSUPPORTED_ESM_URL_SCHEME  (control: this is the error class produced when a plain Windows path is passed to dynamic import instead of a file:// URL)
```
Conclusion on 2026-09-16: not reproduced from `mobile/`. **Update 2026-09-17: reproduced and fixed.** The error appears whenever Expo is started from a directory other than `mobile/` (for example `expo start mobile` from the repo root): NativeWind/Tailwind resolve their files against the working directory, the config `require` throws, and Metro's ESM fallback turns that into `ERR_UNSUPPORTED_ESM_URL_SCHEME` on Windows. See section 6.9, R-55.

### 6.8 First change set — applied 2026-09-16, uncommitted, verified

Pre-existing files modified (byte-for-byte originals in `docs/baseline/originals/`; `sha256sum -c docs/baseline/manifest.sha256` lists exactly these eight as changed):

| File | Change | Why |
|---|---|---|
| `tsconfig.json` | explicit `include`/`exclude` (client only) | R-32 context; excludes `liftiq/`, `supabase/`, native dirs from the client program |
| `package.json` | scripts `typecheck`, `typecheck:functions`, `test`, `export:web`, `check`; devDependencies `jest ~29.7.0`, `jest-expo ~54.0.18`, `@types/jest ~29.5.14` | verification surface; versions are the Expo SDK 54 line |
| `package-lock.json` | 139 packages added, 5 changed (dev tree only) | consequence of the devDependencies above |
| `.gitignore` | `+supabase/.temp/`, `+.expo-export-check/` | CLI cache and check artefacts must not be committed |
| `src/components/finchHome/FinchGardenHeader.tsx` | `SPARKLES` typed as `readonly Sparkle[]` with `` `${number}%` `` positions | R-32, no cast |
| `supabase/functions/pet-stylize/index.ts` | string-narrow the background-removal response candidate (~611); `if (!apiResult) throw` after `callBackgroundRemovalApi` (~788) | the 6 Deno errors; a null result now fails into the existing catch with a clear message instead of a `TypeError` |
| `src/utils/dateKeys.ts` | `getISOWeekKey` computes in UTC on the calendar date | **defect found by the new tests:** local-time ms arithmetic across a DST change returned the previous ISO week (e.g. 2026-03-09 -> W10, 2026-09-16 -> W37); verified against GNU `date +%G-W%V` |
| `src/domain/taskPoints.ts` | `points == null` -> heuristic instead of `Number(null) = 0 -> 1 point` | **defect found by the new tests:** a NULL `tasks.points` produced 1 point on the client while the server awards 2 |

New files: `docs/RESTORATION_BASELINE.md`, `docs/RESTORATION_PLAN.md`, `docs/baseline/**`, `jest.config.js`, `scripts/check-export-web.js`, `supabase/functions/deno.json`, `supabase/functions/deno.lock`, `src/__tests__/{dateKeys,taskPoints,gardenProgress,progressDebug,moodState,env,guards,dailyLoopPure}.test.ts` (42 tests).

Results (from `npm run check`, exit 0):
```
npm run typecheck            -> tsc -p tsconfig.json --noEmit : exit 0, 0 errors, 77 files (App.js, index.js, app/ 11, src/ 63, nativewind-env.d.ts)
npm run typecheck:functions  -> deno check x3 (with supabase/functions/deno.json) : exit 0 ; deno.lock written beside the functions, none at mobile/
npm test                     -> 8 suites, 42 tests passed (jest-expo preset; Supabase client and native modules mocked in dailyLoopPure)
npm run export:web           -> Web Bundled index.js (842 modules) ; Exported to .expo-export-check/ (gitignored)
```
Untouched: `mobile/liftiq/` (0 files newer than the manifest), `.env` (mtime 2025-11-26, 669 bytes), `../srcd`, `../supabase`, every other manifest entry (174 of 182 still `OK`). Nothing committed, deployed, linked, or migrated.

### 6.9 Second change set — 2026-09-17: runnable under Expo against a local backend

Goal: make the app launch and work end to end again, and capture how it looks. Originals of every modified file are in `docs/baseline/originals/`.

**Root causes found and fixed**

| # | Finding | Evidence | Fix |
|---|---|---|---|
| R-55 | **The Windows "ESM URL scheme" Metro error is real and reproducible.** NativeWind, Tailwind and react-native-css-interop resolve `tailwind.config`, `global.css` and `package.json` against `process.cwd()`. Starting Expo from any directory other than `mobile/` (for example `expo start mobile` from the repo root) makes `require(metro.config.js)` throw `Cannot find module '...\tailwind.config'`; Metro then falls back to ESM `import()` with a bare Windows path and reports the misleading `ERR_UNSUPPORTED_ESM_URL_SCHEME`. | `node -e "require('./mobile/metro.config.js')"` from the parent folder threw; from `mobile/` it loaded. `expo start mobile` from the parent reproduced the exact error. | `metro.config.js` pins `process.chdir(__dirname)` before loading anything and passes file-anchored `input`/`configPath`/`typescriptEnvPath`; `tailwind.config.js` content globs are anchored to the file. Web export now succeeds from the parent folder with a byte-identical CSS bundle. |
| R-56 | **Production builds shipped unconfigured.** `src/utils/env.ts` read `process.env[name]` dynamically; Expo only inlines static `process.env.EXPO_PUBLIC_X` references, so exported/store bundles had no Supabase URL or key and fell back to `https://invalid.supabase.co`. Dev (`expo start`) masked it. | A production web export contained `invalid.supabase.co` and no configured URL even with `--clear`. | `readPublicEnv()` switch with static references for the four public variables, dynamic fallback kept for dev/tests. After the fix the configured URL is present in the bundle. |
| R-57 | **Signed-in web sessions hung forever on the splash screen.** `AuthContext` awaited `hydrateUserState()` (Supabase queries) inside `onAuthStateChange`; supabase-js holds its auth lock while callbacks run, so the query waits on the lock forever wherever `navigator.locks` exists (web). Native has no such lock and never showed it. | Injected/persisted session -> permanent "Loading..."; fixed build loads Home. | Hydration is deferred with `setTimeout(..., 0)` and never awaited inside the callback (the pattern supabase-js documents). |
| R-58 | **`public.complete_task` could never succeed:** `ERROR 42702 column reference "task_id" is ambiguous`. The parameter `task_id` collides with the column inside `ON CONFLICT (user_id, task_id, completed_date)`, where PL/pgSQL also substitutes variables. | First call through the seed script failed; passes after the fix (19 completions inserted, idempotent on re-run). | New forward migration `local-backend/sql/fix_complete_task_variable_conflict.sql`: identical body plus `#variable_conflict use_column` (all parameter references are already qualified). The original migration file is untouched. |
| R-51 | Web could not persist sessions (expo-secure-store's web module is empty; errors were swallowed). | — | `src/lib/supabase.ts` uses a `localStorage` adapter when `Platform.OS === 'web'`; native still uses SecureStore. |
| R-52 | `app/screens/GardenScreen.js` was saved as ISO-8859-1; two `0xB7` middle dots rendered as U+FFFD ("Earned 38 � Spent 27"). | `file` reported ISO-8859; screenshot showed the replacement glyph. | File converted to UTF-8; only those two bytes changed meaning. |

**Local backend (new folder `local-backend/`, see its README)**
- `build-migrations.js` copies the six `schema_*.sql` files and the twelve misnamed migrations, in dependency order, to correctly named CLI migrations, each stamped with source path and SHA-256. Originals untouched.
- `supabase start --workdir local-backend` applied **all 20 migrations on a fresh Postgres 17 without error**: the proposed bootstrap order works. Ports 56321/56322/56323 (54xxx and 55xxx are taken by other local stacks on this machine).
- `sql/restoration_local_compat.sql` adds `pet.original_photo_url` and the `pets` bucket with own-path policies (public, mirroring today's client; see R-13/R-14).
- `seed-demo.js` creates `demo@floura.local` and a week of activity **as the signed-in user through the app's own tables, RPCs and storage policies**: profile upsert -> DB trigger seeded 3 tasks; storage uploads under own paths; `complete_task` x19; `log_event_and_rollup`; check-ins; habits; `recompute_pet_state`; `upgrade_plant` x3 (earned 38, spent 27, remaining 11; the atomic spend math matches the catalog costs 8+9+10). The demo pet is repo sample art (originally `assets/pets/dog1.png` keyed out; since the garden-scene change set, the full-body sitting puppy from `assets/pet.png` cut out by `local-backend/demo-pet.js`); the stylize Edge Function was **not** exercised (needs provider keys).
- `write-env-local.js` writes `.env.local` (gitignored, overrides `.env`); `.env` was never read or changed.

**Evidence**
- `npm run check` after all changes: typecheck 0 errors, Deno 0 errors, 42/42 tests, web export OK.
- Screens captured from a **production** web export (no dev overlays) at 390x844 with headless Chrome, signed in as the demo user: `docs/screenshots/2026-09-17-web-local-backend/` (login, signup, home, tasks, check-in, habits, daily tasks, garden, plants, garden progress, pet, pet chat, profile, weekly reflection, plus a contact sheet).

**Observed while running (open)**
- R-59 (**corrected later on 2026-09-17; the first wording that day was wrong**) **Expo Go compatibility.** npm `latest` is Expo SDK 57, but the Expo Go build on the Apple App Store is still the **SDK 54** build: Apple has not approved any later one (Expo changelog, "Expo Go and the App Store in May 2026": "Expo Go for SDK 54 will continue to be available on both the App Store and Play Store"; SDK 55+ on a physical iPhone requires `eas go` and a paid Apple Developer membership). This project is SDK 54, so it matches the App Store app. **Do not upgrade the SDK while an iPhone with store Expo Go is the target**; an upgrade would remove that path. The dev server's iOS manifest reports `sdkVersion 54.0.0`.
- R-60 (M, **fixed 2026-09-17**) `@react-native-community/slider@4.5.6` called `ReactDOM.findDOMNode`, removed in React 19. Resolved by the SDK 54 package alignment (slider 5.0.1); the page error no longer occurs.
- R-61 (L, fixed 2026-09-24, section 6.12) Bottom tab labels are clipped on web: bar `height: 72` cannot hold icon + indicator + 11 px label with the configured paddings (`src/components/finchHome/FinchTabBarStyles.tsx`). Needs a device check before changing.
- R-62 (L, fixed 2026-09-24, section 6.12) The floating "Legacy Progress" button overlaps the last visible plant card's action button (`GardenScreen`). The second half of the original finding (sprout/flower sprites with a dithered halo) was diagnosed and fixed in section 6.11: those PNGs were not transparent at all.
- One PostgREST 400 per Home load is the expected `garden_items.required_points` fallback (column still undefined by design until the garden-economy decision).
- The pre-existing local Docker stack named `floura` (ports 54321-54327, tied to `../supabase/config.toml`) was inspected read-only: 8 public tables, 0 auth users, no buckets, and a migration history of exactly one row, version `2025` / `12_31_daily_loop_schema_fix`. That confirms in practice that the CLI parsed the misnamed files as version `2025` and stopped after the first. No data to recover there; it was left untouched.
- Docker Desktop initially failed to start ("dockerInference: The file cannot be accessed by the system", also logged on 2026-09-03): stale AF_UNIX socket files that Windows would not delete. The two affected folders were **renamed aside** (`%LOCALAPPDATA%\Docker\run.stale-*`, `%LOCALAPPDATA%\docker-secrets-engine.stale-*`), not deleted; Docker then started with all images, containers and volumes intact. The `.stale-*` folders can be removed after the next reboot.

### 6.10 Third change set — 2026-09-17 (evening): ready for Expo Go on an iPhone

Target device: the owner's iPhone with Expo Go from the App Store (SDK 54; see R-59). Pre-change copies of `package.json`, `package-lock.json`, `app.json`, `babel.config.js` and `src/utils/sfx.js` are in `docs/baseline/pre-sdk54-alignment/`.

- **No SDK upgrade.** An SDK 54 -> 57 upgrade was planned and then cancelled after reading Expo's release notes: the App Store Expo Go only opens SDK 54.
- **Packages aligned to SDK 54** with `npx expo install --fix` (Expo Go ships fixed native module versions, and several JS packages were a major version behind them): `expo ~54.0.37`, `expo-image-picker ~17.0.11` (was 16), `expo-secure-store ~15.0.8` (was 14), `expo-linear-gradient ~15.0.8` (was 14), `expo-status-bar ~3.0.9`, `@react-native-community/slider 5.0.1`, `lottie-react-native ~7.3.1`, `expo-constants`, `expo-crypto`, `expo-linking`, `expo-router` patch bumps, `typescript ~5.9.2`, `@types/react ~19.1.10`. `expo-font ~14.0.12` was added as a direct dependency to remove a duplicate (14.0.10 vs 14.0.12); Expo's installer also added the `expo-font` config plugin to `app.json`.
- Results: `npx expo install --check` -> "Dependencies are up to date"; `expo-doctor` 17/18 (the remaining item is the pre-existing stale `android/`/`ios/` folders warning); `npm run check` green (typecheck, Deno, 42 tests, web export); **`npx expo export --platform ios` succeeds** (1,424 modules, 4.78 MB Hermes bytecode); web smoke pass on the aligned packages shows no page errors.
- New `scripts/start-expo-phone.js` with `npm run start:phone` / `npm run start:tunnel`: pins `REACT_NATIVE_PACKAGER_HOSTNAME` to the real LAN address, because this machine has a WSL virtual adapter (172.30.48.1) that Expo could otherwise advertise. Verified: the iOS manifest advertises `172.16.61.207:8081`.

**Machine findings that block the phone until the owner acts (not changed by this engagement):**
- The Wi-Fi network is classed **Public**, and Windows Firewall has an inbound **Block** rule for `node.exe` on Public (Allow exists only for Private). The phone therefore cannot reach Metro on 8081. `com.docker.backend.exe` is allowed on Private and Public, so the local Supabase port 56321 is not blocked by Windows Firewall. Fix options for the owner: mark the Wi-Fi network as Private if it is a trusted home network, or put the PC on the iPhone's Personal Hotspot and choose Private.
- Tunnel mode is unavailable: the global `@expo/ngrok-bin-win32-x64` package contains only `package.json`; `ngrok.exe` is missing (consistent with antivirus quarantine; Norton 360 is installed). `expo start --tunnel` fails with `The "file" argument must be of type string. Received null`. Not worked around.
- Not verified from here: whether this Wi-Fi allows device-to-device traffic, and the app's behaviour inside Expo Go on a real iPhone.

### 6.11 Fourth change set — 2026-09-17 (night): the pet and the plants become part of the garden

Owner request: "the dog is only the head, and the plants on the bottom left corner aren't transparent. It should be like they are implemented in the garden, no separate pictures; the dog too, it should look like they are in the environment, interacting with it." Pre-change copies of every modified pre-existing file are in `docs/baseline/originals/`. Screens: `docs/screenshots/2026-09-17-garden-scene/` (production web export, demo user; `00-before-after.png` puts the earlier and the new Home and Garden side by side; `03-home-photo-only-pet.png` is the fallback for a user whose photo was never stylized).

**Findings**

| # | Finding | Evidence |
|---|---|---|
| R-63 | **The three plant PNGs were never transparent.** `assets/garden/flower_sprout.png`, `flower_seeded.png` and `flower_bloomed.png` are fully opaque images in which the image generator painted a *picture of* a transparency checkerboard (grey/white squares, ~14 px cells, under a soft haze). The app placed them with `resizeMode="contain"` over the painting, so every plant carried a grey rectangle with it. | Alpha is 255 everywhere in all three files (`sharp` stats); the checker period is measurable in the pixel data; the earlier Home/Garden screenshots show the rectangles. |
| R-64 | **The demo pet was head-only by construction, and real pets can be too.** The first seed cut the head out of `assets/pets/dog1.png`. Separately, the `pet-stylize` prompt asked for "a cute cartoon pet" without demanding the whole body, so a head-and-shoulders photo yields a head-and-shoulders sticker that then sits on the grass like a decal. | Seed source; `supabase/functions/pet-stylize/index.ts` prompt text before this change. |
| R-65 | **Every garden element was an independent picture.** `FinchGardenHeader`, `GardenScene` and `FinchProgressCard` each positioned sprites with their own percentages over a background that was itself `cover`-fitted per screen size, so nothing was anchored to a painted feature: the pet floated at "60% from the left", the plants were centred on a spot that moved with the aspect ratio, and no element shared lighting or ground contact with the painting. | Original component code in `docs/baseline/originals/`. |

**What changed**

- **Scene pipeline, `scripts/build-garden-scene.js` (new, offline, idempotent).** Reads the painted background `assets/garden.png` once and produces `assets/garden/scene/`: (1) `garden_bg.jpg`, the painting with its four painted plants removed from the soil patch by nearest-material inpainting (soil/grass propagation with widening averaging radii, majority-vote boundary smoothing, the patch outline redrawn, grain re-added) so the patch reads as freshly turned soil; (2) four plant sprites lifted **from the painting itself** (`patch_seed`, `patch_sproutSmall`, `patch_sprout`, `patch_bloom`), each keeping a small feathered rim of *soil only* so it blends back into the patch wherever it is placed; (3) `scene.json` with the image size, six planting spots inside the painted patch, the pet's ground point beside the patch, and each sprite's size and anchor, all in normalized painting coordinates. Running the script again regenerates identical outputs; the source PNGs are untouched.
- **One scene component, `src/components/garden/GardenStage.tsx` (new).** Home header and Garden tab now render the same scene. `src/domain/gardenScene.ts` (pure, tested) computes a "cover + focus + zoom" frame so a painting coordinate lands on the same painted feature at any screen size; plants are rooted at spots in the soil (stable per plant in purchase order; growth stage from level / max level: seed, small sprout, sprout, bloom); the pet stands at its ground point with a stacked-ellipse contact shadow, a slow breathing squash from the paws up, and the plants sway 1.4 degrees; one lighting wash covers background and sprites; depth order follows ground y; all motion stops under Reduce Motion. The pet image ladder is unchanged (stylized, cutout, photo, original, placeholder); an unprocessed original is shown as a round framed photo at the same spot rather than pasted onto the grass.
- **Plants shown in the scene are the user's real plants.** `HomeScreen` loads catalog + owned plants and passes `{ id, level, maxLevel, purchasedAt }`; `GardenScreen` derives the same list from its existing data. Bamboo L4/5, cactus L3/5, lavender L1/5 in the demo therefore appear as bloom / sprout / seed. Six spots exist; if a user owns more, the six most grown are shown (R-66).
- `FinchProgressCard` uses the new sprout sprite for its progress marker; `FinchGardenHeader.tsx` and `GardenScene.js` are now thin wrappers (old sprite masks, per-screen percentages and the debug URL pill are gone).
- **`pet-stylize` prompt v2 (`PROMPT_VERSION = "v2_full_body"`):** always draw the whole pet, sitting upright and facing the viewer, paws on the bottom edge, even when the photo shows only the head; head-only/bust outputs added to the negative prompt. **Untested end to end** (no Gemini or background-removal keys exist locally); the version bump makes existing caches regenerate once a provider is configured.
- Demo seed: full-body puppy cut out locally from `assets/pet.png` (`local-backend/demo-pet.js`), 16 days of activity, plants grown through `upgrade_plant` to three different stages so the scene shows all growth art.

**Evidence**
- `npm run check`: typecheck 0 errors, Deno 0 errors, **9 suites / 55 tests** (13 new in `src/__tests__/gardenScene.test.ts`: frame covers any container, keeps aspect and zoom, centres/clamps focus, survives bad input; the same painting point maps to the same feature at any size; stage thresholds; stable spots on level-up; overflow keeps the most grown; sprite aspect fitting), web export OK.
- Bundled garden art went from ~22 MB of PNG to 0.77 MB (R-26 fixed). The old files stay on disk for the owner's deletion decision.
- Verified in a production web export (no dev overlays) for the demo user and for a photo-only user (framed photo at the pet spot over an empty patch). Not verified on a device; the iPhone path is still blocked by the machine settings in 6.10.
- Failed requests during capture are the two pre-existing ones (NetInfo's Google reachability ping under headless CORS; the documented `garden_items.required_points` 400).

**Open after this change set**
- R-66 (L) Six planting spots and four stage sprites shared by all species; no species-specific art yet.
- R-67 (M) Real users' pets depend on the stylize pipeline producing a full-body cutout; prompt v2 needs a provider key and a review of real outputs before this counts as done for them.
- The scene assumes the current painting; if `assets/garden.png` is replaced, rerun `node scripts/build-garden-scene.js` (the spot table in the script is tied to this painting).

### 6.12 Fifth change set — 2026-09-24: the pet everywhere, a real first run, loop fixes

Owner direction (2026-09-24): take the lead; the vision is "a photo of your pet becomes your mascot throughout the app, like Finch but better", an amazing onboarding, the pet living in the garden while the person completes self-care tasks, maybe a period tracker and mini games. This change set is the foundation for that: one shared pet, one character component, a first run that ends with the pet in its garden, and the loop bugs that would have undermined it. Screens: `docs/screenshots/2026-09-24-pet-everywhere/` (demo user) and `docs/screenshots/2026-09-24-onboarding/` (a brand-new account driven through the whole first run in the production web build). Pre-change copies of every modified pre-existing file are in `docs/baseline/originals/`.

**Findings fixed**

| # | Finding | Fix |
|---|---|---|
| R-04 (H) | Existing users were sent back to pet setup whenever the profile fetch failed (offline, RLS denial, race), because "no profile" and "profile without a pet" looked the same. | `src/domain/appGate.ts` (pure, tested): the gate now distinguishes `loading / ready / error`, remembers per device whether the user had a pet (`floura:pet-ready:<uid>` in AsyncStorage, written on every successful profile load) and shows a "Can't reach your garden" screen with Retry / Sign out only when nothing is known. `AuthContext` exposes `profileStatus`, `cachedHasPet`, `retryHydrate`; `setProfile` keeps the remembered flag in sync. |
| R-25 (H) | Streak reset to 1 on any same-day re-sync (editing the check-in, toggling a habit) after the day was complete. | `syncStatsAndUnlocks`: a day already recorded as `last_completed_date` keeps the streak. |
| R-30 (H) | `fetchTodayCheckIn`'s legacy fallback dropped the date filter and returned the newest check-in of any day as "today". | Fallback keeps `checkin_date = dateKey`. |
| R-33 (M) | Date keys memoised at mount went stale across midnight (Home, Check-in). | Re-read on every focus. |
| R-61 (L) | Tab labels clipped on web. | Tab bar 78 px with explicit label line height; verified in the captures. |
| R-62 (L) | Floating "Legacy Progress" button covered the last plant card's button. | It is a text link inside the points card now. |
| R-68 (new, M) | A plain photo (`photo_url` is set to the original when no portrait exists) rendered as a free-standing rectangle on the grass; only `original_photo_url` was framed. | `usePetCandidates`: anything that is not a stylized/cutout image is shown in a round frame. |
| R-69 (new, L) | Stylize transport failures escaped as a bare `Failed to fetch` and were stored as `processing_error`. | `invokeEdgeFunction` wraps them with a user message and `NETWORK_FAIL`; the message says "We couldn't reach the painting service". |

**The pet as one thing**

- `src/services/petStore.ts` + `src/hooks/usePet()`: the pet row is loaded once per user and shared (Home, Garden, Pet, Chat, Check-in, Profile, the tab bar all subscribe); stylize results published through `petImageCache` are merged in one place instead of in five screens; `setPetNameLocally` / `patchPetLocally` give optimistic updates. Home, Garden and Chat lost their private loaders and cache subscriptions.
- `src/components/pet/PetPortrait.tsx`: the pet as a character — the cutout on a soft contact shadow (`GroundShadow`, extracted from the scene), idle motion by mood (calm breathing, happy bounce, excited hop, sad droop, sleepy slow breath), one-shot reactions (hearts, cheer, wiggle), the framed-photo and "Add your pet" fallbacks, all off under Reduce Motion. `GardenStage` now places a `PetPortrait` at the painting's pet spot (same ladder, same fallbacks) and accepts `petMood`, `petReaction`, `onPetPress`, `petScale`, `hidePet`.
- `src/domain/petMood.ts` (tested): one rule for how the pet carries itself from the check-in mirror, the daily mood store and the hour (sleepy late at night), plus the celebration lines.
- Where the pet now appears: the **tab bar** (`PetTabIcon`: the user's own pet on the Pet tab), **Home** (cheers with a toast when a task is completed, hearts when tapped; the subtitle names the pet), **Check-in** (the portrait mirrors the slider with a line of its own instead of the drawn face overlay), **Profile** (portrait, "You and Biscuit", streaks) and the rebuilt **Pet tab**: the pet close up in its garden, mood sentence, tap to say hello, stats (streak, days together, plants growing), portrait state (painting / didn't finish + retry / photo for now + paint), and actions (Talk, Check in, New photo, Rename). Pet and Profile moved from the light NativeWind styling to the app's dark palette; the developer-facing "State: idle" / debug panels are gone.
- Home's lower half: the "Pet Name" card is gone (naming lives on the Pet tab and in onboarding); "Pet Retention · Risk 75" became "This week with Biscuit" — seven bars and one sentence. The risk score is still computed server-side; it is just no longer shown to the person.

**First run (`src/screens/onboarding/OnboardingScreen.tsx`, rules in `src/domain/onboarding.ts`, tested)**

welcome (empty garden) -> photo (camera on device, library everywhere; round preview) -> name (suggestions) -> painting (the photo waits in the garden while `pet-stylize` runs; status lines rotate) -> meet (the pet in its garden, cheer, hearts on tap) -> one small thing (the user's seeded tasks; completing one goes through `complete_task` and celebrates) -> Start. The main tabs are entered only when the person taps Start, so a profile refresh can never interrupt the flow. Painting failure is soft: the original is kept (uploaded first by `stylizePet`), `processing_status = error` is recorded, the reveal says the portrait didn't finish and the Pet tab offers "Try painting again". "Change pet photo" (Profile, Pet tab) reuses the same screen in `replace` mode (no welcome, no naming when a name exists, no first task).

**Evidence**
- `npm run check`: typecheck 0, Deno 0, **12 suites / 70 tests** (new: `appGate`, `petMood`, `onboarding`), web export OK.
- Production web build, demo user: Home (pet cheering wired), tasks, Garden, Pet tab, Profile, Check-in captured.
- Production web build, new account: all ten first-run steps captured; painting failed as expected locally (no Edge Function) and the flow degraded to the framed photo; the first task was recorded (+2 pts) and Home showed "1 active day".
- Not verified: on a device; with a working stylize provider (the "done" branch of painting).

**Observed, open**
- R-70 (M) **Day boundary shows up in the product**: the demo user, active every local day, sees "Fresh start · Concerned" in the evening because `recompute_pet_state` and `daily_user_metrics` count UTC days (02:00 UTC is still "yesterday" locally). This is R-28 made visible by the new week card; it needs the server RPCs to take the client's day (planned next as its own change set with a forward migration).
- R-27 remains: the header streak (profile, check-in based) and the week card's run (server pet_state) can disagree.

### 6.13 Sixth change set — 2026-09-24 (night): the product day is the person's day (R-28 / R-70)

**Problem.** Check-ins and habits already used the local calendar day, but the three server RPCs that bucket activity (`complete_task`, `log_event_and_rollup`, `recompute_pet_state`) used the UTC date, and the client filtered `task_completions` and `daily_user_metrics` with UTC keys. West of Greenwich an evening task landed on "tomorrow", the daily total reset in the afternoon and the new week card showed "Fresh start · Concerned" to someone who had been active every day (visible in the 6.12 captures at 22:50 local).

**Contract (forward migration `local-backend/sql/local_day_rpcs.sql` -> `20260924000000_local_day_rpcs.sql`, 21st in the set).** Each RPC gains an optional local-day parameter — `complete_task(task_id, completed_at, local_date)`, `log_event_and_rollup(..., p_local_day)`, `recompute_pet_state(p_today)` — validated by `clamp_local_day()`: accepted only when within one day of the UTC date of the event, otherwise the UTC day is used exactly as before. Old signatures are dropped so PostgREST has one candidate per name; callers that omit the parameter (the seed, older clients) keep the old behaviour. Function bodies are otherwise verbatim copies of the 2026-02 originals plus the 2026-09-17 `#variable_conflict` fix. Original migration files untouched.

**Client.** `completionDateKey()` (local) replaces `utcDateKey()` in Home, Daily Tasks, Plant Store and the offline queue; `completeTaskAtomic` sends `local_date`, `logEventAndRollup` sends `p_local_day`, `recomputePetState` sends `p_today`, `fetchLast7DaysMetrics` asks for the last seven local days. Every RPC call falls back to the old signature on `PGRST202` / `42883` (`isMissingRpcSignature`), so the client still works against a database that has not received the migration — the schema-compat rule from the brief still holds.

**Evidence (local stack, throwaway account, 23:3x local = 03:3x UTC next day)**
- `complete_task(..., local_date=today)` at 23:30 local -> `completed_date = 2026-09-24` (local day), `earned_points_today` counted by that day.
- A bogus `local_date` three years off -> clamped to the UTC day.
- The legacy two-argument call still succeeds.
- `log_event_and_rollup(..., p_local_day)` rolled into `daily_user_metrics` for the local day; `recompute_pet_state(p_today=local)` returned a streak while the parameterless call counted from UTC "tomorrow".
- `npm run check` green after the change (typecheck, Deno, 12 suites / 70 tests, web export).

**Caveat recorded.** The uniqueness key is `(user_id, task_id, completed_date)`; during a transition where old and new clients coexist, the same task could be recorded once on the UTC day and once on the local day. With no live users and one client build this is theoretical; if the owner ever runs mixed builds, add a per-task "one completion per 20 hours" guard in `complete_task`.

### 6.14 Seventh change set — 2026-09-24 (night): playing with the pet

Owner idea: "mini games, they can play with their pet". Two small games that happen **in the garden**, with the person's own pet as the character, and a way for play to feed the garden through the existing points loop. Screens: `docs/screenshots/2026-09-24-play/`. Expo Go safe: `Animated` + `PanResponder` only, no native modules, native-driver transforms, reduced-motion aware (shorter flights/runs, no hop).

**Play hub** (`src/screens/PlayScreen.tsx`, route `Play`, reached from the green "Play with <pet>" button on the Pet tab): the two games with best scores, games played today, and "Playtime and the garden": one tap creates a normal daily task titled `Play with <pet>` (client insert into `tasks`, the same RLS path as the app's own habit editor); finishing any game then completes it for the day through `complete_task`, so play earns garden points with no new server code or client-trusted points.

**Fetch** (`src/games/fetch/`, route `PlayFetch`): drag the ball and let go; `computeThrow()` turns the flick (displacement / time) into a landing point inside the lawn band, a flight time and an arc; the ball flies a sampled parabola, the pet runs to it (`runDurationMs`, hopping), carries it back, drops it and gets hearts. Eight throws or sixty seconds. Long throws (>= 55 % of the field) score double. Pure rules in `fetchLogic.ts`.

**Bubbles** (`src/games/bubbles/`, route `PlayBubbles`): bubbles rise through the garden at a spawn rate that tightens from 950 ms to 420 ms over the thirty seconds; tap to pop (small ones score 2, a streak bonus every fifth pop, the pet cheers); a bubble that floats off the top breaks the streak. Pure rules in `bubbleLogic.ts`.

**Shared**: `GameField` (the painting framed on its lawn, HUD, close), `GameEndCard` (records the session exactly once: local best + "played today" in AsyncStorage per user, a `pet_played` event through `log_event_and_rollup` for the activity log, the play task completion; offers the daily task when there is none; Play again / Done), `playStats.ts` (+ pure `playStatsLogic.ts`).

**Verified in the production web build (demo user)**: Pet tab button -> hub -> Fetch: three throws scored 4 (one long), balls counted down 8 -> 5, hearts on return; a full round of eight throws -> "New best! 13"; Bubbles: 13 pops with a streak of 11 -> 20 pts, "New best!"; end cards, Play again and Done all work; the hub shows "1 game today" afterwards. Two defects found by the captures and fixed before this note: the end card's button row did not stretch (buttons overlapped) and, on web, focusing a button after "Play again" let the browser scroll the overflow-hidden field sideways (transforms count as scrollable overflow) so the lawn shifted 79 px — `GameField` now snaps the field's scroll back on every scroll event.

**Evidence**: `npm run check` green (typecheck, Deno, 15 suites / 94 tests, web export); new tests `games.test.ts` (13: throw physics, round limits, spawn pacing, bubble scoring, play stats) and `cycle.test.ts` (8, for the next change set).

**Open**: R-71 (L) the game field's horizontal overflow could also be avoided structurally (clip the pet wrapper); R-72 (L) no haptics on native yet (`expo-haptics` is not a dependency; adding it is a small later step); R-73 (M) `pet_played` events are inserted but not rolled up into `daily_user_metrics` (by design: play does not count as a self-care activity unless the person made it a task).

### 6.15 Eighth change set — 2026-09-24 (night): an optional, on-device cycle tracker

Owner idea: "maybe we can add a period tracker too? that's popular". Built as an **opt-in** feature that keeps health data **on the device only**; the pet keeps the tone gentle. Screens: `docs/screenshots/2026-09-24-cycle/`.

**Design decisions (deliberate, and the owner may revisit them)**
- Off by default. It is turned on from Profile -> "Cycle tracking" (or the Home card once on), after a screen that says exactly three things: the data stays on this device and is never uploaded; it can be deleted in one tap; estimates are not medical advice and the fertile estimate is not for contraception.
- Storage is AsyncStorage per user id (`floura:cycle:<uid>`, `floura:cycle-enabled:<uid>`), never Supabase. If a synced version is ever wanted it needs its own consent screen and a server-side design; nothing here should be reused for that silently. Nothing about the cycle is sent to the pet-chat providers either.
- Predictions are simple and bounded: average of the last six cycle gaps (21–45 days, default 28 until two cycles exist), average period length (2–10, default 5), ovulation estimated 14 days before the next period, fertile window five days before to one day after. Phases: period, follicular, fertile (estimate), luteal, "period expected" (overdue), unknown.

**What was built**
- `src/domain/cycle.ts` (pure, 8 tests): entries + day logs normalised and merged, `cycleStatus()`, `logPeriodDay` / `unlogPeriodDay` (extends, splits, shrinks periods), day logs (flow, symptoms, note), `predictedPeriodDays()` for the calendar, `phaseLine()` for the pet's line. `src/domain/calendar.ts` (pure, 3 tests): Monday-first month grid.
- `src/services/cycleStore.ts` (device storage + change notifications), `src/hooks/useCycle.ts`.
- `src/screens/CycleScreen.tsx` (route `Cycle`): status card with the pet and its line, month calendar (period days filled, expected days dashed, fertile estimate dot, today underlined), a day panel (period toggle, flow, symptoms, note, Save), averages with the disclaimer, "Turn off tracking" and "Delete all cycle data" (confirmed).
- Home: a small cycle card when tracking is on ("Luteal · Day 5 · next period around Oct 18"); Profile: the "Cycle tracking" row shows On/Off.

**Verified in the production web build**: intro -> turn on -> four period days logged (20–23 Sep) -> cramps saved on the 23rd -> status "Follicular · cycle day 5 of about 28 · next period around Oct 18 · in 24 days", the calendar with the period filled and the fertile estimate dotted -> Profile row "On · stays on this device" -> Home card "Follicular · Day 5 · next period around Oct 18".

**Open**: R-74 (M) a real cycle tracker usually wants reminders ("period expected in 2 days"); notifications are out of scope until the app has an identity and a build (Expo Go supports local notifications, but the owner has not decided on the native strategy). R-75 (L) export/import of the on-device data for phone changes.

### 6.16 Ninth change set — 2026-09-25: Luna, the illustrated pet (dog / cat), and the strategy report

Owner notes on 2026-09-25: push to GitHub (done: `Overgameplay23/Flora`, `main`), read `CLAUDE.md` and the product strategy report it links (`mobile/docs/product-strategy/`), "cute animations for the pet", "two modes to start with, cat and dog", and rename the app to **Luna** for now. Screens: `docs/screenshots/2026-09-25-illustrated-pet/`. Conflicts between the report and existing features are logged in `docs/dev-notes.md` for the owner (chat function, streak wording, garden vs room, "Sprouts", fertility predictions).

**The illustrated pet (the report's "parametric 2D/2.5D rig", built in `react-native-svg`)**

- `src/domain/petLook.ts` (tested): `PetLook = { species: dog | cat, coat, secondary, ear, eye, nose, ears (floppy | pointy | folded), tail (curl | straight | fluffy), marking (none | patch | mask | socks | tuxedo | tabby), build (round | slim) }`, coat/eye/nose swatches, 11 presets (golden, beagle, black lab, shiba, spaniel; grey cat, orange tabby, black cat, tuxedo, siamese, calico), `normalizeLook` (rejects options the species does not have), `withSpecies` (keeps colours when switching).
- `src/components/pet/vector/petParts.ts` + `PetRig.tsx`: five SVG layers (tail, body + legs, two ears, head + face, eyes) each animated on its own pivot: breathing by mood, random blinks (sometimes double), tail wag (calm sway, happy wag, excited flurry, sad droop), ear twitches (cats often, dogs now and then), head tilt with hearts, ear flap on a cheer, and **acts** the pet performs when the person logs something: `drink` (nose down to the bowl), `walk` (little hops), `breathe` (one long breath), `sleep` (eyes close, head rests), `stretch`. All Animated + native driver, no native modules, off under Reduce Motion. The rig draws in a 200-unit box so it scales from the tab-bar icon (30 px) to the Pet tab (~200 px).
- `PetPortrait` draws the rig whenever a look exists (the raster ladder stays for photo-only pets); `GardenStage`, the Home header, Garden, Pet tab, Check-in, Profile, Play, Cycle, both games and `PetTabIcon` all pass the look through. Home maps a completed task's title to an act (`actForTask`, tested: "Drink water" → drink, "Go outside" → walk, "wind-down" → sleep, "breath" → breathe, else stretch) so the pet acts it out next to the celebration toast.
- Storage: forward migration `local-backend/sql/pet_look.sql` (`pet.species`, `pet.look jsonb`, species check, size cap; 22nd migration) and a device copy (`floura:pet-look:<uid>`) so a database without the columns still shows the same pet (`petStore.savePetLook`, `resolveLook`). The demo seed gives Biscuit a beagle-ish look.
- `src/components/pet/PetLookEditor.tsx`: live preview, presets as tiny rigs, coat/eye/nose swatches, ears, tail, markings, build.

**First run v2 (`domain/onboarding.ts` rewritten, tested)**: welcome ("Bring your best friend to life" / "Create my pet", after the report) → **Dog or cat** (with "No pet? Adopt a companion") → **Make it look like yours** → photo (**optional**, "Skip for now"; the portrait painting only runs when a photo exists) → name → meet → one small thing. "Change look" on the Pet tab opens the same screen in `look` mode (species → look → save); "New photo" keeps the `replace` mode. A look-only pet marks `profiles.pet_photo_url` with the sentinel `look://chosen` (ignored by the image ladder) so the existing app gate still works.

**Luna**: `app.json` `name`, onboarding and Profile copy; slug/bundle id unchanged (owner decision); trademark note in dev-notes.

**Cycle tracker**: the fertile-window estimate was removed (report: no fertility predictions); phases are period / follicular / luteal / expected; copy updated.

**Evidence**: `npm run check` green (typecheck, Deno, 16 suites / 100 tests, web export). Production web build, new account: welcome → Cat → "Orange tabby" + folded ears → skipped photo → named Luna → Luna (the cat) in the garden → first task → Home / Pet tab / Check-in all show the cat; demo user: Biscuit as a dog rig on Home, Pet tab, Check-in and the tab bar; "Change look" editor opened with the beagle preset.

**Open**: R-76 (M) the photo does not yet drive the look (the report's photo → parameters step); a colour-extraction pass (on-device where possible, or the Edge Function) should propose coat/eye colours and ear shape, with the editor as the adjustment step. R-77 (L) more species-specific art (breed silhouettes, patterns) and idle behaviours (yawn, sit → lie down). R-78 (L) haptics on reactions (needs `expo-haptics`).

### 6.17 Tenth change set — 2026-09-25: the gentle loop (report alignment, small)

Three things the strategy report asks for that cost little and change the tone:

- **Graceful Hibernation** (`src/domain/hibernation.ts`, tested): Home remembers the last day the app was opened (`floura:last-seen:<uid>` on the device). After five or more days away the header says "You're back!" / "<pet> missed you. Let's just take today easy." (two to four days: "Welcome back" / "<pet> kept the garden warm. Pick up wherever you like.") and the pet greets with hearts. Nothing is owed, nothing is reset by the app; the copy never mentions streaks or what was missed. Notifications tapering off is a native-strategy item (no notifications exist yet).
- **Daily reflection prompt** (`src/domain/reflection.ts`, tested): fourteen approachable questions, one per calendar day (stable while typing), shown on the check-in as "<pet> asks: What was the quietest part of your day?" above the one-line field. The 1–5 words are now the report's energy scale: Exhausted · Low · Okay · Good · Energized.
- **Softer streak wording**: "7 days of care in a row" / "a fresh start" on Home, "days in a row" on the Pet tab, "days in a row" / "best run" on Profile. The numbers and the server logic are unchanged (R-27 remains).
- **Idle life for the rig**: every 18–40 s the illustrated pet stretches or tilts its head on its own.

Evidence: `npm run check` green (17 suites / 104 tests); production web build: Home (normal), Check-in with the prompt and energy words, Home after a simulated 12-day absence showing "You're back!" (`docs/screenshots/2026-09-25-gentle-loop/`).

### 6.18 Eleventh change set — 2026-09-25: the photo drives the look (R-76), one streak number (R-27)

**Photo → look, on the device.** The report's pipeline is "photo → parameters → adjust". Luna now does the first step without a server: `jpeg-js` (pure JavaScript, added as a dependency) decodes the picked JPEG (the picker returns JPEG on every platform at quality < 1), `src/domain/photoLook.ts` (pure, 4 tests) downsamples it, estimates the background from the border ring, drops centre pixels that match it, clusters the rest (k-means with farthest-point seeding) and maps the clusters to the rig's slots: the largest non-glare cluster is the coat, a clearly lighter one the belly/muzzle, a clearly darker one the ears; nose and eye colours follow the coat's brightness. `src/services/photoLook.ts` (3 tests, including a synthetic JPEG round trip) wraps the decode. Anything that is not a JPEG yields no suggestion and the presets stay.

**Onboarding order** changed to species → **photo (optional)** → look → name (`domain/onboarding.ts`, tests updated): when a photo was chosen the look step opens already coloured like the pet, shows the photo beside the preview and offers "Use photo colours" after the person has played with swatches. Choosing the other species re-applies the photo colours.

**One "days in a row" number (R-27).** `src/domain/streaks.ts`: the server's activity streak (`recompute_pet_state`, consecutive local days with a task or a check-in) is the product's number; the profile's check-in streak is only the fallback before the server answers. Home, the Pet tab and Profile all use it (the two latter now call `recompute_pet_state` on focus). The three underlying stores still exist; only what the person sees is unified.

**Evidence**: `npm run check` green (19 suites / 111 tests). Production web build, new account with `assets/pet.png` as the photo: the look step opened with the puppy's cream/tan colours applied and the photo beside the preview (`docs/screenshots/2026-09-25-photo-look/`).

**Open**: R-79 (L) the analysis cannot tell ear shape or markings from the photo; R-80 (L) PNG photos (some web pickers) skip the suggestion.

### 6.19 Twelfth change set — 2026-09-25: the garden follows the clock

Report: "the room reflects local time". `src/domain/timeOfDay.ts` (tested) splits the day into dawn / morning / day / golden hour / dusk / night; `GardenStage` draws that phase's wash over the whole scene (background and sprites alike, so the pet and plants sit in the same light) and scatters a few stars once it is dark; Home's default title follows it ("Good morning", "Golden hour", "Quiet night"), while the protected-mode and welcome-back titles keep priority. The hour can be fixed through a prop for previews. Verified in the production web build in the morning phase (the night wash and stars are unit-tested values; a fixed-hour preview is a later nicety) (`docs/screenshots/2026-09-25-time-of-day/`).

### 6.20 Thirteenth change set — 2026-09-25: Rainbow Bridge memorial mode

Owner: "do the memorial mode too". The report's edge case: when a real pet has passed away, upbeat alerts and "Max is ready for a run!" cause real distress; the app should become a quiet memorial with routine prompts paused. Screens: `docs/screenshots/2026-09-25-memorial/`.

**The way in.** Profile → "If <name> has passed away" (phrased as a sentence, not a toggle) → `MemorialScreen`: "We're so sorry", three plain lines about what changes (the pet rests, cheering and daily tasks pause; name, look and memories stay; it can be undone and a new companion can move in later), an optional date and an optional line for them, then a confirmation dialog. Nothing happens on a single tap.

**While the memorial is on**
- The illustrated pet **rests**: eyes closed, head lowered, tail still, slow breathing, no idle behaviours, no reactions (`PetRig resting`). The scene has a soft lavender wash and stars regardless of the clock; the Home header's sparkles stop.
- **Home**: "Remembering <name>" / "<name>'s garden is quiet and peaceful. Take today at your own pace."; the progress card, week card, quick actions and task list are replaced by one card with a daily reflection line ("Grief is love that still wants somewhere to go…"), a note that tasks and prompts are paused, and three gentle actions: Memories, One quiet minute (breathing), Check in. No celebration toasts.
- **Pet tab**: the resting pet, "Remembering <name>", a pink "Memories of <name>" card instead of Play; tapping the pet opens the memorial.
- **Check-in** stays available (self-care continues) with the pet resting and the prompt "What's one small memory of <name> you'd like to keep today?"; **Play** shows "<name> is resting".
- **Memorial screen**: the resting pet in its garden, the day's reflection, the line they wrote, "Sit quietly for a minute", write a memory (kept on the device, long-press to remove), and "Together": milestones from what the app knows (days together, small things done, check-ins, plants grown, games played). At the bottom, two quiet links: "Welcome a new companion" (archives the memorial and memories on the device under "Remembering <name>", clears the garden and opens the look chooser) and "This was a mistake" (undo, with confirmation).

**Data**: forward migration `pet_memorial.sql` (`pet.memorial_at date`, `pet.memorial_note`, 23rd migration) plus a device copy (`floura:memorial:<uid>`); memories and the archive are device-only (`src/services/memoryStore.ts`). Rules and copy in `src/domain/memorial.ts` (5 tests): normalisation, no future dates, memories newest-first, ten reflections that never mention streaks, tasks or points, milestones only with data.

**Found on the way (R-81, M, fixed)**: React Native Web's `Alert.alert` is a no-op, so on web every confirmation dialog in the app silently did nothing (the memorial confirmation, cycle-data deletion, and the older photo-replace and sign-out prompts). `src/utils/confirm.ts` (`confirmAsync`, `notify`) uses the browser's own dialogs on web and `Alert` on native; the memorial and cycle screens use it. The older `Alert.alert` call sites still exist and are listed in dev-notes for a sweep.

**Not done on purpose**: notifications do not exist yet, so "pause alerts" is moot until the native strategy lands; multi-pet is out of scope (the archive keeps the memorial when a new companion moves in).

### 6.7 Remote Supabase (read-only)
```
supabase projects list                                   -> 3 projects (AuraMind Production ACTIVE, Auramind gym INACTIVE, AuraMind Release Evidence INACTIVE); gghesvpmskjlrlpoosgf absent
supabase functions list --project-ref gghesvpmskjlrlpoosgf -> 404 {"message":"Resource has been removed"}
supabase secrets list --project-ref gghesvpmskjlrlpoosgf   -> same 404
supabase migration list --linked (parent workdir)         -> "unexpected login role status 404 Resource has been removed"
MCP get_project(gghesvpmskjlrlpoosgf)                      -> "You do not have permission to perform this action"
nslookup gghesvpmskjlrlpoosgf.supabase.co                  -> Non-existent domain   (control: vadbfvsedtipdbjdplqm.supabase.co resolves)
curl https://gghesvpmskjlrlpoosgf.supabase.co/{rest/v1/, functions/v1/pet-chat, auth/v1/health} -> connection failed (no DNS)
MCP list_tables/list_migrations/list_edge_functions(AuraMind Production) -> LIFTIQ/AuraMind schema (workouts, nutrition, arena...), migrations start at 20260309000000_liftiq_mvp; no Floura tables or functions
```

---

## 7. Remote Supabase status

| Category | Items |
|---|---|
| **Verified** | The referenced project does not resolve (DNS), is not visible to the authenticated Supabase account/CLI, and the management API reports it removed. The three projects that are visible belong to the LIFTIQ/AuraMind product line (migration `liftiq_mvp`, workout/nutrition tables, 16 unrelated Edge Functions). Local link caches (`.temp/project-ref`) and `.env` all point at the removed ref. |
| **Not verified (cannot be, project gone)** | Which SQL files were applied and in what order; live column set (`pet.original_photo_url`, `tasks.points`, `garden_items.required_points`); storage bucket `pets` existence/visibility/policies; deployed function code and `verify_jwt` settings; secret names set; whether an `auth.users` trigger or `journal_entries` existed; whether any user data survives anywhere. |
| **Deliberately not changed** | No project created, linked, migrated, or deployed. No secrets set or rotated. No writes to any visible project. Docker Desktop was not started. The stray `deno.lock` this session created was removed. |

---

## 8. Risk register

Ordered by restoration priority: launch -> enter safely -> pet -> daily loop/garden -> backend safety -> polish. "H/M" = mapper severity. Line numbers refer to the pre-change files (hashes in the manifest).

### Launch / entry
- **R-01 (H) Backend does not exist.** See section 7. Blocks every signed-in flow. Owner decision required (recreate from local SQL vs. other account).
- **R-02 (H) Migrations cannot bootstrap a fresh DB** and filenames collide under the CLI. `supabase/migrations/2025_12_31_daily_loop_schema_fix.sql:4`, `2025_12_31_stabilize_schema.sql:1`. Bootstrap needs the `schema_*.sql` files first and a rename to `YYYYMMDDHHMMSS_name.sql`.
- **R-03 (H) Zero commits; only copy.** Initial commit needs owner approval (section 3).
- **R-04 (H, fixed 2026-09-24, section 6.12) Auth gate sends existing users to Pet Setup on any profile-fetch failure** (offline, RLS denial, placeholder config, race between `SIGNED_IN` and hydrate). `app/navigation/RootNavigator.js:57`, `src/contexts/AuthContext.js:71-73,105-107,196`.
- **R-05 (L, downgraded after verification) Android prebuild is stale but internally consistent.** The manifest's `@xml/secure_store_backup_rules` / `@xml/secure_store_data_extraction_rules` (`android/app/src/main/AndroidManifest.xml:16`) are provided by `expo-secure-store`'s own library resources (`node_modules/expo-secure-store/android/src/main/res/xml/`), so nothing is missing; `applicationId`/`namespace` are `com.anonymous.mobile`, matching `app.json`. The folder is an Expo SDK 54 template from 2025-11-26 with no hand edits found, signed with the debug keystore, and predates later dependency changes; it is safe to regenerate with prebuild once a real app identity exists. Whether it compiles today was not tested (no Gradle run).
- **R-06 (H) iOS project incomplete; no bundle identifier or scheme** (`ios/` = Info.plist only; `app.json:15-17`). Prebuild cannot run non-interactively for iOS.
- **R-07 (M) Production builds show no configuration warning**; unconfigured Supabase surfaces as a generic sign-in error (`src/components/EnvWarningBanner.tsx:6`, `src/lib/supabase.ts:40-64`).
- **R-08 (M) Signup relies on a DB trigger that does not exist and gives no feedback if email confirmation is on** (`src/screens/SignupScreen.js:76`); the profile row is created client-side on first hydrate (`AuthContext.js:78-85`).
- **R-09 (M) Session persisted in expo-secure-store with a 2048-byte value cap; write errors swallowed** (`src/lib/supabase.ts:15-38`). Inference: a Supabase session JSON commonly exceeds 2 KB.
- **R-10 (M) Plaintext email logged on every login/signup attempt in all builds** (`src/screens/LoginScreen.js:36`, `SignupScreen.js`); user UUID logged on every auth event; non-OK response bodies logged in production (`src/utils/net.ts:389-411`).
- **R-11 (M) Diagnostics screen reachable in production (5 taps on version label)**; `NetworkDebug` route registered in production (`app/screens/ProfileScreen.js:64-78`, `app/navigation/AppNavigator.js:80-81`).
- **R-12 (M) iOS ATS fully disabled** `NSAllowsArbitraryLoads=true` (`ios/mobile/Info.plist:9`).

### Pet setup / rendering
- **R-13 (H) Storage bucket `pets` is defined nowhere**, and the same bucket must be private (signed URL for `original/`) and public (`getPublicUrl` for `processed/`) at once (`src/services/petStylize.js:90,107,177`; `supabase/functions/pet-stylize/index.ts:306,940-943`). If public, originals are fetchable by anyone who knows a user's uuid; if private, processed URLs fail.
- **R-14 (H) Processed pet images are permanent unsigned public URLs keyed only by uid** (`pet-stylize/index.ts:306,924-927`). `cutout.png` is essentially the user's real photo.
- **R-15 (H) `pet.original_photo_url` is read/written by the client but defined by no SQL**; when missing, all pet reads/writes degrade to "legacy" mode and the garden renders the raw photo (`src/services/petService.js:5-11,140-147,195-248`).
- **R-16 (H) Client aborts the stylize call at 15 s while the server pipeline can legitimately take longer**; the client then writes `processing_status='error'`, retries hit the 45 s rate limit, and successful server runs are reported as failures (`src/services/petStylize.js:280`, `src/utils/net.ts:9`, `pet-stylize/index.ts:582,675,1410,1268-1292`).
- **R-17 (H) `processing_status` can stay `processing` forever** (client-only lifecycle, no staleness check, Retry only on `error`) (`app/screens/PetScreen.js:174,237-266`, `PetStylizeLoadingScreen.js:64`).
- **R-18 (H) Stale cache can return the previous pet for a new photo** after a failed first attempt, because the cache key ignores `sourceHash` and the hash is written before processing (`pet-stylize/index.ts:283-285,1222-1264,1285-1292`).
- **R-19 (H) Gemini API key placed in the URL query string**; fetch failure messages (which embed the URL) are logged (`pet-stylize/index.ts:1392,1455-1459`). Use the `x-goog-api-key` header.
- **R-20 (H) Pure-JS image decode/encode loops likely exceed the documented 2 s CPU budget per Edge request** (`pet-stylize/index.ts:457-555,889-919,1434-1444`; cache hits also re-decode).
- **R-21 (M) Server-side fetch of arbitrary `imageUrl` (SSRF) with partial response echo** (`pet-stylize/index.ts:1140-1167`).
- **R-22 (M) No image downscaling**: up to 7 MB base64 travels through navigation params, memory, and the 15 s upload (`PetSetupScreen.tsx:28-43`, `petStylize.js:10,320-325`).
- **R-23 (M) Signed original URL (365-day TTL) persisted into `pet.photo_url`/`profiles.pet_photo_url`; expires silently** (`petStylize.js:11,90,196-214`).
- **R-24 (M) Any signed-in user can write their own `pet_stylize_requests` row**, defeating the cooldown/cache (`supabase/schema_pet_stylize.sql:18-27`).

### Daily loop / garden
- **R-25 (H, fixed 2026-09-24, section 6.12) Streak resets to 1 on any same-day re-sync after the day is complete** (`src/services/dailyLoop.ts:515-518,540-546`).
- **R-26 (H, fixed 2026-09-17, section 6.11) ~22 MB of 2500 px PNGs decoded full-size for 24-68 px sprites in two simultaneously mounted tabs** (`FinchGardenHeader.tsx:27-29`, `GardenScene.js:5-8`, `FinchProgressCard.tsx:11`). Inference: OOM/jank on low-end Android. Now: the bundled garden art is one 532 kB JPEG background plus four 35-107 kB sprite PNGs (0.77 MB in total); the old PNGs remain on disk but are no longer referenced.
- **R-27 (H, display unified 2026-09-25, section 6.18; stores still separate) Three independent streak/mood systems shown at once** (`user_stats` client-computed; `profiles.current_streak` client-computed on check-in; `pet_state` server-computed UTC) with different day bases and vocabularies (`HomeScreen.js:493,594`, `HabitsTodayScreen.tsx:168`).
- **R-28 (H, fixed 2026-09-24, section 6.13) Local-date vs UTC-date split**: check-ins/habits/profiles use local date keys; tasks/queue/retention/server RPCs use UTC (`src/services/taskCompletion.ts:53`, `dateKeys.ts:5-7`, `2026_02_17:112`, `2026_02_22:170`). West of UTC the task list resets in the afternoon.
- **R-29 (H) Offline completion queue never drops items and is not user-scoped** (`taskCompletion.ts:48,322-334`).
- **R-30 (H, fixed 2026-09-24, section 6.12) `fetchTodayCheckIn` fallback drops the date filter and returns any latest check-in as "today"** (`dailyLoop.ts:189-201`; consumers `CheckInScreen.tsx:102-108`, `HabitsTodayScreen.tsx:68-71`).
- **R-31 (H) Legacy garden unlock has no server enforcement and consumes no points**; the two garden economies double-count the same `task_completions.points` (`dailyLoop.ts:683`, `PlantStoreScreen.js:116-132`).
- **R-32 (H) `FinchGardenHeader.tsx:203` TS2322** — `SPARKLES` positions widen to `string`; `ViewStyle.top/left` require `` `${number}%` ``. Fix by typing the constant, not by casting.
- **R-33 (M, fixed 2026-09-24 for Home and Check-in, section 6.12) Date keys memoized at mount go stale across midnight** (`CheckInScreen.tsx:61`, `HabitsTodayScreen.tsx:36`, `HomeScreen.js:164`).
- **R-34 (M) Home focus call storm**: ~7 network calls per focus plus queue sync on mount, foreground, and every NetInfo event (`HomeScreen.js:407-454`); Garden tab shows a full-screen spinner on every focus and swallows errors (`GardenScreen.js:93-108`).
- **R-35 (M) Silent local-only task fallback when the server returns zero tasks or errors** (`HomeScreen.js:340-341,372-381`).
- **R-36 (M) Journal and Breathing routes unreachable; Journal depends on an undefined table and API** (`src/screens/JournalScreen.tsx:10-30`; `EXPO_PUBLIC_API_URL` absent).

### Backend safety
- **R-37 (H) Garden point balance is client-forgeable**: owner INSERT/UPDATE/DELETE policies on `task_completions` with no CHECK on `points`; `get_garden_points`/`upgrade_plant` sum the table (`2026_02_17_task_completion_atomic.sql:82-90`, `2026_02_23_garden_upgrade_system.sql:127-137`).
- **R-38 (H) `user_plants.level/equipped` writable directly**, bypassing `upgrade_plant` (`2026_02_23_garden_upgrade_system.sql:66-80`).
- **R-39 (H) `consume_pet_chat_quota` trusts a caller-supplied user id and is probably still executable by `anon`** (`2026_02_23_pet_chat_quota_hotfix.sql:28-51,85-87`). Verify with `select proacl from pg_proc where proname='consume_pet_chat_quota'` once a database exists.
- **R-40 (M) `complete_task` accepts an unbounded caller-supplied `completed_at`** (point farming by date) and `log_event_and_rollup` trusts client `p_points`/`p_occurred_at`/`p_event_type` (`2026_02_17:111`, `2026_02_22:152-165`).
- **R-41 (M) Clients can INSERT arbitrary `user_memories` rows that pet-chat injects into its LLM prompt**, and can write `pet_state`/`user_events` directly (`2026_02_22_retention_engine_v1.sql:104-148`).
- **R-42 (M) pet-chat quota is consumed before the provider call and never refunded**; no fallback when the primary key is missing or returns 4xx; provider failure reasons never logged (`pet-chat/index.ts:505,599`, `llm.ts:271`).
- **R-43 (M) Private wellness context and regex-harvested disclosures are sent to third-party LLM providers and retained indefinitely** (`pet-chat/index.ts:230,283-288`).
- **R-44 (H) weekly-summary batch mode has no deadline** (up to 200 users sequentially, 365-day reads, two provider calls each) and **the function is unreachable from the product** (`weekly-summary/index.ts:438,504-520`).
- **R-45 (M) Error contract leaks raw DB/provider error text to end users** in weekly-summary and pet-stylize `details` (`weekly-summary/index.ts:568`, `pet-stylize/index.ts:1542`).
- **R-46 (M) Deploy configuration drift**: `--no-verify-jwt` in docs, not in npm scripts, no `config.toml` to pin it (`docs/dev-notes.md:22`, `package.json:10`).
- **R-47 (M) Data-destructive migrations**: dedupe DELETEs and timezone-shifted backfills with no backup (`2025_12_31_stabilize_schema.sql:17`, `2026_02_17:55-61`).

### Polish
- **R-48 (M) Dependency hygiene**: `sharp` (scripts-only native Node module) and `axios` in runtime deps; `@react-native-community/cli: latest` (floats to a CLI major that may mismatch RN 0.81 on any lockless install); `expo-clipboard` used but undeclared; zero client import sites for `lottie-react-native`, `react-native-view-shot`, `axios`, `react-native-svg`, `expo-status-bar`, `expo-linking`, `expo-router` (grep-verified; `react-native-gesture-handler` also has none but may be a transitive requirement); 16-package SDK drift (section 4.3). `ios/mobile/Info.plist`'s ATS exception must move into `app.json` `ios.infoPlist` before any prebuild or it is lost.
- **R-49 (L) 14 perpetual `Animated.loop` sparkles with no reduced-motion handling** (`FinchGardenHeader.tsx:115`); only loop site in the app; native driver, stopped on unmount.
- **R-50 (L) Startup probe to google.com at module load in all builds** (`App.js:8`, `net.ts:266`).
- **R-51 (L) Web target cannot persist sessions** (expo-secure-store web module is empty) — relevant only if web is ever a target.
- **R-52 (L) Non-UTF-8 byte in `app/screens/GardenScreen.js:206` renders as U+FFFD.**

### Found and fixed by the first change set (kept here for the record)
- **R-53 (M, fixed) `getISOWeekKey` off by one week during daylight-saving time** (`src/utils/dateKeys.ts:36-52`, original). Local-time millisecond arithmetic across a DST shift; in 2026 every Thursday's day-of-year is 1 mod 7, so every DST-period week was computed one low. Affected `profiles.last_reflection_viewed_week` and the Profile "New" badge. Test: `src/__tests__/dateKeys.test.ts`.
- **R-54 (L, fixed) `getTaskPoints` treated `points: null` as 0 -> 1 point** (`src/domain/taskPoints.ts:16`, original) while `complete_task` awards 2 for missing points. Test: `src/__tests__/taskPoints.test.ts`.
- **R-32 (fixed)** and the six Deno diagnostics in `pet-stylize` (section 6.5) — see 6.8.

---

## 9. Compatibility fallbacks that must be preserved (until a live schema is proven)

The client tolerates several schema generations. Removing any of these before the database is rebuilt and verified would break rendering or persistence. Full list with file:line is in the mapper output; the load-bearing ones:

- `src/services/petService.js:5-11,16-27,105-148,175-252` — `PET_SELECT_NEW` -> three legacy select clauses; upsert payload narrowing on missing-column errors; camelCase/snake_case row aliasing; client-only `processing_status = 'legacy'`.
- `src/services/dailyLoop.ts:60-93` (missing-column sniffers), `:114-148` (profiles streak update narrowing), `:171-252` (checkins dual-generation read/write), `:270-291`, `:344-418` (weekly reflection legacy path), `:458-482` (habits order fallback), `:613-706` (garden 3-tier select, `required_points` null injection, unlock without `streak_at_unlock`).
- `src/services/habitOverrides.ts:18-29,80-101` — `tasks.points` missing -> title-only update.
- `src/services/petStylize.js:256-310` (functions host rewrite vs `functions.invoke`), `:433-474` (snake/camel response keys; legacy base64 upload path the current server never uses).
- `src/utils/petImages.js:1-10` — hides legacy `pets/public/*_stylized.*` URLs.
- `src/services/retention.ts:78-85` — non-uuid task ids -> null (because `user_events.task_id` is uuid while `tasks.id` is bigint).
- Server side: `complete_task` reads `tasks.points` via `to_jsonb` with default 2 and probes `information_schema` before touching `tasks.completed_at/status/done` (`2026_02_17:131-194`); pet-chat maps a missing quota RPC to `503 quota_not_configured`.

---

## 10. Dead or duplicate code (candidates; do not delete in this phase)

Verified unreferenced: `app/App.js` (empty), `app/screens/LoginScreen.js` (unrouted duplicate; navigates to a non-existent `MainApp` route), `src/screens/DetailsScreen.js`, `QuizScreen.js`, `UploadScreen.js`, `src/components/Garden.js`, `dailyLoop.ts:566-606 maybeUnlockGardenItem` (unexported, uncalled), `supabase/schema_garden.sql` (`garden_plants`), `supabase/functions/cartoonize-pet/` (empty dir), `dataconnect/`, Firebase env keys, `app.json.extra`, `assets/pet.png`, `assets/pets/*`, `assets/meadow.png`, `meadow.png`, `assets/garden/flower_seeded.png` (bundled, never shown), `pet-stylize` `mapGeminiHttpError` (never invoked), `net.ts` `failureTracker`/`blockedUrls` (written, never read).

Registered but unreachable routes: `Journal`, `Breathing` (the live implementation is `BreathingModal.tsx`), `PlantStore` (the only caller of the legacy unlock).

Duplicates: pet render candidate ladder x3 (`Pet.js`, `GardenScene.js`, `FinchGardenHeader.tsx`); cache-subscriber merge x3 (`PetScreen.js`, `HomeScreen.js`, `GardenScreen.js`); `llm.ts` copy-pasted between `pet-chat` and `weekly-summary`; three overlapping checkins/habits ALTER migrations; `2026_02_17_pet_chat_usage.sql` fully superseded by the `02_23` hotfix; `toSafeInt`/UTC-date helpers repeated across services; upgrade-cost formula duplicated in `GardenScreen.js:18-25` and SQL.

---

Superseded on 2026-09-24 (kept on disk, still registered as routes so nothing breaks; delete in a later reviewable change once the owner agrees): `src/screens/PetSetupScreen.tsx`, `app/screens/PetStylizeLoadingScreen.js`, `app/screens/PetStylizeResultScreen.js` (replaced by `src/screens/onboarding/OnboardingScreen.tsx`), `src/components/Pet.js` and `src/components/pet/PetExpressionOverlay.tsx` (replaced by `PetPortrait`), `src/services/taskCompletion.ts#utcDateKey` (kept as a deprecated export), the `assets/garden/flower_*.png`, `assets/garden.png` (source of the generated scene; keep), `assets/meadow.png` and `assets/pets/*` sample art (only `assets/pet.png` is used, by the local demo seed).

## 11. Unknowns, grouped by what resolves them

**Owner decision**
- Where should Floura's backend live now: a new Supabase project in this account (fresh ref, new anon key, rewritten scripts/docs), a project in another account that still hosts `gghesvpmskjlrlpoosgf` data, or a local Docker stack for development only?
- Product intent between the legacy `garden_items` unlock system and the `plant_catalog` upgrade system; whether `PlantStore`, `Journal`, `Breathing`, `weekly-summary` are to be revived or retired.
- Intended app identity: name, slug, iOS bundle identifier, Android package, URL scheme, EAS project ownership.
- Whether the 10-row `plant_catalog` seed and the three generic flower sprites are final content.
- Approval to create the initial git commit (and whether `android/`, `liftiq/`, the 3 MB `meadow.png` duplicate, and `supabase/.temp` should be in it).

**Remote / infrastructure access (blocked until a database exists)**
- Applied migration history and live column set; bucket `pets` configuration and policies; deployed function code and `verify_jwt`; secret names set; effective ACLs on the six RPCs (`anon` grants); whether any user data survives.
- Which background-removal service `BACKGROUND_REMOVAL_URL` pointed at (the JSON contract does not match remove.bg's API despite the label).
- Whether `gemini-2.5-flash-image` accepts `responseMimeType: image/png` with `systemInstruction`; real end-to-end stylize latency vs the 15 s client timeout; real per-request CPU time.

**Device test**
- Whether the current `android/` folder builds; whether the persisted session exceeds SecureStore's 2048-byte limit on device; runtime memory impact of the 22 MB garden PNGs; Hermes `Intl` behaviour for `toLocaleDateString` with options.

**Code read / unit test (resolvable now)**
- `getISOWeekKey` DST off-by-one (inferred, needs a test); NetInfo immediate-emit double sync at startup; supabase-js `INITIAL_SESSION` duplicate hydration.

---

## 12. Independent critic review (completed after the first change set)

A separate read-only critic re-read all twelve mapper outputs and the current tree, resolving disagreements by opening the files. Outcomes that changed this document or matter to the plan:

- **Corrected:** the Android `@xml/secure_store_*` resources are supplied by the `expo-secure-store` library, so the earlier "build fails at resource linking" claim was wrong (R-05 downgraded above). `PointsDebugPanel` returns `null` outside `__DEV__` (no production leak). The table is `public.pet`; `pets` is only the storage bucket. The sound helper is `src/utils/sfx.js` (no `.ts` variant).
- **Confidence adjusted:** the `anon` EXECUTE grant on `consume_pet_chat_quota` (R-39) is an inference from Supabase default privileges, not a verified fact; check `pg_proc.proacl` on the rebuilt database before treating it as open. The migration-filename versioning (`^([0-9]+)_(.*)\.sql$`, versions `2025`/`2026`) is verified from the CLI binary; only the exact failure mode on duplicate versions is inferred and needs a local `supabase db reset` (Docker daemon required).
- **Clarified:** the unused `expo-router` dependency does **not** block bundling on the pinned SDK 54 toolchain (web export succeeded); it is an SDK 56 upgrade blocker and a hygiene item, not a launch blocker.
- **Confirmed unreachable from the UI:** `PlantStore`, `Journal`, `Breathing` (no `navigate(...)` call sites anywhere), so the legacy garden unlock path is currently inert.
- **Ranking:** the critic's top-20 order matches the plan's phase order: schema bootstrap -> bucket design -> function redeploy with secrets and `verify_jwt` -> client re-pointing with a visible unconfigured state -> auth gate and profile creation -> stylize latency/status lifecycle -> same-day streak reset and check-in fallback -> device test of SecureStore and a real native build. Everything else is polish.
- **Additional owner questions surfaced:** does any backup, dump, or export of the deleted project exist (auth users, tables, storage objects)? If not, the restoration is a recreation with total data loss, which also means every destructive migration and client-side schema fallback becomes retirable once the schema is authored deliberately (retire them **after** the new schema is applied and verified, not before). Email confirmation on or off for the new project? Is it acceptable to send mood, streak, risk, 7-day activity and extracted disclosures to OpenRouter's free route and Groq, and which provider keys will exist?
- **Note on timing:** the twelve maps describe the tree as of 05:12; tooling, tests and the fixes in section 6.8 landed 05:23-05:29. The critic re-verified that `tsc -p tsconfig.json --noEmit` passes on the current tree.

## 13. Out-of-scope material (provenance only, untouched)

- `mobile/liftiq/`: separate Expo SDK 54 app "liftiq" 0.1.0 with its own `package.json`, lockfile, `node_modules`, `tsconfig.json` (strict, `@/*` alias) and `supabase/` dir; March 9-10 2026. The account's "Auramind gym" project (created 2026-03-11) and the `liftiq_mvp` migration on "AuraMind Production" indicate this is the LIFTIQ/AuraMind lineage. Not Floura.
- `C:\Users\donov\floura\srcd\screens\`: empty directory (2025-07-09).
- `C:\Users\donov\floura\supabase\`: Supabase CLI `config.toml` (`project_id = "floura"`, Postgres 17) and `.temp/` link cache pointing at the removed ref; no migrations or functions.
- The user profile contains many `Auramind*` directories (a different product); no other copy of Floura, and no other `pet-stylize` source, exists on this machine within the searched depth.
