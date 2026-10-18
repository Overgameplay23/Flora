# Luna — road to the App Store

Living checklist, started 2026-10-17. Tick items off here as they land. The product is far past the strategy's
MVP (painted pet, adaptive plan, journeys, five games, insights, scrapbook, cycle, memorial); what stands between
`main` and the App Store is mostly **launch plumbing and owner accounts**, not features.

Rough path: decisions + accounts (owner, a few days, Apple enrollment can take 1-2 days) → the build items below
(Claude, in parallel) → first EAS build on TestFlight → a week of real-phone use → App Review (usually 1-3 days).

> **Update, 18 October 2026 (TestFlight readiness audit; details in `docs/dev-notes.md`):** the repo side is ready for a first build. An EAS-style
> dry run evaluated the config and plugins, Expo Doctor passed 21/21, the iOS Hermes bundle built, and EAS's default
> SDK 57 image (Xcode 26.6) meets Apple's upload minimum. Bloom has every migration, table, function and bucket the
> app calls. What stands between `main` and TestFlight is in the list below.

**What each stage needs**
- **Internal TestFlight** (you and up to 100 people added in App Store Connect, no Apple review): an active Apple
  Developer membership with its agreement accepted (item 5), the App Store Connect app record ("From upload to your
  iPhone" below), your release-prep changes committed, and sign-up email that reaches testers (item 10: without it
  nobody outside your Supabase team gets a sign-up code). The painting (item 8) is not required: without the key,
  testers keep the drawn pet and read "Painting isn't switched on yet".
- **External TestFlight testers** also need Beta App Review (about a day): the privacy policy hosted (item 2), Test
  Information (a beta description and a feedback email) and sign-in details for the reviewer (the demo account
  below).
- **The App Store** also needs items 3, 6 and 7, and the App Review notes at the end of this page.

Legend: **[owner]** only Donovan can do it · **[claude]** buildable now, no owner input · **[both]** Claude
prepares, owner approves or finishes.

## 1. Blocks App Review (must have)

| # | Item | Who | State |
|---|---|---|---|
| 1 | **In-app account deletion** (Guideline 5.1.1(v): any app with sign-up must offer it in the app) | [both] Claude builds the RPC + screen; owner approves applying the migration to Bloom | **done**: Profile › Delete account (verified locally); migration `20261017160138_delete_my_account` applied to Bloom 2026-10-17 with the owner's OK |
| 2 | **Privacy policy** reachable in the app and on the store page (Guideline 5.1.1(i)) | [both] Claude drafts from the real data flows; owner reviews the wording and picks where it is hosted | **drafted**: in the app (Profile › Privacy) and as `docs/legal/privacy-policy.html` to host; needs your read, a contact email in `src/legal/privacy.json`, and a host |
| 3 | **Support URL** on the store page | [owner] a page or a mailto-backed site (can be the same host as the policy) | page drafted: `docs/legal/support.html` (from `src/legal/support.json`); the repository-root `website/luna` (uncommitted) is a second draft, so pick one; needs the inbox and a host |
| 4 | **App identity**: **Luna** (owner, 2026-10-17), bundle id and Android package `com.lunapet.app`, URL scheme `luna`, icon + adaptive icon + splash from the app's own dog under a full moon (`scripts/build-app-icon.js`) | [owner] decided the name · [claude] wired `app.json` + `eas.json` | **done in the repo**. Still yours: register `com.lunapet.app` in the Apple Developer portal (if it is taken, pick another and change both ids in `app.json`); the App Store *listing* name must be unique store-wide and plain "Luna" is almost surely taken, so plan on e.g. "Luna: Self-Care With Your Pet" (the home-screen name stays Luna); a trademark check |
| 5 | **Apple Developer Program** ($99/yr) and a free **Expo** account for EAS builds | [owner] | Expo: done (`@auramindai/luna`, both EAS environments set). Apple: pending; **blocks the first build** |
| 6 | **Privacy nutrition label** answers in App Store Connect | [claude] drafts the answers from the code; [owner] enters them | **drafted**: `docs/store/app-privacy.md` (from `src/legal/appPrivacy.json`, guarded by `src/__tests__/appPrivacy.test.ts`); you enter it in App Store Connect before App Store submission (not needed for TestFlight) |
| 7 | **Store listing**: subtitle, description, keywords, screenshots (6.9" and 6.5"), age rating | [claude] drafts copy and screenshots; [owner] uploads | pending |

## 2. Blocks a good launch (should have)

