create extension if not exists "pgcrypto";

create or replace function public.liftiq_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_phase text not null default 'strength',
  training_age text not null default 'beginner',
  training_split text not null default 'full_body',
  unit_system text not null default 'lb',
  preferred_equipment text[] not null default '{}'::text[],
  import_interest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_goal_phase_check check (goal_phase in ('strength', 'hypertrophy', 'comeback', 'consistency')),
  constraint profiles_training_age_check check (training_age in ('beginner', 'intermediate', 'advanced')),
  constraint profiles_training_split_check check (training_split in ('ppl', 'upper_lower', 'full_body', 'bro_split', 'custom')),
  constraint profiles_unit_system_check check (unit_system in ('lb', 'kg'))
);

create table if not exists public.exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  category text not null,
  equipment text not null,
  movement_pattern text,
  primary_muscles text[] not null default '{}'::text[],
  secondary_muscles text[] not null default '{}'::text[],
  is_system boolean not null default false,
  source text not null default 'manual',
  external_source text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_catalog_slug_key unique (slug),
  constraint exercise_catalog_owner_scope_check check (
    (is_system = true and owner_user_id is null) or
    (is_system = false and owner_user_id is not null)
  )
);

create table if not exists public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise_catalog(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal_phase text,
  split_day text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_templates_goal_phase_check check (
    goal_phase is null or goal_phase in ('strength', 'hypertrophy', 'comeback', 'consistency')
  )
);

create table if not exists public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid references public.exercise_catalog(id) on delete set null,
  custom_exercise_name text,
  order_index integer not null,
  target_sets integer not null default 3,
  target_reps_min integer,
  target_reps_max integer,
  rest_seconds integer not null default 90,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_exercises_target_sets_check check (target_sets > 0),
  constraint template_exercises_order_key unique (template_id, order_index),
  constraint template_exercises_reference_check check (
    (exercise_id is not null and custom_exercise_name is null) or
    (exercise_id is null and custom_exercise_name is not null)
  )
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null,
  status text not null default 'active',
  title text,
  goal_phase text,
  source text not null default 'manual',
  external_source text,
  external_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer,
  sync_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_status_check check (status in ('active', 'completed', 'cancelled')),
  constraint workout_sessions_goal_phase_check check (
    goal_phase is null or goal_phase in ('strength', 'hypertrophy', 'comeback', 'consistency')
  ),
  constraint workout_sessions_sync_status_check check (sync_status in ('pending', 'synced', 'failed'))
);

create table if not exists public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid references public.exercise_catalog(id) on delete set null,
  custom_exercise_name text,
  order_index integer not null,
  last_best_set jsonb not null default '{}'::jsonb,
  next_target jsonb not null default '{}'::jsonb,
  readiness_signal text not null default 'same',
  source text not null default 'manual',
  external_source text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_exercises_order_key unique (session_id, order_index),
  constraint session_exercises_readiness_check check (readiness_signal in ('easier', 'same', 'harder')),
  constraint session_exercises_reference_check check (
    (exercise_id is not null and custom_exercise_name is null) or
    (exercise_id is null and custom_exercise_name is not null)
  )
);

create table if not exists public.set_entries (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  set_number integer not null,
  planned_reps_min integer,
  planned_reps_max integer,
  completed_reps integer not null,
  weight numeric(10,2) not null default 0,
  rest_seconds integer,
  rpe numeric(4,1),
  is_warmup boolean not null default false,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint set_entries_set_number_key unique (session_exercise_id, set_number),
  constraint set_entries_completed_reps_check check (completed_reps >= 0),
  constraint set_entries_weight_check check (weight >= 0),
  constraint set_entries_rpe_check check (rpe is null or (rpe >= 1 and rpe <= 10))
);

