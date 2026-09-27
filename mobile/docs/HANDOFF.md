# Luna — Project Handoff

Baseline as of **27 September 2026**, compiled from the repository at commit `be62e0f` and a fresh run of
`npm run check` the same day. Luna was formerly "Floura" / "Flora". Repo: `github.com/Overgameplay23/Flora`,
branch `main`, app in `mobile/`. Owner: Donovan.

> A cozy self-care app where you look after an illustrated version of your own pet, and it looks after you back.

| Area | Status |
|---|---|
| App (client) | **Working.** Builds cleanly. Runs end to end on web against a local backend. |
| Backend | **Local only.** The original hosted Supabase project was deleted. A local Docker copy works. |
| On a real phone | **Not yet verified.** Targets Expo Go on iPhone. Blocked by this PC's network settings. |
| Store launch | **Not started.** No app identity, no hosted backend, no payments. |

---

## 1. The short version

- **What it is:** a mobile wellness app (Expo / React Native, Supabase backend). You create an illustrated dog
  or cat that looks like your real pet. Small self-care actions like a check-in, a glass of water or a walk make
  the pet happy and grow a garden (dogs) or a cozy window nook (cats). Nothing is ever lost and the pet never
  gets sick.
- **Where it came from:** the code was recovered in mid-September 2026 from an archive with zero git history,
  and its hosted backend had been deleted. Between 16 and 26 September it was restored, put on GitHub, given a
  local backend, and extended through about 21 documented change sets.
- **Health today:** `npm run check` passes: client typecheck 0 errors, Edge Functions typecheck 0 errors,
  **152 of 152 tests in 28 suites**, and the production web export builds. The git tree is clean and matches `main`.
- **The biggest gap:** there is no hosted backend, so real users cannot sign up anywhere. Everything runs on a laptop.
- **Second gap:** nobody has confirmed it running on a physical phone yet. The build targets the App Store version
  of Expo Go (SDK 54). The blocker is this machine's firewall and network profile.
- **Direction:** a 40-page product strategy report (in the repo) is the north star. About half of its MVP is
  built. Health data, widgets, sign-in with Apple/Google, the "Sprouts" currency and room decor, and the
  subscription are not built.

## 2. What Luna is

The strategy report calls it a *Reciprocal Wellness & Routine Sanctuary*. You care for yourself by caring for a
digital twin of your real pet. The tone is gentle throughout: no guilt, no broken streaks, no pet that suffers
when you miss a day.

**Who it is for.** The beachhead user is a pet owner, mostly women aged 21 to 28 in the US and UK, early in a
career or in grad school, dealing with burnout or low executive function. She likes cozy aesthetics, already uses
apps like Finch, Flo or Forest, and finds new apps through pet content on TikTok and Reels.

**Core loop.** Create your pet → one quick check-in or small task → pet reacts and acts it out → earn points →
plants grow in the garden or nook → come back tomorrow.

The report's version spends a currency called "Sprouts" on room furniture. Luna currently calls it "pts" and
spends it on plants. Renaming is a copy change waiting on the owner.

**What makes it different**

- **It is your pet.** The illustrated pet is built from layered vector parts (coat, ears, markings, eyes). A photo
  sets its colours automatically, and you can adjust it by hand. The report names "the avatar doesn't look like my
  pet" as the biggest product risk.
- **Dogs and cats get different places.** Dogs live in a painted garden; cats live in an indoor window nook. Both
  follow the local time of day (dawn, day, golden hour, night).
- **Respect for hard moments.** A "Rainbow Bridge" memorial mode exists for owners whose pet has died. It stops
  reminders and changes the tone throughout the app.

## 3. What it looks like

Real captures from the production web build against the local backend with demo data (24–25 Sep 2026):

