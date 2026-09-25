-- Retention Engine v1 sanity checks
-- Replace <USER_ID> with a real auth.users.id for service-role level checks.

-- 1) Validate tables + RPCs exist.
select to_regclass('public.user_events') as user_events_table;
select to_regclass('public.daily_user_metrics') as daily_user_metrics_table;
select to_regclass('public.pet_state') as pet_state_table;
select to_regclass('public.weekly_summaries') as weekly_summaries_table;
select to_regclass('public.user_memories') as user_memories_table;

select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('log_event_and_rollup', 'recompute_pet_state')
order by proname;

-- 2) Service-role visibility check for one user (replace <USER_ID>).
select *
from public.daily_user_metrics
where user_id = '<USER_ID>'
order by day desc
limit 7;

select *
from public.pet_state
where user_id = '<USER_ID>';

-- 3) Rollup correctness (requires authenticated context in app/JS client):
-- await supabase.rpc("log_event_and_rollup", { p_event_type: "task_completed", p_points: 3 });
-- await supabase.rpc("log_event_and_rollup", { p_event_type: "checkin_submitted" });
-- Then expect for UTC today:
-- tasks_completed += 1, checkins_completed += 1, points_earned += 3.

-- 4) Pet state recompute (requires authenticated context in app/JS client):
-- const { data } = await supabase.rpc("recompute_pet_state");
-- Expect a single row with mood, mood_score, streak_days, risk_score.

-- 5) Weekly summary output check (service role SQL):
select user_id, week_start, left(summary, 120) as summary_preview, highlights
from public.weekly_summaries
where user_id = '<USER_ID>'
order by week_start desc
limit 3;

select user_id, memory_type, content, source_week_start, created_at
from public.user_memories
where user_id = '<USER_ID>'
order by created_at desc
limit 10;