create table if not exists public.readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.workout_sessions(id) on delete cascade,
  sleep_quality smallint not null,
  energy_level smallint not null,
  soreness text not null,
  pain_area text,
  pain_level smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint readiness_snapshots_sleep_quality_check check (sleep_quality between 1 and 5),
  constraint readiness_snapshots_energy_level_check check (energy_level between 1 and 5),
  constraint readiness_snapshots_soreness_check check (soreness in ('low', 'medium', 'high')),
  constraint readiness_snapshots_pain_level_check check (pain_level is null or pain_level between 1 and 3)
);

create table if not exists public.session_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.workout_sessions(id) on delete cascade,
  overall_effort smallint,
  session_outcome text,
  cue_that_worked text,
  free_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_notes_overall_effort_check check (overall_effort is null or overall_effort between 1 and 10),
  constraint session_notes_session_outcome_check check (
    session_outcome is null or session_outcome in ('better', 'normal', 'worse')
  )
);

create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercise_catalog(id) on delete cascade,
  session_id uuid references public.workout_sessions(id) on delete set null,
  set_entry_id uuid references public.set_entries(id) on delete set null,
  record_type text not null,
  rep_count integer,
  value numeric(10,2) not null,
  unit text not null default 'lb',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_records_record_type_check check (record_type in ('weight', 'volume', 'estimated_1rm', 'rep_pr'))
);

create table if not exists public.session_recaps (
  session_id uuid primary key references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null,
  actionable_takeaway text not null,
  pr_flags jsonb not null default '[]'::jsonb,
  stalled_lift_flags jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  provider_used text not null default 'deterministic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.workout_sessions(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists exercise_catalog_owner_idx
  on public.exercise_catalog (owner_user_id);

create index if not exists exercise_catalog_category_idx
  on public.exercise_catalog (category);

create unique index if not exists exercise_aliases_exercise_alias_key
  on public.exercise_aliases (exercise_id, lower(alias));

create index if not exists workout_templates_user_created_at_desc_idx
  on public.workout_templates (user_id, created_at desc);

create index if not exists workout_sessions_user_started_at_desc_idx
  on public.workout_sessions (user_id, started_at desc);

create unique index if not exists workout_sessions_external_key
  on public.workout_sessions (user_id, external_source, external_id)
  where external_source is not null and external_id is not null;

create index if not exists session_exercises_session_order_idx
  on public.session_exercises (session_id, order_index);

create unique index if not exists session_exercises_external_key
  on public.session_exercises (session_id, external_source, external_id)
  where external_source is not null and external_id is not null;

create index if not exists set_entries_session_exercise_set_number_idx
  on public.set_entries (session_exercise_id, set_number);

create index if not exists personal_records_user_exercise_created_at_desc_idx
  on public.personal_records (user_id, exercise_id, created_at desc);

create index if not exists analytics_events_user_occurred_at_desc_idx
  on public.analytics_events (user_id, occurred_at desc);

alter table public.profiles enable row level security;
alter table public.exercise_catalog enable row level security;
alter table public.exercise_aliases enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.set_entries enable row level security;
alter table public.readiness_snapshots enable row level security;
alter table public.session_notes enable row level security;
alter table public.personal_records enable row level security;
alter table public.session_recaps enable row level security;
alter table public.analytics_events enable row level security;

create or replace function public.liftiq_can_access_exercise(p_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exercise_catalog ec
    where ec.id = p_exercise_id
      and (ec.is_system = true or ec.owner_user_id = auth.uid())
  );
$$;

create or replace function public.liftiq_is_exercise_owner(p_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exercise_catalog ec
    where ec.id = p_exercise_id
      and ec.owner_user_id = auth.uid()
      and ec.is_system = false
  );
$$;

create or replace function public.liftiq_is_template_owner(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_templates wt
    where wt.id = p_template_id
      and wt.user_id = auth.uid()
  );
$$;

create or replace function public.liftiq_is_session_owner(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_sessions ws
    where ws.id = p_session_id
      and ws.user_id = auth.uid()
  );
$$;

create or replace function public.liftiq_is_session_exercise_owner(p_session_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    where se.id = p_session_exercise_id
      and ws.user_id = auth.uid()
  );
$$;

revoke all on function public.liftiq_can_access_exercise(uuid) from public;
revoke all on function public.liftiq_is_exercise_owner(uuid) from public;
revoke all on function public.liftiq_is_template_owner(uuid) from public;
revoke all on function public.liftiq_is_session_owner(uuid) from public;
revoke all on function public.liftiq_is_session_exercise_owner(uuid) from public;
grant execute on function public.liftiq_can_access_exercise(uuid) to authenticated, service_role;
grant execute on function public.liftiq_is_exercise_owner(uuid) to authenticated, service_role;
grant execute on function public.liftiq_is_template_owner(uuid) to authenticated, service_role;
grant execute on function public.liftiq_is_session_owner(uuid) to authenticated, service_role;
grant execute on function public.liftiq_is_session_exercise_owner(uuid) to authenticated, service_role;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = user_id);
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = user_id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy profiles_delete_own on public.profiles
  for delete using (auth.uid() = user_id);