| Screen | File |
|---|---|
| Onboarding: dog, cat, or adopt | `docs/screenshots/2026-09-25-illustrated-pet/02-species.png` |
| Pet look presets | `docs/screenshots/2026-09-25-illustrated-pet/03-look-presets.png` |
| Adopt a companion | `docs/screenshots/2026-09-25-adopt/02-shelter-dogs.png` |
| Home, dog (garden) | `docs/screenshots/2026-09-25-pet-life/01-home-t0.png` |
| Home, cat (window nook) | `docs/screenshots/2026-09-25-window-nook/04-home-nook.png` |
| Check-in | `docs/screenshots/2026-09-25-gentle-loop/02-checkin-prompt.png` |
| Daily tasks | `docs/screenshots/2026-09-25-pet-life/07-daily-tasks.png` |
| Garden plant cards | `docs/screenshots/2026-09-25-window-nook/10-garden-cards.png` |
| Our week | `docs/screenshots/2026-09-25-our-week/02-our-week.png` |
| Play (Fetch) | `docs/screenshots/2026-09-24-play/04-fetch-flying.png` |
| Cycle tracker | `docs/screenshots/2026-09-24-cycle/03-logged.png` |
| Memorial | `docs/screenshots/2026-09-25-memorial/03-memorial-active.png` |

Whole flows: `docs/screenshots/2026-09-24-contact-sheet.png`, `2026-09-25-contact-sheet*.png`,
`2026-09-26-contact-sheet-e.png`.

## 4. What works today

"Verified" means exercised in the production web build against the local backend, with screenshots in the repo.
Nothing has been verified on a physical phone.

| Area | What it does | Status |
|---|---|---|
| Sign up / sign in | Email and password through Supabase Auth. Account is created *before* onboarding (the report wants it deferred until after). | Verified |
| Onboarding | Welcome → species → optional photo → look → name → meet your pet → first small task. Two tracks: "my own pet" and "adopt a companion" (8 ready-made pets). Last step offers a morning reminder. | Verified |
| Illustrated pet | Dog and cat vector rig: presets, colour and ear options, moods, blinking, tail wag, walking, paw wave on tap, acts out completed tasks. Wanders around the garden or nook. | Verified |
| Photo → look | Reads a JPEG on the device and suggests coat and ear colours. PNG photos skip the suggestion (R-80). | Verified |
| Home | Scene following the clock, greeting, next-plant progress, this-week card, quick actions, cycle card if enabled, "welcome back" after 5+ days away. | Verified |
| Daily check-in | 1–5 mood slider, a daily reflection question asked by the pet, one optional line. Editable once per day. | Verified |
| Tasks and habits | Three daily tasks seeded per user, habits list, points per task. Days follow the person's local calendar, not UTC. | Verified |
| Garden | 10-plant catalogue; plant and upgrade with points through a server-side function. Cats see the same economy as a nook. | Verified |
| Streak | One "days in a row" number, softly worded. Nothing is lost when it breaks. | Verified |
| Our week | Weekly recap told by the pet, from Home and Profile. Pull-only (no Sunday push yet). | Verified |
| Journal | Private, prompt-led journal. Saved on the device first and mirrored to the database. | Verified |
| Play | Fetch and Bubbles mini games. Can count as a daily task. | Verified |
| Cycle tracker | Opt-in, on the device only, period / follicular / luteal phases with disclaimers. No fertility predictions, by design. | Verified |
| Memorial mode | Pet rests, copy changes, reminders stop. Can be undone. | Verified |
| Reminders | Local notifications in the pet's voice (morning, evening, Sunday), opt-in, no server. Runs out on its own if the app isn't opened ("graceful hibernation"). | Built, phone untested |
| Talk to your pet | AI conversation through OpenAI, key kept on the server. Screen hides itself until the server reports a key. | Built, needs key + hosted backend |
| Painted portrait | Older Gemini "stylize my photo" path. Optional; the vector rig is now the main pet. | Needs provider keys |
| Old chat screen | Retired from the UI by the owner on 25 Sep. Code stays on disk, unrouted. | Hidden |

## 5. Gaps and risks

