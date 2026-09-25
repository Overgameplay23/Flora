-- Retention Engine v1 foundation:
-- - raw events
-- - daily rollups
-- - pet state cache
-- - weekly summaries
-- - user memories
-- - RPCs for event logging + pet state recompute

create extension if not exists "pgcrypto";

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  task_id uuid,
  category text,
  difficulty integer,
  points integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_user_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  tasks_completed integer not null default 0,
  tasks_created integer not null default 0,
  checkins_completed integer not null default 0,
  points_earned integer not null default 0,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.pet_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mood text not null default 'neutral',
  mood_score integer not null default 50,
  streak_days integer not null default 0,
  risk_score integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_summaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  summary text not null,
  highlights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null,
  content text not null,
  weight integer not null default 1,
  source_week_start date,
  created_at timestamptz not null default now()
);

create unique index if not exists user_memories_user_week_content_key
  on public.user_memories (user_id, source_week_start, content);

create index if not exists user_events_user_occurred_at_idx
  on public.user_events (user_id, occurred_at desc);

create index if not exists user_events_event_type_idx
  on public.user_events (event_type);

create index if not exists daily_user_metrics_user_day_desc_idx
  on public.daily_user_metrics (user_id, day desc);

create index if not exists weekly_summaries_user_week_desc_idx
  on public.weekly_summaries (user_id, week_start desc);

create index if not exists user_memories_user_created_at_desc_idx
  on public.user_memories (user_id, created_at desc);

create index if not exists user_memories_memory_type_idx
  on public.user_memories (memory_type);

alter table public.user_events enable row level security;
alter table public.daily_user_metrics enable row level security;
alter table public.pet_state enable row level security;
alter table public.weekly_summaries enable row level security;
alter table public.user_memories enable row level security;

drop policy if exists user_events_select_own on public.user_events;
drop policy if exists user_events_insert_own on public.user_events;
drop policy if exists daily_user_metrics_select_own on public.daily_user_metrics;
drop policy if exists pet_state_select_own on public.pet_state;
drop policy if exists pet_state_insert_own on public.pet_state;
drop policy if exists pet_state_update_own on public.pet_state;
drop policy if exists weekly_summaries_select_own on public.weekly_summaries;
drop policy if exists user_memories_select_own on public.user_memories;
drop policy if exists user_memories_insert_own on public.user_memories;

create policy user_events_select_own
  on public.user_events
  for select
  using (auth.uid() = user_id);

create policy user_events_insert_own
  on public.user_events
  for insert
  with check (auth.uid() = user_id);

create policy daily_user_metrics_select_own
  on public.daily_user_metrics
  for select
  using (auth.uid() = user_id);

create policy pet_state_select_own
  on public.pet_state
  for select
  using (auth.uid() = user_id);

create policy pet_state_insert_own
  on public.pet_state
  for insert
  with check (auth.uid() = user_id);

create policy pet_state_update_own
  on public.pet_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy weekly_summaries_select_own
  on public.weekly_summaries
  for select
  using (auth.uid() = user_id);

create policy user_memories_select_own
  on public.user_memories
  for select
  using (auth.uid() = user_id);

create policy user_memories_insert_own
  on public.user_memories
  for insert
  with check (auth.uid() = user_id);

drop function if exists public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb);

