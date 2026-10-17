# Floura — road to the App Store

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
| 4 | **App identity**: final name (Floura vs Luna, app.json still says Luna), bundle id (e.g. `com.floura.app`), URL scheme, icon + splash | [owner] decides the name and id · [claude] wires app.json/eas.json and every "Luna" in the UI | waiting on the name |
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
| 13 | **Crash reporting** (e.g. Sentry) so launch-week crashes are visible | [owner] account + DSN · [claude] wiring | pending |
| 14 | **Apply the pending SQL to Bloom** (account deletion; later the plan engine table) | [owner] approves each push | account deletion applied 2026-10-17; plan engine table not yet. Note: Bloom also holds a `wardrobe_v1` migration (16 Oct) that is in no branch of this repo |

## 3. Can wait for 1.1

- **Floura Club** (RevenueCat, App Store products, the Paid Apps agreement, tax and banking). Recommendation:
  launch free, learn D1/D7/D30 for a month, add the Club in 1.1. The owner decides (ROADMAP "Decisions" 3).
- Pet Talk (needs `OPENAI_API_KEY`; the screen hides itself without one).
- Sign in with Apple / Google and the anonymous first minutes (needs the dev build; Apple only requires Sign in
  with Apple when another social sign-in is offered, so email-only is fine for 1.0).
- Health steps/sleep, widgets, wardrobe, Cozy Run (waits on the rules).

## Owner decisions that touch launch

1. Name: **Floura** or **Luna**? (Trademark check on whichever wins.) Bundle id?
2. Launch free, or with the Club from day one?
3. Where the privacy policy and support page live (a domain you own, GitHub Pages, or a Notion page).
4. Email confirmation on (needs SMTP) or off for 1.0?
