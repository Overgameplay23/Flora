# Floura roadmap

Owner's goal (2026-10-15): the best self-care app in the category, by miles. A comfort / self-help app where the
user's **real pet**, painted from their photos, is the heart of everything. This file is the working plan; the
north star is still `docs/product-strategy/PRODUCT_STRATEGY.md`. Conflicts between the two are logged in
`docs/dev-notes.md` for Donovan to decide. Research behind this plan (Finch teardown, Flo/streak research,
personalization and monetization benchmarks, visual direction) was done on 2026-10-15; the key numbers are quoted
where they drive a decision.

## Why we win against Finch
Finch is huge (4.9★ from ~764K ratings, ~$2M/month on US iOS) but its reviews repeat the same complaints, and each
one is something a real-pet app can beat:

| Finch weakness (from reviews) | Floura's answer |
|---|---|
| The bird isn't *yours* | Your actual dog or cat, painted from 1-3 photos |
| Childish art and copy, cluttered home | Storybook-painterly world, warm adult voice, one hero (the pet) and 3-5 tasks |
| Repetitive; turns into a reward checklist | A plan that adapts daily (battery check, focus areas, history), journeys that evolve, games with your pet |
| Slow adventures; the pet leaves you | Your pet never leaves; every tap gets a reaction within 300 ms |
| Paywall creep, random event rewards, billing traps | No gacha, fixed prices, free try-on on your own pet, one clear trial with a reminder |
| Streak anxiety | Days Together never resets; a forgiving Cozy Run with automatic Nap Days |
| Shallow insights | Mood x energy x cycle x tasks, told by the pet; private cycle tracking Finch doesn't have |

## Done (2026-10-15)
- **New Home**: painted sanctuary hero that follows the time of day, the pet large and talking, Days Together and
  Sprouts chips, a one-tap battery check, "Today's care" from the plan engine as colour-coded cards, "More with
  {pet}" (play, breathe, write, check in, rhythm, garden), the week, a floating celebration toast, haptics.
- **Design system**: `src/theme/tokens.ts` (sky per time of day, warm paper surfaces, 9 care-category colours with
  checked contrast, Fraunces + Nunito type, springs). See `docs/design-system.md`.
- **Plan engine v1**: 10 focus areas, a 45-60 task catalog, a daily picker that adapts to energy, time of day,
  history, memorial and cycle phase (`src/domain/plan`). Focus picker sheet on Home until onboarding exists.