**No hosted backend.** Supabase project `gghesvpmskjlrlpoosgf`, which every old script and README points at, was
deleted (verified 16 Sep: DNS gone, API says "removed"). No backup was found, so treat the original user data as
lost. The logged-in Supabase account only holds unrelated *AuraMind* projects. Do not write to those.

| Gap | Why it matters | What unblocks it |
|---|---|---|
| Hosted backend | Real users can't sign up; AI talk can't run. | Owner creates a Supabase project; apply the 24 migrations in `local-backend/supabase/migrations`; deploy Edge Functions; set secrets. |
| Phone verification | Reminders, haptics, gestures and performance are only proven on web. | Mark the Wi-Fi as Private or allow `node.exe` through the firewall. Tunnel mode is broken because antivirus removed `ngrok.exe`. |
| App identity | `app.json` still has slug `mobile`, package `com.anonymous.mobile`, no iOS bundle ID, no EAS project. "Luna" needs a trademark check. | Owner picks name, bundle ID and scheme; then regenerate the (stale) native folders. |
| Native features | Health steps/sleep, widgets, remote push, Apple/Google sign-in need a custom development build. Expo Go can't do them. | App identity + Apple Developer account + EAS. Moving off Expo Go also frees the SDK upgrade. |
| Database security | Several tables let a signed-in user write their own points and plant levels directly (R-37 to R-41). Fine for a demo, not for launch. | RLS hardening pass before any public backend. |
| Storage privacy | The `pets` photo bucket is public, keyed by user id (R-13, R-14). | Private bucket + signed URLs when the backend is rebuilt. |
| Three streak stores | The app shows one number, but three tables still compute streaks separately (R-27). | Pick one canonical store during the backend rebuild. |
| Portrait lifecycle | The old stylize path can time out on the client or stay "processing" forever (R-16, R-17). | Only matters if the painted portrait is kept. |
| Monetization | Nothing built: no paywall, no subscription, no store. | App identity and a native build (RevenueCat or StoreKit). |

Full risk register (R-01 to R-83, with file and line references): `docs/RESTORATION_BASELINE.md`, section 8.

## 6. Where it is going

North star: `docs/product-strategy/PRODUCT_STRATEGY.md`, a summary of the full report
(`Flora_App_Product_Strategy_Research.pdf`, plus a searchable `.txt`). The repo's `CLAUDE.md` says to treat it as
direction, not a rigid spec, and never to delete working code because of it. Conflicts go to `docs/dev-notes.md`
for the owner to decide.

**The report's MVP, against what exists**

| MVP capability | Where Luna is | Status |
|---|---|---|
| 1. Parametric pet from a photo, with a tweak step | Dog/cat vector rig, photo sets colours, editor. Breed shapes limited to presets. | Mostly done |
| 2. Reciprocal habits → Sprouts → room decor, no streak penalty | Tasks → points → plants. No penalties. No room furniture; currency not yet named "Sprouts". | Partly |
| 3. Daily reflection prompt from the pet | Text prompt in the check-in and journal. No audio. | Done (text) |
| 4. Apple Health / Google Fit auto-completing goals | Not started. Needs a native build. | Not built |
| 5. Lock screen / home screen widgets | Not started. Needs a native build. | Not built |
| 6. Optional on-device cycle awareness | Tracker built, on the device, non-clinical. Feeds the AI talk context; does not yet change the pet's everyday tone. | Mostly done |

**Already built from the report:** Graceful Hibernation (welcome back after 5+ days; reminders run out instead of
piling up) · weekly recap in the pet's voice · Rainbow Bridge memorial mode · "Adopt a companion" · sanctuary
follows local time.

**Not built yet:** Home energy slider (Exhausted / Anxious / Calm / Energized; check-in uses a 1–5 mood slider
instead) · account creation after the first 3 minutes with Apple/Google sign-in · weather in the scene, seasonal
rooms, milestone spaces · "Flora Sanctuary Club" subscription ($6.99/mo or $44.99/yr, paywall after the 3rd
check-in) · social video export (real pet next to avatar).

**Out of scope for v1:** punitive streaks or a pet that declines · an open-ended chatbot · anything clinical or
fertility predictions · in-app social messaging · vet or medication records.