create or replace function public.log_event_and_rollup(
  p_event_type text,
  p_occurred_at timestamptz default now(),
  p_task_id uuid default null,
  p_category text default null,
  p_difficulty integer default null,
  p_points integer default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_type text := lower(trim(coalesce(p_event_type, '')));
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_day date := (coalesce(p_occurred_at, now()) at time zone 'UTC')::date;
  v_tasks_completed integer := 0;
  v_tasks_created integer := 0;
  v_checkins_completed integer := 0;
  v_points_earned integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if v_event_type = '' then
    raise exception 'event_type is required'
      using errcode = '22023';
  end if;

  if v_event_type = 'task_completed' then
    v_tasks_completed := 1;
    v_points_earned := greatest(coalesce(p_points, 0), 0);
  elsif v_event_type = 'task_created' then
    v_tasks_created := 1;
  elsif v_event_type = 'checkin_submitted' then
    v_checkins_completed := 1;
  end if;

  insert into public.user_events (
    user_id,
    event_type,
    occurred_at,
    task_id,
    category,
    difficulty,
    points,
    meta
  )
  values (
    v_user_id,
    v_event_type,
    v_occurred_at,
    p_task_id,
    p_category,
    p_difficulty,
    p_points,
    coalesce(p_meta, '{}'::jsonb)
  );

  insert into public.daily_user_metrics (
    user_id,
    day,
    tasks_completed,
    tasks_created,
    checkins_completed,
    points_earned,
    last_activity_at,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_day,
    v_tasks_completed,
    v_tasks_created,
    v_checkins_completed,
    v_points_earned,
    v_occurred_at,
    now(),
    now()
  )
  on conflict (user_id, day) do update
  set
    tasks_completed = public.daily_user_metrics.tasks_completed + excluded.tasks_completed,
    tasks_created = public.daily_user_metrics.tasks_created + excluded.tasks_created,
    checkins_completed = public.daily_user_metrics.checkins_completed + excluded.checkins_completed,
    points_earned = public.daily_user_metrics.points_earned + excluded.points_earned,
    last_activity_at = greatest(
      coalesce(public.daily_user_metrics.last_activity_at, excluded.last_activity_at),
      excluded.last_activity_at
    ),
    updated_at = now();
end;
$$;

revoke all on function public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb) from public;
grant execute on function public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb) to authenticated;
grant execute on function public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb) to service_role;

drop function if exists public.recompute_pet_state();

create or replace function public.recompute_pet_state()
returns public.pet_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'UTC')::date;
  v_cursor_day date := (now() at time zone 'UTC')::date;
  v_activity_count integer := 0;
  v_streak integer := 0;
  v_last3 integer := 0;
  v_prev3 integer := 0;
  v_risk integer := 0;
  v_mood_score integer := 0;
  v_mood text := 'neutral';
  v_state public.pet_state;
begin
  if v_user_id is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  while v_streak < 365 loop
    select
      coalesce(dum.tasks_completed, 0) + coalesce(dum.checkins_completed, 0)
    into v_activity_count
    from public.daily_user_metrics dum
    where dum.user_id = v_user_id
      and dum.day = v_cursor_day;

    if coalesce(v_activity_count, 0) <= 0 then
      exit;
    end if;

    v_streak := v_streak + 1;
    v_cursor_day := v_cursor_day - 1;
  end loop;

  select
    coalesce(sum(coalesce(dum.tasks_completed, 0) + coalesce(dum.checkins_completed, 0)), 0)::integer
  into v_last3
  from public.daily_user_metrics dum
  where dum.user_id = v_user_id
    and dum.day between (v_today - 2) and v_today;

  select
    coalesce(sum(coalesce(dum.tasks_completed, 0) + coalesce(dum.checkins_completed, 0)), 0)::integer
  into v_prev3
  from public.daily_user_metrics dum
  where dum.user_id = v_user_id
    and dum.day between (v_today - 5) and (v_today - 3);

  if v_streak = 0 then
    v_risk := v_risk + 35;
  end if;

  if v_last3 = 0 then
    v_risk := v_risk + 40;
  end if;

  if v_last3 < v_prev3 then
    v_risk := v_risk + 15;
  end if;

  v_risk := greatest(0, least(100, v_risk));
  v_mood_score := greatest(0, least(100, floor(60 + (2 * v_streak) - (v_risk::numeric / 2.0))::integer));

  if v_mood_score >= 80 then
    v_mood := 'energized';
  elsif v_mood_score >= 60 then
    v_mood := 'proud';
  elsif v_mood_score >= 40 then
    v_mood := 'neutral';
  elsif v_mood_score >= 20 then
    v_mood := 'concerned';
  else
    v_mood := 'sad';
  end if;

  insert into public.pet_state (
    user_id,
    mood,
    mood_score,
    streak_days,
    risk_score,
    updated_at,
    created_at
  )
  values (
    v_user_id,
    v_mood,
    v_mood_score,
    v_streak,
    v_risk,
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    mood = excluded.mood,
    mood_score = excluded.mood_score,
    streak_days = excluded.streak_days,
    risk_score = excluded.risk_score,
    updated_at = now()
  returning *
  into v_state;

  return v_state;
end;
$$;

revoke all on function public.recompute_pet_state() from public;
grant execute on function public.recompute_pet_state() to authenticated;
grant execute on function public.recompute_pet_state() to service_role;
