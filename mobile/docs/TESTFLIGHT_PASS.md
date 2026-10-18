# Luna: the first TestFlight pass

A script for the first real-phone run of a TestFlight build (`docs/LAUNCH.md` item 12). Everything below has been
checked on web against the local backend; this pass is for what only a phone can prove: permission prompts,
notifications, haptics, sound, the camera, the keyboard, safe areas, speed, going to the background and coming back,
and the hosted backend (Bloom) instead of the laptop. About 45 minutes, plus the reminders overnight (section 5) and one day away from the app (5.4). Do section 6 last.

**Before you start**
- Sign-up email must reach you first: LAUNCH item 10 and both Bloom email templates (item 9). Supabase's built-in
  mailer sends only to your Supabase team's addresses, at most 2 emails an hour, and this pass sends up to four (two
  sign-ups, perhaps a "Send a new code", and the password reset in 6.1). Turning "Confirm email" off covers the
  sign-ups but not 6.1: for that, give the throwaway account an address in your Supabase team, or set up SMTP.
- Install the build from TestFlight on an iPhone (ideally a smaller one too, e.g. an SE or a mini, for layout).
- Have 1-3 photos of a real dog or cat in the photo library.
- Use a fresh email for the main test account, and a second throwaway one for section 6.
- If anything breaks, the crash screen says "Something went sideways". Tap **Try again** (don't close the app: the
  log lives only while it runs), then go to Profile, tap "Luna 1.0.0" at the bottom five times, tap **Copy logs**,
  then **Copy** in the share sheet. Paste it into TestFlight's feedback (below) or your bug note. Diagnostics lives in
  Profile, so if it happens during onboarding, finish or skip onboarding first, without closing the app. If the app
  closes by itself, reopen it and accept TestFlight's offer to send the crash.

Mark each line ✅ / ❌ and note the phone model, iOS version and the TestFlight build number (TestFlight › Luna) at
the top of your notes.

## 1. First run (10 min)

| # | Do | Expect |
|---|---|---|
| 1.1 | Open the app for the first time | Dusk splash with the dog and the moon, then the sign-in screen. No white flash, nothing under the notch or the home bar |
| 1.2 | Create an account with the fresh email | If email confirmation is on: "Check your email" opens with a code box; "Your Luna code" arrives (check spam); typing the code lands in onboarding. A wrong code says so kindly, and "Send a new code" works. If confirmation is off: straight into onboarding |
| 1.3 | Welcome → dog or cat → **add photos** | iOS asks for photo access with Luna's own words ("Luna uses the photos you pick to paint your pet."). Picking 1-3 photos works |
| 1.4 | Try the camera option if offered | iOS asks for the camera with Luna's wording; taking a photo works |
| 1.5 | Name the pet, go through the quiz | Every step fits on the screen with the keyboard up; the name field is not hidden by the keyboard; chips respond at once |
| 1.6 | Watch the painting | With the Gemini key live: the drawn pet stands in, then the painting appears (up to a minute). Without it: the drawn pet stays, nothing is stuck on "painting" forever, and the Pet tab later says "Painting isn't switched on yet. Your photo is safe, so try again later." (never a technical message) |
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
| 2.8b | Airplane Mode on: write a journal entry and delete an older one; Airplane Mode off; reopen Journal | The new entry appears once, the deleted one stays gone, nothing is doubled |
| 2.9 | Breathing | Tap Start; the pet breathes with you; a haptic on each phase; leaving mid-way is fine |
| 2.10 | Pull the app to the background for a minute, come back | Same screen, nothing reloads to blank |
| 2.11 | Turn on Airplane Mode, mark a task done, turn it off | The task is kept and syncs; no error that loses it. If the "Can't reach the network" banner shows, it sits below the notch / Dynamic Island, readable, and Retry can be tapped |
| 2.12 | Force-quit Luna (swipe it away in the app switcher) and reopen | Still signed in; the painted pet shows (or, without the Gemini key, the drawn one), never a blank; Home as you left it |
| 2.13 | Leave Luna in the background for over an hour (e.g. overnight), come back, finish a task | Still signed in, the task saves, no sign-in screen or error |

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
| 4.2b | Pet tab › Share a card › Share the card | The card shows the real photo and the painting (or the drawing, before the painting exists); the share sheet opens with the image; posting to Instagram Stories or TikTok works and looks like the preview. **Save Image**: the card lands in Photos and the app stays open (iOS asks first, with "Luna saves a share card to your photos when you choose Save Image.", only if Photos access is None or Add Photos Only) |
| 4.2c | Profile › Change pet photo, pick a new photo | The painting wait, then <name> with the new photo on the meet screen and Done. Without the Gemini key: the photo is kept and the Pet tab says "Painting isn't switched on yet" (no technical message). Sharing the new painting is from Pet tab › Share a card (4.2b) |
| 4.3 | Profile › Our week, Scrapbook, This month, Journeys, Keepsakes | Each opens; a new account shows kind empty states, never errors |
| 4.4 | Journeys: start one, do today's step | The step shows on Home too |
| 4.5 | Cycle tracking: turn on, log a day | "Stays on this device" is clear; the Home card appears. Turn it off again if you like |
| 4.6 | Profile › Privacy | The policy reads well and scrolls |
| 4.6b | Profile › Help & support | The answers read well and scroll; "Write to us" shows only once a contact email is set |
| 4.7 | Rotate the phone | The app stays in portrait |
| 4.8 | Settings › Accessibility › Larger Text, bigger size | Text grows and nothing important is cut off on Home, Cozy Run and sign-in |
| 4.9 | VoiceOver on Home for a minute (triple-click the side button if set up) | The chips, care cards and buttons read sensible labels |
| 4.10 | iPhone Settings › Apps › Luna › Photos (on iOS 17 and earlier: Settings › Luna › Photos): None. Back in Luna: Profile › Change pet photo › choose from the library | "Luna can't see your photos" with **Open Settings**, which opens Luna's page in Settings. Set Photos to Full Access: iOS restarts Luna when this changes (not a crash), so go back to Profile › Change pet photo, where picking works again |
| 4.11 | Profile › tap "Luna 1.0.0" five times | Diagnostics opens; Copy logs opens the share sheet |