One live tension: the report says no open-ended chatbot, but the owner has chosen to add an OpenAI-backed pet
conversation (built, hidden until configured). Logged in `dev-notes.md` as the owner's call.

**The report's 12-month roadmap**

| Phase | Months | Scope |
|---|---|---|
| 1 | 1–3 | iOS launch, pet illustration system, habit loop + hibernation, Health steps, annual plan. Goal: D30 above 10%. |
| 2 | 4–6 | Widgets, seasonal decor store, sleep tracking, one-tap social video export. |
| 3 | 7–9 | Cycle-aware "energy rhythm", weekly scrapbooks with voice notes, memorial mode, gifting. |
| 4 | 10–12 | Multi-pet rooms, shared couple spaces, Android. |

Target benchmarks: D1 > 38%, D7 > 18%, D30 > 10%, DAU/MAU > 35%, annual trial-to-paid > 40%. Some phase 3 items
(memorial) are already done; phase 1's Health, identity and subscription are not.

## 7. How to run it

Proven on Windows 11. macOS should work the same way but hasn't been tried.

**Prerequisites**

- Node 22 (tested on 22.17.0) and npm
- Docker Desktop, running
- Supabase CLI (on Windows, install with Scoop; the npm global install is unsupported). Tested with 2.67.1.
- For the phone: the **Expo Go** app from the App Store, which is the SDK 54 build

> Always use `npx expo …` and always run from inside `mobile/`. A global legacy `expo` binary exists on the
> original machine and fails, and starting Metro from another folder gives a misleading "ESM URL scheme" error.

**First run**

1. Install:
   ```bash
   git clone https://github.com/Overgameplay23/Flora.git
   cd Flora/mobile
   npm install
   ```
2. Start the local backend (builds and applies all 24 migrations; ports 56321 API, 56322 Postgres, 56323 Studio):
   ```bash
   npm run backend:start
   ```
3. Point the app at it. Writes `.env.local` (git-ignored, overrides `.env`). Add `-- --localhost` for web-only use.
   ```bash
   npm run backend:env
   ```
4. Optional: seed demo data (a demo account with a dog named Biscuit and a week of activity; the login is in
   `local-backend/README.md`):
   ```bash
   npm run backend:seed
   ```
5. Run the app. Press `w` for web, or use the phone script, which pins the correct LAN address for the QR code:
   ```bash
   npx expo start
   npm run start:phone
   ```

**Everyday commands**

| Command | What it does |
|---|---|
| `npm run check` | Everything below in one go. Run it before and after every change set. |
| `npm run typecheck` | TypeScript over the client |
| `npm run typecheck:functions` | Deno type check of the four Edge Functions |
| `npm test` | Jest: 28 suites, 152 tests, mostly pure domain logic |
| `npm run export:web` | Production web export into `.expo-export-check/` (proves the bundle builds) |
| `npm run backend:stop` / `backend:reset` | Stop the stack (keeps data) / wipe and re-apply all migrations |
| `npx supabase migration up --workdir local-backend` | Apply only new migrations to a running stack |

**Known machine quirks (original Windows PC)**

- **Phone can't reach the dev server:** the Wi-Fi is classed "Public" and Windows Firewall blocks `node.exe` there.
  Switch the network to Private, or use the iPhone's hotspot. Also allow inbound TCP 56321 for the backend.
- **Docker won't start after a reboot** ("dockerInference … cannot be accessed"): quit Docker, rename
  `%LOCALAPPDATA%\Docker\run` and `%LOCALAPPDATA%\docker-secrets-engine` aside, relaunch. Never factory-reset
  Docker; other projects' stacks live there.
- Other local Supabase stacks use ports 54xxx (an old empty Floura stack) and 55xxx (AuraMind). Leave both alone.

## 8. Codebase map

