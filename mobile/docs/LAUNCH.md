# Luna — road to the App Store

Living checklist, started 2026-10-17. Tick items off here as they land. The product is far past the strategy's
MVP (painted pet, adaptive plan, journeys, five games, insights, scrapbook, cycle, memorial); what stands between
`main` and the App Store is mostly **launch plumbing and owner accounts**, not features.

Rough path: decisions + accounts (owner, a few days, Apple enrollment can take 1-2 days) → the build items below
(Claude, in parallel) → first EAS build on TestFlight → a week of real-phone use → App Review (usually 1-3 days).

Legend: **[owner]** only Donovan can do it · **[claude]** buildable now, no owner input · **[both]** Claude
prepares, owner approves or finishes.

## 1. Blocks App Review (must have)

| # | Item | Who | State |
|---|---|---|---|
| 1 | **In-app account deletion** (Guideline 5.1.1(v): any app with sign-up must offer it in the app) | [both] Claude builds the RPC + screen; owner approves applying the migration to Bloom | **done**: Profile › Delete account (verified locally); migration `20261017160138_delete_my_account` applied to Bloom 2026-10-17 with the owner's OK |
| 2 | **Privacy policy** reachable in the app and on the store page (Guideline 5.1.1(i)) | [both] Claude drafts from the real data flows; owner reviews the wording and picks where it is hosted | **drafted**: in the app (Profile › Privacy) and as `docs/legal/privacy-policy.html` to host; needs your read, a contact email in `src/legal/privacy.json`, and a host |
| 3 | **Support URL** on the store page | [owner] a page or a mailto-backed site (can be the same host as the policy) | pending |
| 4 | **App identity**: **Luna** (owner, 2026-10-17), bundle id and Android package `com.lunapet.app`, URL scheme `luna`, icon + adaptive icon + splash from the app's own dog under a full moon (`scripts/build-app-icon.js`) | [owner] decided the name · [claude] wired `app.json` + `eas.json` | **done in the repo**. Still yours: register `com.lunapet.app` in the Apple Developer portal (if it is taken, pick another and change both ids in `app.json`); the App Store *listing* name must be unique store-wide and plain "Luna" is almost surely taken, so plan on e.g. "Luna: Self-Care With Your Pet" (the home-screen name stays Luna); a trademark check |
| 5 | **Apple Developer Program** ($99/yr) and a free **Expo** account for EAS builds | [owner] | pending |
| 6 | **Privacy nutrition label** answers in App Store Connect | [claude] drafts the answers from the code; [owner] enters them | pending |
| 7 | **Store listing**: subtitle, description, keywords, screenshots (6.9" and 6.5"), age rating | [claude] drafts copy and screenshots; [owner] uploads | pending |

## 2. Blocks a good launch (should have)

| # | Item | Who | State |
|---|---|---|---|
| 8 | **The painting works** (the heart of the app: your real pet painted from photos). Needs `GEMINI_API_KEY` as a Bloom function secret and `pet-stylize` deployed. Without it the app falls back to the drawn rig. | [owner] gets a key at aistudio.google.com and sets it in Supabase (Edge Functions → Secrets) — never paste it in chat · [claude] deploys `pet-stylize` on your go-ahead and tests a real painting | pending |
| 9 | **Forgot password**: today a person who forgets their password is locked out for good | [claude] builds a code-based reset (no deep links needed) · [owner] pastes `local-backend/supabase/templates/recovery.html` into Bloom's "Reset password" email template | **built** (verified locally); template on Bloom pending |
| 10 | **Auth email delivery**: Supabase's built-in mailer sends only a few emails an hour, so sign-up confirmations fail once more than a handful of people join | [owner] custom SMTP (e.g. Resend, free tier) on a domain you own, or turn email confirmation off for launch | pending |
| 11 | **Bloom on a paid plan** (free projects pause after a week without traffic and have no backups) | [owner] Supabase Pro, $25/mo | pending |
| 12 | **A real-phone pass** on a TestFlight build: reminders, haptics, games, painting, sign-up to deletion | [both] | pending |
| 13 | **Crash reporting** (e.g. Sentry) so launch-week crashes are visible | [owner] account + DSN · [claude] wiring | first half done: an app-wide crash screen (`src/components/AppErrorBoundary.tsx`) replaces the blank screen and logs to Diagnostics; forwarding to Sentry waits for the account |
| 14 | **Apply the pending SQL to Bloom** (account deletion; later the plan engine table) | [owner] approves each push | account deletion applied 2026-10-17; plan engine table not yet. Note: Bloom also holds a `wardrobe_v1` migration (16 Oct) that is in no branch of this repo |

## 3. Can wait for 1.1

- **Luna Club** (RevenueCat, App Store products, the Paid Apps agreement, tax and banking). Recommendation:
  launch free, learn D1/D7/D30 for a month, add the Club in 1.1. The owner decides (ROADMAP "Decisions" 3).
- Pet Talk (needs `OPENAI_API_KEY`; the screen hides itself without one).
- Sign in with Apple / Google and the anonymous first minutes (needs the dev build; Apple only requires Sign in
  with Apple when another social sign-in is offered, so email-only is fine for 1.0).
- Health steps/sleep, widgets, wardrobe, Cozy Run (waits on the rules).

## Owner decisions that touch launch

1. ~~Name~~ **Luna**, decided 2026-10-17 (bundle id `com.lunapet.app`; trademark check still to do).
2. Launch free, or with the Club from day one?
3. Where the privacy policy and support page live (a domain you own, GitHub Pages, or a Notion page).
4. Email confirmation on (needs SMTP) or off for 1.0?

## First build, once the Apple and Expo accounts exist

The repo is ready for EAS (`mobile/eas.json`: `preview` for testers, `production` for TestFlight and the store, both
built against the hosted backend with `APP_ENV=staging`). From `mobile/`:

1. `npx eas-cli login`, then `npx eas-cli init` (links the Expo project and writes its id into the config).
2. Give the build the hosted backend's two public values as EAS environment variables (publishable/anon key only,
   never the service key): `npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL ...` and the same for
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `app.config.js` refuses a build without them, or with a server key.
3. `npx eas-cli build --platform ios --profile production` (EAS asks for the Apple login and makes the certificates).
4. `npx eas-cli submit --platform ios` sends it to App Store Connect; add yourself as a TestFlight tester.

Notes: iPad is off for 1.0 (`supportsTablet: false`, so no iPad screenshots are needed and the phone layout is what
review sees); the app declares no encryption beyond HTTPS (`usesNonExemptEncryption: false`), so uploads skip the
export-compliance question; it asks only for photos and the camera, with Luna's own wording, and declares no
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
> to paint the user's pet.

The painting sentence assumes item 8 is done (the Gemini key set and `pet-stylize` deployed); without it, cut that
sentence, since the drawn pet is all a reviewer would see.

If something breaks during testing, the crash screen ("Something went sideways") logs the error to Diagnostics:
Profile, tap the version line five times, Copy.