drop policy if exists exercise_catalog_select_accessible on public.exercise_catalog;
drop policy if exists exercise_catalog_insert_own on public.exercise_catalog;
drop policy if exists exercise_catalog_update_own on public.exercise_catalog;
drop policy if exists exercise_catalog_delete_own on public.exercise_catalog;
create policy exercise_catalog_select_accessible on public.exercise_catalog
  for select using (is_system = true or owner_user_id = auth.uid());
create policy exercise_catalog_insert_own on public.exercise_catalog
  for insert with check (owner_user_id = auth.uid() and is_system = false);
create policy exercise_catalog_update_own on public.exercise_catalog
  for update using (owner_user_id = auth.uid() and is_system = false)
  with check (owner_user_id = auth.uid() and is_system = false);
create policy exercise_catalog_delete_own on public.exercise_catalog
  for delete using (owner_user_id = auth.uid() and is_system = false);

drop policy if exists exercise_aliases_select_accessible on public.exercise_aliases;
drop policy if exists exercise_aliases_insert_own on public.exercise_aliases;
drop policy if exists exercise_aliases_update_own on public.exercise_aliases;
drop policy if exists exercise_aliases_delete_own on public.exercise_aliases;
create policy exercise_aliases_select_accessible on public.exercise_aliases
  for select using (public.liftiq_can_access_exercise(exercise_id));
create policy exercise_aliases_insert_own on public.exercise_aliases
  for insert with check (public.liftiq_is_exercise_owner(exercise_id));
create policy exercise_aliases_update_own on public.exercise_aliases
  for update using (public.liftiq_is_exercise_owner(exercise_id))
  with check (public.liftiq_is_exercise_owner(exercise_id));
create policy exercise_aliases_delete_own on public.exercise_aliases
  for delete using (public.liftiq_is_exercise_owner(exercise_id));

drop policy if exists workout_templates_select_own on public.workout_templates;
drop policy if exists workout_templates_insert_own on public.workout_templates;
drop policy if exists workout_templates_update_own on public.workout_templates;
drop policy if exists workout_templates_delete_own on public.workout_templates;
create policy workout_templates_select_own on public.workout_templates
  for select using (auth.uid() = user_id);
create policy workout_templates_insert_own on public.workout_templates
  for insert with check (auth.uid() = user_id);
create policy workout_templates_update_own on public.workout_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy workout_templates_delete_own on public.workout_templates
  for delete using (auth.uid() = user_id);

drop policy if exists template_exercises_select_own on public.template_exercises;
drop policy if exists template_exercises_insert_own on public.template_exercises;
drop policy if exists template_exercises_update_own on public.template_exercises;
drop policy if exists template_exercises_delete_own on public.template_exercises;
create policy template_exercises_select_own on public.template_exercises
  for select using (public.liftiq_is_template_owner(template_id));
create policy template_exercises_insert_own on public.template_exercises
  for insert with check (public.liftiq_is_template_owner(template_id));
create policy template_exercises_update_own on public.template_exercises
  for update using (public.liftiq_is_template_owner(template_id))
  with check (public.liftiq_is_template_owner(template_id));