- **Pet as mascot**: `PetMascot` and `SpeechBubble` components; the tab icon shows the pet's face.
- **Pet portrait v3 client fixes** (timeout, opaque-portrait guard, memorial portrait). The function still has to
  be **deployed to Bloom with a `GEMINI_API_KEY`** (owner's action).

- **Every screen on the design system** (same day): Garden, Pet, Profile, Check-in, Journal, Our week, Cycle,
  Reminders, Memorial, Play + game chrome, All tasks, Habits, sign-in, splash; day/night paper app-wide, themed
  headers and status bar, a shared kit (`src/components/common`), the pet in empty/loading states and sheets, and
  breathing rebuilt once (4-2-6, the pet breathes with you, a haptic per phase). Onboarding, Talk, plant store and
  the painting screens are still dark slate. Web previews of every screen: `?preview=<screen>`.

- **2026-10-16:** the SDK 57 upgrade, the home redesign and the sign-up fix are merged on `main` (review fixes in
  `docs/dev-notes.md`). **Onboarding v2** is built (item 3 below): pet first, the painting in the background, a
  four-question quiz (five with rhythm) that sets up the plan engine and the care preferences, the reveal with
  the plan, the morning reminder with a time, one small thing. Still waiting on the owner: anonymous sign-in
  (Bloom setting) so the account comes after the first minutes, Apple/Google sign-in (app identity + dev build),
  the soft paywall (Club decision).
- **2026-10-16, later:** **Journeys v1** (item 8): ten seven-day arcs, one per focus area, paced one step a day with
  no penalties; today's step on Home, a Journeys list and detail. Rewards for finishing and sequels are next.
- **2026-10-16, later still:** "Add your own" care tasks on Home (Finch's custom goals); **Days Together
  milestones** (1 to 365 days, one moment each, kept as **Keepsakes** with the journeys walked and the day the pet
  moved in: Profile › Keepsakes); the pet's lines on Home follow the **voice** chosen in onboarding.
- **2026-10-16, evening:** Play (item 6, part): **Pet the pet**, a calm one-minute game, and the first game of the
  day earns Sprouts on its own (the play task is made the first time). Treat Catch and Memory Match are next.
- **2026-10-16, night:** journey **chapters** (a finished journey keeps the days it was walked and shows them) and
  **sequels** (part two for sleep, calm and burnout, offered once part one is walked); **Treat Catch** (item 6):
  slide the pet under falling treats, golden ones count triple, nothing to lose.

## Next, in order

### 1. The pet everywhere (1-2 sessions)
- Deploy `pet-stylize` + key; verify a real painting end to end on the phone.
- Portrait anchors: the function returns the head / eye-line / neck boxes of the painting (alpha-mask analysis plus a
  cheap Gemini text call), stored with the alpha flags in `pet.portrait_meta`. Unlocks outfits, emotes at the head,
  and a proper face crop everywhere.
- Reskin every screen to the new design system with the pet in empty states, loading, check-in, journal, breathing,
  games, memorial (today they are dark slate).
- Breathing, rebuilt once: the pet breathes with you (4-2-6), haptics on each phase, patterns, logged as care.
- Focus timer task kind: "body-double with {pet}" (pet sits with you for 5/10/25 min).

### 2. Cozy Run (streaks without shame) (1 session, needs owner's yes on the rules)
- **Days Together** (lifetime, never resets) stays the headline.
- **Cozy Run**: any care action counts; the day ends at 3 a.m.; 2 automatic Nap Days per week; Warm Blankets earned
  1 per 7 days (max 3), never sold; logged period days covered; Cozy Pause 1-30 days; a run that runs out of
  protection becomes a scrapbook chapter, never "broken"; mend it with 3 show-up days within 5.
- Milestones on Days Together (1-7 daily in week one, 14, 30, 50, 100, 365, pet birthday) give room items, outfits,
  scrapbook pages. Evidence: built-in slack beats rigid goals (Sharif & Shu); broken streaks demotivate
  (Silverman & Barasch 2023).

### 3. Onboarding v2 (2 sessions)
Pet first, quiz second (Finch's critics wanted to meet the pet before the survey), and the painting really happens
while the quiz runs, so the "building your plan" wait is honest.
1. Welcome → dog/cat → 1-3 photos → name → **painting starts in the background**
2. Quiz, 9 screens: what's felt heaviest (pick up to 3 of 10 areas), where to start, usual battery, how much on a
   hard day (1/5/15 min), what gets in the way, what helps, when days wobble, how {pet} should talk to you, cycle
   opt-in
3. Reveal: the painted pet in its sanctuary + "your plan" with "because you said..." chips
4. Reminder time + notifications → soft paywall (skippable) → save {pet} (Apple/Google/email, linking an anonymous
   account)
- Prerequisites: an explicit `onboarding_completed` flag (the gate currently flips on `pet_photo_url` and skips
  steps), anonymous auth first, in-app account deletion (Apple requirement).

### 4. Wardrobe: outfits and try-on (2 sessions)
- Free try-on of every item **on your own painted pet** (overlay layers placed by the portrait anchors; no image
  generation per try-on). This is the moat: no competitor can show *your* dog in the raincoat.
- Items cost Sprouts (earned only through care) or real money for themed sets ($0.99-$2.99); seasonal drops
  return every year and the app says so; owned items never expire. **No loot boxes** (loot-box spending correlates
  with problem gambling, r = 0.27; the audience is anxious and burnt out).
- Optional "photo shoot": a Gemini repaint of the pet wearing a purchased outfit (Club perk, limited per month).
- Server: `cosmetic_catalog`, `user_cosmetics`, `pet_outfit`, `sprout_ledger`, `buy_cosmetic` / `equip_outfit` RPCs.

### 5. Floura Club (subscription) (1-2 sessions + store setup)
- Needs an app identity (name, bundle id), `eas.json`, a development build, RevenueCat (`react-native-purchases`),
  App Store Connect products. Expo Go can show the paywall UI but cannot buy.
- Free forever: the painted pet, daily care, battery check, Days Together and Cozy Run protection, hibernation,
  fetch + one more game, journal, basic cycle logging, the first 7-day journey, Sprouts and earnable items, try-on.
- Club ($9.99/mo, $59.99/yr list, intro $39.99 first year, 7-day trial with a reminder 2 days before): all journeys,
  multi-pet, repaints and new poses, seasonal rooms, patterns view, scrapbook video export, widget styles, a monthly
  Sprouts stipend + exclusive outfit. Category medians (RevenueCat 2026): trial-to-paid 37.7%, monthly $9.99,
  yearly ~$39.94.
- Paywall moments: end of onboarding (soft), after the 3rd check-in, in context (locked journey, 2nd pet, seasonal
  room). Never on a Drained / On edge day, during low mood, period pain or a return from hibernation.

### 6. Play (games with your pet) (1-2 sessions)
- A Play tab: Fetch (polished), Bubble pop, **Treat Catch**, **Pet the Pet** (calm, haptic, breathing-paced),
  **Memory Match** (your pet's moods and outfits), later Hide-and-Seek among your plants.
- First game of the day earns Sprouts without needing a task; scores sync to the server.

### 7. Rhythm (cycle care, "like Flo" but private) (2 sessions)
- "It started / It ended" in one tap next to the battery check; flow and up to 6 optional body chips.
- Predictions only as ranges, and only after 2+ cycles; never "X days late"; "Just care, no predictions" mode.
- Data encrypted on the device (key in SecureStore), Face ID lock, one-tap erase, no analytics SDKs near it.
- The pet and plan follow the person's *own* learned pattern ("these days felt heavier the last two months, keep
  today light?"), never "it's your hormones". No fertility, ovulation or pregnancy features (strategy + regulation:
  contraception software is a Class II device).

### 8. Retention and depth (ongoing)
- Journeys: 7-day arcs per focus area, then sequels (unlock a room item and a scrapbook page).
- Sunday scrapbook told by {pet}; shareable card of the real pet next to the painting (the TikTok loop).
- Apple Health / Health Connect: steps and sleep complete tasks on their own (dev build).
- Home-screen and lock-screen widgets with the live pet (dev build).
- Monthly recap; insights (mood x energy x cycle x tasks); exportable PDF for a therapist.

## Decisions waiting on Donovan
1. Cozy Run rules and dropping "Never a streak" from onboarding copy.
2. Tabs. Proposal: **Today · Garden · Play · Wardrobe · You** (Rhythm and Journal inside You and on Home).
3. Paywall: soft offer at the end of onboarding in addition to the 3rd check-in? Price test ($6.99/$44.99 vs
   $9.99/$59.99)?
4. Battery check vs 1-5 check-in: merge or keep both?
5. App name everywhere: Floura (app.json still says "Luna").
6. Cycle-care tasks: synced with neutral titles (current) or local-only?
