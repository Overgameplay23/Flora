# Floura Product Strategy — Reference for Claude

Source: `Flora_App_Product_Strategy_Research.pdf` (40 pages, added 2026-09-24).
Full text (greppable): `Flora_App_Product_Strategy_Research.txt`.

**How to use this:** This is the product north star — read it to decide *what* to build and *why*.
It is research, not a spec. Where it conflicts with something already built in this repo
(e.g. the `pet-chat` edge function vs. the doc's "no open-ended AI chatbot" guidance),
do NOT rip out existing work — note the conflict in `mobile/docs/dev-notes.md` and leave the call to Donovan.

## One-line positioning
A **Reciprocal Wellness & Routine Sanctuary**: the user cares for themselves by caring for an
illustrated digital twin of their *real* pet. Self-care actions (water, fresh air, breathing, sleep)
nourish the pet and furnish its cozy room. No shame, no broken streaks.

## Beachhead user
Female pet owners 21–28 (US/UK), early career / grad school, dealing with burnout or executive
dysfunction; love cozy aesthetics; use Finch, Flo, Forest; discovered via TikTok/Reels pet content.

## Core loop
Pet creation → single-tap reciprocal check-in → pet reacts + earns "Sprouts" → spend on room decor → anticipation for tomorrow.

## First 3 minutes (onboarding, account creation deferred)
1. Intro: "Bring your best friend to life." → [Create My Pet]
2. Pet setup: name, species (Dog / Cat / Adopt a Companion), breed traits, photo upload → ~4s pencil animation → stylized 2.5D illustration
3. Sanctuary reveal: pet on a rug in a sunlit room, wag/purr + haptics, "Hi [Name]! … What's one small thing we can do for you today?"
4. First action: [Drank a glass of water] | [Stepped outside] | [Took a slow breath]
5. Feedback: pet acts it out, a plant sprouts, "We did it together."
6. Set morning check-in time + notifications; Apple/Google SSO to save progress

## Home screen
- **Top — Sanctuary view:** room reflects local time & weather.
- **Middle — Energy slider:** Exhausted | Anxious | Calm | Energized; pet posture mirrors it.
- **Bottom — Daily care tray (3–5 rituals):** Fresh air (auto via Health steps), Hydration (tap), Quiet reflection (one-sentence prompt), Evening wind-down (sleep schedule).

## MVP — six capabilities
1. Modular/parametric pet generation (photo → layered vector: coat, ears, markings, eyes) + manual tweak step
2. Reciprocal habit engine → Sprouts currency → room furnishings (no streak penalties)
3. Daily reflection prompt from the pet (text or quick audio)
4. Background Apple Health / Google Fit (steps, sleep) auto-completing goals
5. Lock Screen / Home Screen widgets
6. Optional, on-device encrypted "Biological Energy Rhythm" (cycle phase → pet tone/pacing; never clinical)

## Explicitly OUT of v1
- Punitive streaks or pet sickness/decline
- Open-ended AI chatbot (use structured, designed dialogue trees)
- Clinical/diagnostic tools, fertility predictions
- In-app social messaging (outbound image/video export only)
- Vet records / medication tracking

## Retention loops
- **Daily:** widget/notification → slider + 1–2 habits in <30s → pet reacts, Sprouts
- **Weekly:** Sunday "[Pet] put together your weekly scrapbook" recap + room item
- **Monthly:** seasonal room change, pick a wellness focus
- **Long-term:** 90/180/365-day + pet-birthday milestones → new spaces (garden patio), recap videos
- **Graceful Hibernation:** after 5 inactive days, notifications taper to one gentle message
  ("[Pet] is napping peacefully by the window…"). On return: no backlog, "You're back! Let's take today easy."

## Monetization (ad-free)
- "Flora Sanctuary Club": $6.99/mo or $44.99/yr, 7-day trial; paywall shown after 3rd daily check-in
- Perks: all seasonal rooms, multi-pet, rhythm/sleep pattern insights, widget styles
- Cosmetics $0.99–$2.99; community gifting of memberships

## 12-month roadmap
- **Ph1 (M1–3):** iOS, pet illustration system (dog/cat), habit loop + hibernation, Health steps, annual plan. Goal D30 > 10%
- **Ph2 (M4–6):** widgets, seasonal decor store, sleep tracking, one-tap social video export (side-by-side real pet → avatar)
- **Ph3 (M7–9):** Biological Energy Rhythm, weekly scrapbooks w/ voice notes, Rainbow Bridge memorial mode, gifting
- **Ph4 (M10–12):** multi-pet rooms, shared couple spaces, Android

## Success benchmarks
D1 > 38%, D7 > 18%, D30 > 10%, DAU/MAU > 35%, annual trial→paid > 40%.

## Biggest risk
Avatar doesn't look like the user's pet → emotional bond breaks. Mitigate with high-quality parametric
art + a quick customization step after generation.

## Where to look in the full text
Executive summary (top) · Consumer insights · Market trends · Competitive landscape (Finch, Flo, Widgetable…) ·
Real-pet concept & edge cases (incl. pet death / memorial) · Opportunity scoring matrix · Beachhead ·
Product direction & MVP · Retention · Monetization · TikTok growth · Risks · Validation experiments · Roadmap.