**Stack:** Expo SDK 54 · React Native 0.81 (new architecture) · React 19.1 · TypeScript and some legacy JS · React
Navigation (tabs + stacks) · NativeWind · react-native-svg for the pet and nook · Supabase (Postgres, Auth,
Storage, Edge Functions in Deno) · AsyncStorage and SecureStore on the device · expo-notifications · Jest with jest-expo.

| Path (under `mobile/`) | What lives there |
|---|---|
| `App.js`, `index.js` | Entry. `AuthProvider` → `RootNavigator`. |
| `app/navigation/` | `RootNavigator.js` (auth gate: signed out → Login; no pet → Onboarding; else main app) and `AppNavigator.js` (tabs Home, Garden, Pet, Profile, plus stack screens). |
| `app/screens/` | Older JS screens still in use: Home, Garden, Pet, Profile. |
| `src/screens/` | Newer TS screens: check-in, habits, tasks, journal, week, play, cycle, reminders, memorial, pet talk, `onboarding/`. |
| `src/domain/` | **Pure product logic, the heart of the app and the most tested:** `petLook`, `photoLook`, `shelter`, `sanctuary`, `timeOfDay`, `wander`, `streaks`, `hibernation`, `reflection`, `week`, `journal`, `cycle`, `memorial`, `reminders`, `petTalk`. |
| `src/components/pet/vector/` | The illustrated pet: `petParts.ts` (shapes) and `PetRig.tsx` (animation). `PetLookEditor.tsx` alongside. |
| `src/components/garden/` | `GardenStage` (dog garden) and `NookBackdrop` (cat window nook). |
| `src/services/` | Data access: Supabase calls plus device stores (`petStore`, `journalStore`, `cycleStore`, `memoryStore`, `reminders`). |
| `src/utils/confirm.ts` | Use this for dialogs. `Alert.alert` silently does nothing on web. |
| `supabase/` | Original SQL (`schema_*.sql`, `migrations/`) and Edge Functions: `pet-talk` (OpenAI, current), `pet-stylize` (Gemini portrait), `pet-chat` (retired), `weekly-summary` (no caller). |
| `local-backend/` | Local Supabase stack: config, migration builder, 6 forward-fix SQL files, seed and env scripts. |
| `docs/` | Baseline, plan, dev notes, strategy report, screenshots, preserved originals. |
| `android/`, `ios/` | Stale and partial. Regenerate with prebuild once there is an app identity; don't hand-edit. |
| `liftiq/` | **A different product** (workout app prototype). Committed as found. Do not merge, build or move it. |

Some older code is dead or superseded but kept on purpose (for example `PetSetupScreen`, `PlantStoreScreen`, and the
old `flower_*.png` art, which is opaque, not transparent). The list is in `docs/RESTORATION_BASELINE.md` section 10.
Deleting it should be a deliberate, reviewed change.

## 9. Backend

**Main tables:** `profiles` · `pet` (incl. `species`, `look`, `memorial_at`) · `checkins` · `tasks`,
`task_completions` · `habits`, `habit_completions` · `user_stats` · `plant_catalog`, `user_plants`,
`user_plant_upgrades` · `journal_entries` · retention tables `user_events`, `daily_user_metrics`, `pet_state`,
`weekly_summaries`, `user_memories`. Storage bucket `pets`.

**Key server functions:** `complete_task`, `get_garden_points`, `upgrade_plant`, `log_event_and_rollup`,
`recompute_pet_state`. All take the user's identity from the auth token and bucket by the person's local day.

The cycle tracker, reminders and the journal's first copy stay **on the device**. That is a product promise, not
an accident.