create policy template_exercises_delete_own on public.template_exercises
  for delete using (public.liftiq_is_template_owner(template_id));

drop policy if exists workout_sessions_select_own on public.workout_sessions;
drop policy if exists workout_sessions_insert_own on public.workout_sessions;
drop policy if exists workout_sessions_update_own on public.workout_sessions;
drop policy if exists workout_sessions_delete_own on public.workout_sessions;
create policy workout_sessions_select_own on public.workout_sessions
  for select using (auth.uid() = user_id);
create policy workout_sessions_insert_own on public.workout_sessions
  for insert with check (auth.uid() = user_id);
create policy workout_sessions_update_own on public.workout_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy workout_sessions_delete_own on public.workout_sessions
  for delete using (auth.uid() = user_id);

drop policy if exists session_exercises_select_own on public.session_exercises;
drop policy if exists session_exercises_insert_own on public.session_exercises;
drop policy if exists session_exercises_update_own on public.session_exercises;
drop policy if exists session_exercises_delete_own on public.session_exercises;
create policy session_exercises_select_own on public.session_exercises
  for select using (public.liftiq_is_session_owner(session_id));
create policy session_exercises_insert_own on public.session_exercises
  for insert with check (public.liftiq_is_session_owner(session_id));
create policy session_exercises_update_own on public.session_exercises
  for update using (public.liftiq_is_session_owner(session_id))
  with check (public.liftiq_is_session_owner(session_id));
create policy session_exercises_delete_own on public.session_exercises
  for delete using (public.liftiq_is_session_owner(session_id));

drop policy if exists set_entries_select_own on public.set_entries;
drop policy if exists set_entries_insert_own on public.set_entries;
drop policy if exists set_entries_update_own on public.set_entries;
drop policy if exists set_entries_delete_own on public.set_entries;
create policy set_entries_select_own on public.set_entries
  for select using (public.liftiq_is_session_exercise_owner(session_exercise_id));
create policy set_entries_insert_own on public.set_entries
  for insert with check (public.liftiq_is_session_exercise_owner(session_exercise_id));
create policy set_entries_update_own on public.set_entries
  for update using (public.liftiq_is_session_exercise_owner(session_exercise_id))
  with check (public.liftiq_is_session_exercise_owner(session_exercise_id));
create policy set_entries_delete_own on public.set_entries
  for delete using (public.liftiq_is_session_exercise_owner(session_exercise_id));

drop policy if exists readiness_snapshots_select_own on public.readiness_snapshots;
drop policy if exists readiness_snapshots_insert_own on public.readiness_snapshots;
drop policy if exists readiness_snapshots_update_own on public.readiness_snapshots;
drop policy if exists readiness_snapshots_delete_own on public.readiness_snapshots;
create policy readiness_snapshots_select_own on public.readiness_snapshots
  for select using (public.liftiq_is_session_owner(session_id));
create policy readiness_snapshots_insert_own on public.readiness_snapshots
  for insert with check (public.liftiq_is_session_owner(session_id));
create policy readiness_snapshots_update_own on public.readiness_snapshots
  for update using (public.liftiq_is_session_owner(session_id))
  with check (public.liftiq_is_session_owner(session_id));
create policy readiness_snapshots_delete_own on public.readiness_snapshots
  for delete using (public.liftiq_is_session_owner(session_id));

drop policy if exists session_notes_select_own on public.session_notes;
drop policy if exists session_notes_insert_own on public.session_notes;
drop policy if exists session_notes_update_own on public.session_notes;
drop policy if exists session_notes_delete_own on public.session_notes;
create policy session_notes_select_own on public.session_notes
  for select using (public.liftiq_is_session_owner(session_id));
create policy session_notes_insert_own on public.session_notes
  for insert with check (public.liftiq_is_session_owner(session_id));
create policy session_notes_update_own on public.session_notes
  for update using (public.liftiq_is_session_owner(session_id))
  with check (public.liftiq_is_session_owner(session_id));
