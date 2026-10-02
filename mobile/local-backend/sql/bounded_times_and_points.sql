-- R-40: bounded times and points. Applied to Bloom (jhrsfogxxexmzauhtjif) on 2026-10-02 as migration
-- 20261002014412_bounded_times_and_points. Sits on top of the 2026-09-27 migrations (rls_owner_policies,
-- function_grants, pets_bucket_private), which cover R-13/14, R-37, R-38, R-39 and R-41.
-- complete_task: client times older than 48h (or in the future) count as now; 20 paid completions per local day.
-- log_event_and_rollup: same time rule, client points capped at 10, event type and meta size bounded.

-- A client-supplied instant is trusted only if it is recent: the offline queue replays completions
-- with their original time, so allow up to 48 hours back (and a little clock skew forward).
-- Anything else is treated as "now", so old or future dates can't be used to farm extra days.
create or replace function public.clamp_client_instant(p_at timestamptz)
returns timestamptz
language sql
stable
as $$
  select case
    when p_at is not null and p_at between now() - interval '48 hours' and now() + interval '10 minutes' then p_at
    else now()
  end
$$;
revoke execute on function public.clamp_client_instant(timestamptz) from public, anon;
grant execute on function public.clamp_client_instant(timestamptz) to authenticated, service_role;

-- complete_task: body from local_day_rpcs.sql with three changes, marked [hardening]:
--   completed_at is clamped; the local day is derived from the clamped instant; and only the first
--   20 completions of a local day earn points (no one does 20 self-care tasks a day; it stops
--   "make 500 tasks and tick them all" farming without ever touching a normal user).
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
  v_completed_at timestamptz := public.clamp_client_instant(complete_task.completed_at);   -- [hardening]
  v_completed_date date := public.clamp_local_day(complete_task.local_date, public.clamp_client_instant(complete_task.completed_at));
  v_paid_today integer := 0;
  c_daily_paid_limit constant integer := 20;                                                  -- [hardening]
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

  -- [hardening] serialize per user and cap paid completions per local day
  perform pg_advisory_xact_lock(hashtext('complete_task:' || v_user_id::text));
  select count(*)::integer
  into v_paid_today
  from public.task_completions tc
  where tc.user_id = v_user_id
    and tc.completed_date = v_completed_date
    and tc.points > 0;
  if v_paid_today >= c_daily_paid_limit then
    v_points := 0;
  end if;

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

revoke execute on function public.complete_task(text, timestamptz, date) from public, anon;
grant execute on function public.complete_task(text, timestamptz, date) to authenticated, service_role;

-- log_event_and_rollup: body from local_day_rpcs.sql with the event time clamped like above, the
-- event type and meta size bounded, and client-reported points capped at 10 (tasks are worth 2).
-- These numbers only feed the weekly recap and the pet's mood, never the spendable balance.
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
  v_event_type text := left(lower(trim(coalesce(p_event_type, ''))), 64);                       -- [hardening]
  v_occurred_at timestamptz := public.clamp_client_instant(p_occurred_at);                         -- [hardening]
  v_day date := public.clamp_local_day(p_local_day, public.clamp_client_instant(p_occurred_at));   -- [hardening]
  v_points integer := case when p_points is null then null else greatest(0, least(p_points, 10)) end; -- [hardening]
  v_meta jsonb := case when pg_column_size(coalesce(p_meta, '{}'::jsonb)) > 4096 then '{}'::jsonb
                       else coalesce(p_meta, '{}'::jsonb) end;                                     -- [hardening]
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
    v_points_earned := coalesce(v_points, 0);
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
    left(p_category, 64),
    p_difficulty,
    v_points,
    v_meta
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

revoke execute on function public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb, date) from public, anon;
grant execute on function public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb, date) to authenticated, service_role;