**Going hosted (not done; needs the owner's approval)**

1. Create a new Supabase project in an account the owner controls.
2. Apply the generated migrations from `local-backend/supabase/migrations/` in order (proven on a fresh Postgres 17 locally).
3. Do the security pass first: RLS hardening, private photo bucket, lock down `consume_pet_chat_quota`.
4. Deploy `pet-talk`. Set `OPENAI_API_KEY` and `OPENAI_MODEL` as function secrets; the key never goes in the app.
   See `supabase/functions/pet-talk/README.md`.
5. Put the new URL and anon key in the app's environment. Rewrite the old npm deploy scripts, which still name the
   dead project ref.

## 10. House rules

The owner's standing rules from the restoration. Keep them unless Donovan changes them.

- **Preserve, don't rewrite.** Never delete working code because the strategy disagrees; log the conflict in
  `docs/dev-notes.md`. Before editing an old file for the first time, copy it to `docs/baseline/originals/`.
- **Ask before anything remote or destructive:** deploying, migrating a hosted database, creating projects,
  rotating keys, publishing, force-pushing, `git reset/clean`.
- **Never print or commit secrets.** `.env*` is git-ignored. Report keys as present or missing only.
- **Don't upgrade the Expo SDK** while the test device is App Store Expo Go. It only opens SDK 54.
- **Keep the schema fallbacks** in the client (it tolerates several old database shapes) until a hosted schema is
  live and verified.
- **Green before commit:** run `npm run check`, commit and push each verified change set, and record it in
  `RESTORATION_BASELINE.md` section 6 with evidence.
- **Product guardrails:** no guilt or punishment, no clinical claims, cycle data stays on the device, memorial mode
  silences cheerfulness and reminders.

## 11. Open decisions for the owner

| Decision | Blocks |
|---|---|
| Where the backend lives (new Supabase project, which account) and whether any backup of the old one exists | Real users, AI talk, beta testing |
| App identity: final name (trademark check on "Luna"), bundle ID, Android package, URL scheme, Apple Developer / EAS ownership | Native build, TestFlight, Health, widgets, push, payments |
| Native strategy: stay on Expo Go for now, or move to a development build (which also allows an SDK upgrade) | Everything native |
| AI talk: go ahead with OpenAI (model name, budget, what personal context is sent), given the report's "no chatbot" guidance | Turning on Pet Talk |
| Naming: "Sprouts" instead of "pts"; garden and nook vs. the report's single room | Copy, decor economy |
| Fate of legacy pieces: painted portrait (Gemini), old garden unlock economy, `weekly-summary`, `PlantStore` | Cleanup, backend simplification |
| Auth policy: email confirmation on or off; profile created by a DB trigger or by the client | Hosted launch |

## 12. Suggested first 30 days

1. **Get it running yourself** with the steps above, on web first, then on a phone with Expo Go. The first phone
   run is itself a milestone: reminders and touch have never been tested on a device.
2. **Close the identity and backend decisions** with Donovan. Almost every remaining MVP item waits on these two.
3. **Stand up a hosted staging backend**, with the security pass (RLS, private bucket) done before any real user touches it.
4. **Move to a development build and TestFlight.** This unlocks remote push, Apple/Google sign-in, Health steps and
   widgets, the report's phase 1 and 2.
5. **Close the loop the report cares about:** account creation after onboarding, the Home energy slider, Sprouts and
   a first decor item, then the paywall after the third check-in.
6. **Instrument retention** (D1, D7, D30, DAU/MAU) before any growth push. The `user_events` tables are a starting point.

## 13. Where to read more

| File (under `mobile/`) | Read it for |
|---|---|
| `docs/product-strategy/PRODUCT_STRATEGY.md` | The product north star, in two pages |
| `docs/product-strategy/Flora_App_Product_Strategy_Research.pdf` | The full 40-page research report |
| `docs/RESTORATION_BASELINE.md` | The engineering record: architecture, every change set with evidence (section 6), risk register (8), fallbacks (9), dead code (10) |
| `docs/RESTORATION_PLAN.md` | Phased restoration plan and dated status updates |
| `docs/dev-notes.md` | Strategy-vs-code conflicts and the owner's calls on them |
| `local-backend/README.md` | Local backend details |
| `supabase/functions/pet-talk/README.md` | Turning on the AI conversation |
| `../CLAUDE.md` | Instructions for AI coding agents working in the repo |

Heads-up: `mobile/README.md` and the first half of `docs/dev-notes.md` predate the restoration and still reference
the deleted project. Prefer the docs above.