create policy session_notes_delete_own on public.session_notes
  for delete using (public.liftiq_is_session_owner(session_id));

drop policy if exists personal_records_select_own on public.personal_records;
drop policy if exists personal_records_insert_own on public.personal_records;
drop policy if exists personal_records_update_own on public.personal_records;
drop policy if exists personal_records_delete_own on public.personal_records;
create policy personal_records_select_own on public.personal_records
  for select using (auth.uid() = user_id);
create policy personal_records_insert_own on public.personal_records
  for insert with check (auth.uid() = user_id);
create policy personal_records_update_own on public.personal_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy personal_records_delete_own on public.personal_records
  for delete using (auth.uid() = user_id);

drop policy if exists session_recaps_select_own on public.session_recaps;
drop policy if exists session_recaps_insert_own on public.session_recaps;
drop policy if exists session_recaps_update_own on public.session_recaps;
drop policy if exists session_recaps_delete_own on public.session_recaps;
create policy session_recaps_select_own on public.session_recaps
  for select using (auth.uid() = user_id);
create policy session_recaps_insert_own on public.session_recaps
  for insert with check (auth.uid() = user_id);
create policy session_recaps_update_own on public.session_recaps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy session_recaps_delete_own on public.session_recaps
  for delete using (auth.uid() = user_id);

drop policy if exists analytics_events_select_own on public.analytics_events;
drop policy if exists analytics_events_insert_own on public.analytics_events;
drop policy if exists analytics_events_delete_own on public.analytics_events;
create policy analytics_events_select_own on public.analytics_events
  for select using (auth.uid() = user_id);
create policy analytics_events_insert_own on public.analytics_events
  for insert with check (auth.uid() = user_id);
create policy analytics_events_delete_own on public.analytics_events
  for delete using (auth.uid() = user_id);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.liftiq_touch_updated_at();

drop trigger if exists exercise_catalog_touch_updated_at on public.exercise_catalog;
create trigger exercise_catalog_touch_updated_at
  before update on public.exercise_catalog
  for each row execute function public.liftiq_touch_updated_at();

drop trigger if exists workout_templates_touch_updated_at on public.workout_templates;
create trigger workout_templates_touch_updated_at
  before update on public.workout_templates
  for each row execute function public.liftiq_touch_updated_at();

drop trigger if exists template_exercises_touch_updated_at on public.template_exercises;
create trigger template_exercises_touch_updated_at
  before update on public.template_exercises
  for each row execute function public.liftiq_touch_updated_at();

drop trigger if exists workout_sessions_touch_updated_at on public.workout_sessions;
create trigger workout_sessions_touch_updated_at
  before update on public.workout_sessions
  for each row execute function public.liftiq_touch_updated_at();

drop trigger if exists session_exercises_touch_updated_at on public.session_exercises;
create trigger session_exercises_touch_updated_at
  before update on public.session_exercises
  for each row execute function public.liftiq_touch_updated_at();

drop trigger if exists set_entries_touch_updated_at on public.set_entries;
create trigger set_entries_touch_updated_at
  before update on public.set_entries
  for each row execute function public.liftiq_touch_updated_at();

drop trigger if exists readiness_snapshots_touch_updated_at on public.readiness_snapshots;
create trigger readiness_snapshots_touch_updated_at
  before update on public.readiness_snapshots
  for each row execute function public.liftiq_touch_updated_at();

drop trigger if exists session_notes_touch_updated_at on public.session_notes;
create trigger session_notes_touch_updated_at
  before update on public.session_notes
  for each row execute function public.liftiq_touch_updated_at();

drop trigger if exists personal_records_touch_updated_at on public.personal_records;
create trigger personal_records_touch_updated_at
  before update on public.personal_records
  for each row execute function public.liftiq_touch_updated_at();

drop trigger if exists session_recaps_touch_updated_at on public.session_recaps;
create trigger session_recaps_touch_updated_at
  before update on public.session_recaps
  for each row execute function public.liftiq_touch_updated_at();
