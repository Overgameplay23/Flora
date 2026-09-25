# Daily Loop v1

## Tables
- `checkins`: `id`, `user_id`, `date` (YYYY-MM-DD), `mood_score` (1–5), `win_text`, `created_at`. Unique on (`user_id`,`date`).
- `habits`: per-user list (seeded defaults), `active`, `sort_order`.
- `habit_completions`: `user_id`, `habit_id`, `date`, `completed`.
- `user_stats`: `user_id` PK, `streak`, `last_completed_date`, `pet_mood_state`.
- `garden_items`: static catalog; `garden_unlocks`: `user_id`, `item_id`, `streak_at_unlock`, `unlocked_at`.
- RLS: all user-owned tables locked to `auth.uid() = user_id`; `garden_items` readable by all.

## Loop logic
1) **Day complete** when a check-in exists for today **and** at least 2 habits are completed.
2) **Streak**:
   - If day complete and previous complete date is yesterday → `streak + 1`.
   - If day complete and not consecutive → `streak = 1`.
   - If a prior complete date is older than yesterday and today not complete → streak resets to 0.
3) **Pet mood** derives from mood + habit completion rate:
   - `happy` if mood ≥ 4 or completion ≥ 75%
   - `sad` if mood ≤ 2 and completion < 35%
   - otherwise `neutral`
   Stored in `user_stats.pet_mood_state` for app-wide reads.
4) **Garden unlocks**: every 3 streak days unlocks the next item from `garden_items` (ordered by tier/id) into `garden_unlocks`.

## Screens
- **Daily Check-In** (`CheckIn`): mood slider 1–5 + “One win today”. Saves to `checkins`, recomputes streak/mood/unlocks.
- **Habits Today** (`Habits`): toggles daily habit completions, re-syncs streak/mood/unlocks.
- **Garden Progress** (`Garden` tab): shows unlocked items list and streak.

## Testing (manual)
1) Run the app (ensure Supabase env + RLS, and run `supabase/schema_daily_loop_v1.sql`).
2) From Home → Check-in: submit mood + win. Should save and return.
3) Home → Habits: toggle at least 2 habits complete. Streak should increment and pet mood update (happy if mood high or completion high).
4) Home/Garden tab: see unlocked items list; every 3 completed days adds the next item.
5) Verify Supabase rows:
   - `select * from checkins where user_id = '<user>' and date = current_date;`
   - `select streak, pet_mood_state from user_stats where user_id = '<user>';`
   - `select * from garden_unlocks where user_id = '<user>';`.