## 5. Reminders (set up now, check tomorrow)

| # | Do | Expect |
|---|---|---|
| 5.1 | Profile › Reminders: turn on Morning hello at the earliest time, Evening check-in at the latest | Saved |
| 5.2 | Wait for the evening one (don't move the phone's clock: Luna counts days from it) | A notification in the pet's voice; tapping it opens the check-in |
| 5.3 | Next morning | The morning hello arrives; tapping opens the app |
| 5.4 | After 5.3, don't open Luna for one whole day; open it the day after | A small welcome-back sheet over Home, in the pet's voice, with how the Cozy Run fared; "Let's start small" closes it, "See the Cozy Run" opens it; opening again the same day doesn't show it twice |

## 6. Account (5 min, use the throwaway account; do this last, after 5.4)

Signing out, the memorial and deleting an account all clear the reminders on this phone, so finish section 5 first.

| # | Do | Expect |
|---|---|---|
| 6.0 | Sign out, sign up with the throwaway email, and go through onboarding quickly (draw the pet in the look editor rather than adopting one, so 6.0b's row shows) | Lands on Home; with confirmation on, the code email arrives |
| 6.0b | On the throwaway account: Profile › If <pet> has passed away › Remember <pet>; then "This was a mistake" › Bring it back | A quiet tone, no cheering, daily tasks pause; bringing it back restores the normal app |
| 6.1 | Sign out; on sign-in tap "Forgot your password?" | A code arrives by email (with Bloom's template updated: the email shows a 6-digit code, not only a link) |
| 6.2 | Enter the code and a new password | "Password changed", signed in; the old password no longer works |
| 6.3 | Profile › Delete account, type "delete", confirm | "Your account is deleted", back on sign-in; signing in with that email fails |
| 6.4 | Sign in with the main account again; Profile › Reminders: turn them back on | Everything from sections 1-5 is still there |

## Afterwards

- Note anything slow (anything over a second after a tap), anything that looked wrong at the notch or the home bar,
  and any copy that felt off.
- Testers send everything through TestFlight: take a screenshot and tap Share Beta Feedback, or TestFlight › Luna ›
  Send Beta Feedback (it records the build and the phone). Paste the Diagnostics log there when there is one. Your
  own notes go to Claude with the same paste.
- The main test account can stay as the App Review demo account if it is in good shape (LAUNCH, "App Review: demo
  account and notes").
