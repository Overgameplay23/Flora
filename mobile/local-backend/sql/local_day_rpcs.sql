-- Local-day aware RPCs (restoration change set 6.13, risks R-28 / R-70).
--
-- The three server RPCs that bucket activity by day used the UTC date, while the client's check-ins and
-- habits use the local calendar day. For anyone west of Greenwich a task completed in the evening landed
-- on "tomorrow", the daily total reset in the afternoon and the pet's streak looked broken at night.
--
-- Contract: each RPC gains an optional local-day parameter. The server accepts it only when it is within
-- one day of the UTC date of the event (a phone clock cannot be more than a day away from UTC), otherwise
-- it falls back to UTC exactly as before. Callers that omit the parameter (older clients, the seed) get
-- the old behaviour. Old signatures are dropped so PostgREST has a single candidate per name.
--
-- Bodies are otherwise copied verbatim from
--   2026_02_17_task_completion_atomic.sql (+ the 2026-09-17 #variable_conflict fix),
--   2026_02_22_retention_engine_v1.sql.

create or replace function public.clamp_local_day(p_local_day date, p_at timestamptz)
returns date
language sql
immutable
as $$
  select case
    when p_local_day is not null and abs(p_local_day - (p_at at time zone 'UTC')::date) <= 1 then p_local_day
    else (p_at at time zone 'UTC')::date
  end
$$;

revoke all on function public.clamp_local_day(date, timestamptz) from public;
grant execute on function public.clamp_local_day(date, timestamptz) to authenticated;
grant execute on function public.clamp_local_day(date, timestamptz) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- complete_task(task_id, completed_at, local_date)
-- ---------------------------------------------------------------------------------------------------
drop function if exists public.complete_task(text, timestamptz);

create or replace function public.complete_task(task_id text, completed_at timestamptz default now(), local_date date default null)
returns table (
  inserted boolean,
  points_awarded integer,
  earned_points_today integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_task_id public.tasks.id%type;
  v_task_json jsonb;
  v_points integer := 2;
  v_inserted boolean := false;
  v_completed_at timestamptz := coalesce(complete_task.completed_at, now());
  v_completed_date date := public.clamp_local_day(complete_task.local_date, coalesce(complete_task.completed_at, now()));
begin
  if v_user_id is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  select t.id, to_jsonb(t)
  into v_task_id, v_task_json
  from public.tasks t
  where t.user_id = v_user_id
    and t.id::text = complete_task.task_id
  limit 1;

  if not found then
    raise exception 'Task not found for current user'
      using errcode = 'P0002';
  end if;

  begin
    v_points := coalesce(nullif(trim(v_task_json ->> 'points'), '')::integer, 2);
  exception
    when others then
      v_points := 2;
  end;

  v_points := greatest(1, least(v_points, 100));

  insert into public.task_completions (
    user_id,
    task_id,
    completed_at,
    completed_date,
    points,
    completion_date,
    done
  )
  values (
    v_user_id,
    v_task_id,
    v_completed_at,
    v_completed_date,
    v_points,
    v_completed_date,
    true
  )
  on conflict (user_id, task_id, completed_date) do nothing;

  v_inserted := found;

  if v_inserted then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tasks'
        and column_name = 'completed_at'
    ) then
      execute 'update public.tasks set completed_at = $1 where id = $2 and user_id = $3'
        using v_completed_at, v_task_id, v_user_id;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tasks'
        and column_name = 'status'
    ) then
      execute 'update public.tasks set status = ''completed'' where id = $1 and user_id = $2 and status is distinct from ''completed'''
        using v_task_id, v_user_id;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tasks'
        and column_name = 'done'
    ) then
      execute 'update public.tasks set done = true where id = $1 and user_id = $2'
        using v_task_id, v_user_id;
    end if;
  end if;

  select coalesce(sum(tc.points), 0)::integer
  into earned_points_today
  from public.task_completions tc
  where tc.user_id = v_user_id
    and tc.completed_date = v_completed_date;

  inserted := v_inserted;
  points_awarded := case when v_inserted then v_points else 0 end;
  return next;
end;
$$;

revoke all on function public.complete_task(text, timestamptz, date) from public;
grant execute on function public.complete_task(text, timestamptz, date) to authenticated;
grant execute on function public.complete_task(text, timestamptz, date) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- log_event_and_rollup(..., p_local_day)
-- ---------------------------------------------------------------------------------------------------
drop function if exists public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb);

create or replace function public.log_event_and_rollup(
  p_event_type text,
  p_occurred_at timestamptz default now(),
  p_task_id uuid default null,
  p_category text default null,
  p_difficulty integer default null,
  p_points integer default null,
  p_meta jsonb default '{}'::jsonb,
  p_local_day date default null
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
  v_day date := public.clamp_local_day(p_local_day, coalesce(p_occurred_at, now()));
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

revoke all on function public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb, date) from public;
grant execute on function public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb, date) to authenticated;
grant execute on function public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb, date) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- recompute_pet_state(p_today)
-- ---------------------------------------------------------------------------------------------------
drop function if exists public.recompute_pet_state();

create or replace function public.recompute_pet_state(p_today date default null)
returns public.pet_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := public.clamp_local_day(p_today, now());
  v_cursor_day date := public.clamp_local_day(p_today, now());
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

revoke all on function public.recompute_pet_state(date) from public;
grant execute on function public.recompute_pet_state(date) to authenticated;
grant execute on function public.recompute_pet_state(date) to service_role;
