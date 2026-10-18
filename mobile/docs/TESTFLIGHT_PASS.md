# Luna: the first TestFlight pass

A script for the first real-phone run of a TestFlight build (`docs/LAUNCH.md` item 12). Everything below has been
checked on web against the local backend; this pass is for what only a phone can prove: permission prompts,
notifications, haptics, sound, the camera, the keyboard, safe areas, speed, going to the background and coming back,
and the hosted backend (Bloom) instead of the laptop. About 45 minutes, plus a reminder you wait for overnight.

**Before you start**
- Install the build from TestFlight on an iPhone (ideally a smaller one too, e.g. an SE or a mini, for layout).
- Have 1-3 photos of a real dog or cat in the photo library.
- Use a fresh email for the main test account, and a second throwaway one for the delete test at the end.
- If anything breaks, the crash screen says "Something went sideways". Tap **Try again**, then go to Profile, tap
  the version line at the bottom five times, and tap **Copy** in Diagnostics. Paste that into the bug note.

Mark each line ✅ / ❌ and note the phone model and iOS version at the top of your notes.

## 1. First run (10 min)

| # | Do | Expect |
|---|---|---|
| 1.1 | Open the app for the first time | Dusk splash with the dog and the moon, then the sign-in screen. No white flash, nothing under the notch or the home bar |
| 1.2 | Create an account with the fresh email | If email confirmation is on: a clear "check your email" notice, the email arrives (check spam), the link confirms, signing in works. If it is off: straight into onboarding |
| 1.3 | Welcome → dog or cat → **add photos** | iOS asks for photo access with Luna's own words ("Luna uses the photos you pick to paint your pet."). Picking 1-3 photos works |
| 1.4 | Try the camera option if offered | iOS asks for the camera with Luna's wording; taking a photo works |
| 1.5 | Name the pet, go through the quiz | Every step fits on the screen with the keyboard up; the name field is not hidden by the keyboard; chips respond at once |
| 1.6 | Watch the painting | With the Gemini key live: the drawn pet stands in, then the painting appears (up to a minute). Without it: the drawn pet stays and nothing is stuck on "painting" forever |
| 1.7 | The reveal and the plan | The pet in its garden (dog) or window nook (cat), the plan with "because you said" chips. Once the painting is done (not when the photo was kept or for an adopted companion), a quiet "Share <name>'s card" under Looks good opens the card with the photo and the painting; Back returns to the reveal |
| 1.8 | Reminder step | iOS asks for notification permission only when you tap to turn reminders on, never on its own |
| 1.9 | Finish onboarding | Home: greeting, the pet large, Days Together and Sprouts chips, today's care |

## 2. Home and daily care (10 min)

| # | Do | Expect |
|---|---|---|
| 2.1 | Tap the pet | It reacts within a moment; a light haptic tap |
| 2.2 | Battery check: pick one | Today's care reshapes; nothing scolds on "Drained" |
| 2.3 | Mark a care task done | Check animation, haptic, Sprouts go up, the celebration toast. The **cozy run** chip appears under Days Together (1) |
| 2.4 | Tap the cozy run chip | The Cozy Run screen: 1 day, today marked with a leaf, Nap Days and Warm Blankets, the pause card |
| 2.5 | Start a 3-day pause, then end it | "Paused until …", then back to "Need a break?" |
| 2.6 | Add your own task, then press and hold it | It appears; holding offers to remove it |
| 2.7 | Daily check-in from Home or Profile | The slider and the pet's question; saving works; the keyboard does not cover the note |
| 2.8 | Journal: write a few lines | Saves; reopening shows it |
| 2.9 | Breathing | Tap Start; the pet breathes with you; a haptic on each phase; leaving mid-way is fine |
| 2.10 | Pull the app to the background for a minute, come back | Same screen, nothing reloads to blank |
| 2.11 | Turn on Airplane Mode, mark a task done, turn it off | The task is kept and syncs; no error that loses it |

## 3. Play (5 min)

| # | Do | Expect |
|---|---|---|
| 3.1 | Play › each game once: Fetch, Bubbles, Pet the pet, Treat Catch, Memory Match, with music playing in another app | Each opens full screen and runs smoothly (no stutter). Sounds play with the ringer on and stay quiet with the silent switch on; the music keeps playing underneath |
| 3.2 | The first game of the day | Sprouts for playing; the cozy run counts the day |
| 3.3 | Finish or leave a game | Back to Play; nothing is lost for leaving early |
| 3.4 | With VoiceOver on (Settings › Accessibility › VoiceOver), play each game once | Fetch: double-tap the ball throws (Short / Long throw in the actions rotor). Pet the pet: each double-tap is a stroke, and "warming up… leaning in… nearly melting" is spoken. Treat Catch: swipe up/down moves the pet a third at a time, and each treat is announced ("Left", "Golden, right"). Memory Match: each turned card and each pair is spoken. Every game ends with the result read out |

## 4. The rest of the app (10 min)

| # | Do | Expect |
|---|---|---|
| 4.1 | Garden tab | Plants, planting with Sprouts works |
| 4.2 | Pet tab | The pet, its stats (cozy run, days together, plants) |
| 4.2b | Pet tab › Share a card › Share the card | The card shows the real photo and the painting (or the drawing, before the painting exists); the share sheet opens with the image; posting to Instagram Stories or TikTok, or Save Image, works and looks like the preview |
| 4.3 | Profile › Our week, Scrapbook, This month, Journeys, Keepsakes | Each opens; a new account shows kind empty states, never errors |
| 4.4 | Journeys: start one, do today's step | The step shows on Home too |
| 4.5 | Cycle tracking: turn on, log a day | "Stays on this device" is clear; the Home card appears. Turn it off again if you like |
| 4.6 | Profile › Privacy | The policy reads well and scrolls |
| 4.7 | Rotate the phone | The app stays in portrait |
| 4.8 | Settings › Accessibility › Larger Text, bigger size | Text grows and nothing important is cut off on Home, Cozy Run and sign-in |
| 4.9 | VoiceOver on Home for a minute (triple-click the side button if set up) | The chips, care cards and buttons read sensible labels |

## 5. Reminders (set up now, check tomorrow)

| # | Do | Expect |
|---|---|---|
| 5.1 | Profile › Reminders: turn on Morning hello at the earliest time, Evening check-in at the latest | Saved |
| 5.2 | Wait for the evening one (or set the phone's clock forward in Settings › General › Date & Time, then back) | A notification in the pet's voice; tapping it opens the check-in |
| 5.3 | Next morning | The morning hello arrives; tapping opens the app |

## 6. Account (5 min, use the throwaway account)

| # | Do | Expect |
|---|---|---|
| 6.1 | Sign out; on sign-in tap "Forgot your password?" | A code arrives by email (with Bloom's template updated: the email shows a 6-digit code, not only a link) |
| 6.2 | Enter the code and a new password | "Password changed", signed in; the old password no longer works |
| 6.3 | Profile › Delete account, type "delete", confirm | "Your account is deleted", back on sign-in; signing in with that email fails |

## Afterwards

- Note anything slow (anything over a second after a tap), anything that looked wrong at the notch or the home bar,
  and any copy that felt off.
- Bugs and notes go to Claude with the Diagnostics paste. The main test account can stay as the App Review demo
  account if it is in good shape (LAUNCH, "App Review: demo account and notes").