| # | Item | Who | State |
|---|---|---|---|
| 8 | **The painting works** (the heart of the app: your real pet painted from photos). Needs `GEMINI_API_KEY` as a Bloom function secret and `pet-stylize` deployed. Without it the app falls back to the drawn rig. | [owner] creates the key in a Google Cloud project **with billing turned on** (a free-tier AI Studio key lets Google train on people's pet photos, which breaks the privacy policy, and is not allowed for UK/EEA users; set a budget alert) and sets it in Supabase (Edge Functions → Secrets) — never paste it in chat · [both] one real painting on a phone | `pet-stylize` deployed to Bloom; waiting on the key and a real painting. Until then testers keep the drawn pet and read "Painting isn't switched on yet" (`src/domain/paintingErrors.ts`) |
| 9 | **Forgot password**: today a person who forgets their password is locked out for good | [claude] builds a code-based reset (no deep links needed) · [owner] in Bloom › Authentication › Emails, pastes `local-backend/supabase/templates/recovery.html` into "Reset password" and `local-backend/supabase/templates/confirmation.html` (subject "Your Luna code") into "Confirm signup" | **built** (verified locally); both templates on Bloom pending. Until "Confirm signup" is pasted, the sign-up email has a link instead of the code the app asks for |
| 10 | **Auth email delivery**: Supabase's built-in mailer delivers **only to addresses in your Supabase team**, and at most 2 emails an hour per project (supabase.com/docs/guides/auth/auth-smtp). With confirmation on (Bloom today), every other tester's sign-up fails, and your own phone pass (sign-up, throwaway sign-up, reset) needs three emails. **Blocks TestFlight sign-ups.** | [owner] custom SMTP (e.g. Resend, free tier) on a domain you own (Authentication › Emails › SMTP Settings, then raise the limit under Rate Limits); or, for the internal beta only, turn off "Confirm email" (Authentication › Sign In / Providers › Email). Password reset still needs SMTP for anyone outside the team | pending |
| 11 | **Bloom on a paid plan** (free projects pause after a week without traffic and have no backups) | [owner] Supabase Pro, $25/mo | pending |
| 12 | **A real-phone pass** on a TestFlight build: reminders, haptics, games, painting, sign-up to deletion | [both] script: `docs/TESTFLIGHT_PASS.md` | pending |
| 13 | **Crash reporting** (e.g. Sentry) so launch-week crashes are visible | [owner] account + DSN · [claude] wiring | first half done: an app-wide crash screen (`src/components/AppErrorBoundary.tsx`) replaces the blank screen and logs to Diagnostics; forwarding to Sentry waits for the account |
| 14 | **Apply the pending SQL to Bloom** (account deletion; later the plan engine table) | [owner] approves each push | account deletion applied 2026-10-17; plan engine table not yet. Note: Bloom also holds a `wardrobe_v1` migration (16 Oct); it is recovered as `local-backend/supabase/migrations/20261016014418_wardrobe_v1.sql` (uncommitted) |

## 3. Can wait for 1.1

- **Luna Club** (RevenueCat, App Store products, the Paid Apps agreement, tax and banking). Recommendation:
  launch free, learn D1/D7/D30 for a month, add the Club in 1.1. The owner decides (ROADMAP "Decisions" 3).
- Pet Talk (needs `OPENAI_API_KEY`; the screen hides itself without one).
- Sign in with Apple / Google and the anonymous first minutes (needs the dev build; Apple only requires Sign in
  with Apple when another social sign-in is offered, so email-only is fine for 1.0).
- Health steps/sleep, widgets, wardrobe.

## Owner decisions that touch launch

1. ~~Name~~ **Luna**, decided 2026-10-17 (bundle id `com.lunapet.app`; trademark check still to do).
2. Launch free, or with the Club from day one?
3. Where the privacy policy and support page live (a domain you own, GitHub Pages, or a Notion page).
4. Email confirmation on (needs SMTP) or off for 1.0? This one now **blocks TestFlight** (item 10).

## First build, once the Apple membership is active

Already done (17 Oct): the Expo project `@auramindai/luna` is linked (`app.json` › `extra.eas.projectId`), and the
EAS `production` and `preview` environments hold `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
(the publishable key only, never the service key). Don't run `eas init` or `eas env:create` again. Use the
**production** profile for TestFlight; `preview` is an ad hoc build for registered devices and never reaches
TestFlight. From `mobile/`:

0. **[both]** Commit everything `git status` shows as your release prep first: the EAS setup in `app.json`, `eas.json`,
   `package.json` and `package-lock.json`; the repository-root `.easignore`; `src/services/authLifecycle.ts` (which
   `AuthContext.js` now imports); `scripts/release-preflight.js` and `scripts/smoke-hosted.js` (which `package.json` now
   calls); and the rest of your pending work. EAS builds whatever is in the folder but records the last commit, so a
   build from uncommitted work can't be reproduced or matched to a bug report. On that commit: `npm run check` and
   `npm run check:release`.
1. **[owner]** Before the first build, register the bundle id (developer.apple.com › Certificates, Identifiers &
   Profiles › Identifiers › + › App IDs › `com.lunapet.app`) and create the App Store Connect record (step 2 of the
   next section), so the app gets the name you chose: if `eas submit` has to create it, it names it "Luna", or
   "Luna (a1b2c3)" when that is taken, and that is what testers see. Commit the `ascAppId` you add to `eas.json`.
2. **[owner]** `npx eas-cli@latest build --platform ios --profile production`, interactively the first time: EAS logs
   into Apple, registers `com.lunapet.app` and makes the certificate and provisioning profile. It also turns on
   Push Notifications for the App ID (reminders are local; you don't need an APNs key). Build numbers count up by
   themselves (`appVersionSource: remote`, `autoIncrement`).
3. **[owner]** `npx eas-cli@latest submit --platform ios --profile production --id <that build's id>`: always the
   build you just checked, never "latest".
4. Watch the email from App Store Connect after processing. If it mentions ITMS-90683 and the microphone (expo-audio
   contains recording code the app never uses), tell Claude: the fix is one purpose string and a rebuild.

## From upload to your iPhone (internal testing, no Apple review)

1. **[owner]** App Store Connect › Business: accept any pending agreements.
2. **[owner]** Apps › + › New App: iOS; Name = the listing name (e.g. "Luna: Self-Care With Your Pet"; the home-screen
   name stays Luna); English (U.S.); Bundle ID `com.lunapet.app` (registered in step 1 of "First build"); SKU
   `luna-ios`. Then copy the Apple ID
   from App Information into `eas.json`: `"submit": { "production": { "ios": { "ascAppId": "<id>" } } }`.
3. **[owner]** After `eas submit`, wait for "completed processing" (5-30 minutes). Export compliance is already
   answered by the app (`usesNonExemptEncryption: false`).
4. **[owner]** TestFlight › Test Information: a beta description and the feedback email. TestFlight › Internal
   Testing › + a group ("Luna team"), add yourself, turn on automatic distribution. Other internal testers must first
   be added under Users and Access (up to 100).
5. **[owner]** For each build, paste this into What to Test:
   > Thanks for trying Luna. Please: sign up (a code comes by email), add 1-3 photos of your dog or cat, finish a
   > care task, play each game, write in the journal, turn on a reminder. To report a problem, take a screenshot and
   > tap Share Beta Feedback, or open TestFlight › Luna › Send Beta Feedback. If you see "Something went sideways",
   > tap Try again (don't close the app: that erases the log), then in Profile tap "Luna 1.0.0" at the bottom five
   > times › Copy logs, and paste it into your feedback. Leave out passwords, codes and journal text.
6. **[owner]** On the iPhone: install TestFlight from the App Store, accept the invite with the same Apple ID,
   Install, then run `docs/TESTFLIGHT_PASS.md`.

Notes: iPad is off for 1.0 (`supportsTablet: false`, so no iPad screenshots are needed and the phone layout is what
review sees); the app declares no encryption beyond HTTPS (`usesNonExemptEncryption: false`), so uploads skip the
export-compliance question; it asks only for photos (to pick them, and to save a share card) and the camera, with Luna's own wording, and declares no
microphone, background audio or Face ID (guarded by `src/__tests__/appIdentity.test.ts`). The old `ios/` and
`android/` folders are stale; EAS builds from the config, so they can stay until someone deletes them on purpose.

## App Review: demo account and notes

Luna needs an account, so App Review needs one too (Guideline 2.1: a reviewer who cannot get in rejects the
build). Before submitting:

1. **[owner]** On the TestFlight build, sign up a dedicated review account on Bloom (an address you control, e.g.
   `review@<your domain>`; never your own account), finish onboarding with a pet photo so the painting is there,
   do a check-in and a task so Home is not empty. Do not delete it while a review is open; the reviewer may try
   Delete account on their own sign-up instead.
2. **[owner]** App Store Connect > the version > App Review Information: that email and password, a contact
   phone and email, and the notes below.

Notes for the reviewer (paste and adjust):

> Luna is a gentle self-care app built around the user's own pet. The demo account already has a pet. To try the
> full first run, sign up with any email instead: onboarding asks for 1-3 photos of a dog or cat, which are
> painted into an illustration (this takes up to a minute; the drawn pet stands in meanwhile).
> Account deletion: Profile > Account > Delete account (type "delete"). Privacy policy: Profile > Account > Privacy.
> Cycle tracking is optional, stays on the device, and makes no medical or fertility predictions; the app makes
> no medical claims. There are no in-app purchases in this version. The app uses the photo library and camera only
> to paint the user's pet, and saves to the photo library only when the user saves a share card.

The painting sentence assumes item 8 is done (the Gemini key set and `pet-stylize` deployed); without it, cut that
sentence, since the drawn pet is all a reviewer would see.

If something breaks during testing, the crash screen ("Something went sideways") logs the error to Diagnostics:
tap Try again (closing the app erases the log), then Profile, tap the version line five times, Copy logs.
