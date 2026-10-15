-- Plan Engine v1 (tasks map, section 5d): forward migration for later. NOT APPLIED YET.
--
-- This file is deliberately not in local-backend/build-migrations.js and has no generated copy under
-- local-backend/supabase/migrations. The client works without it: src/services/planStore.ts keeps the
-- focus areas on the device and maps tasks rows to catalog ids by title (catalogIdForTitle). Apply it only
-- when the client starts writing these columns: add it to PLAN in build-migrations.js, regenerate, and run
-- the pgTAP suite (04_cycle_stays_on_device must still pass; nothing below is named for cycle data).
--
-- Rules it keeps (docs/dev-notes.md, 2026-09-27 backend hardening):
--   * owner-scoped policies for the authenticated role only, mirroring rls_owner_policies.sql;
--   * anon gets nothing; TRUNCATE, REFERENCES and TRIGGER are never granted to the app;
--   * no new RPC (any later one needs an explicit `grant execute ... to authenticated`).
-- Idempotent.

-- ---------- tasks: which catalog entry a row came from ----------
-- Never delete plan rows: task_completions.task_id cascades on delete and the garden balance is the
-- lifetime sum of completion points. Rotation only ever deactivates.
alter table public.tasks add column if not exists catalog_id text;
alter table public.tasks add column if not exists source text not null default 'custom';

alter table public.tasks drop constraint if exists tasks_source_check;
alter table public.tasks
  add constraint tasks_source_check check (source in ('seed', 'plan', 'custom', 'play'));

-- one row per catalog entry per person; rows the person wrote themselves keep catalog_id null
create unique index if not exists tasks_user_catalog_key
  on public.tasks (user_id, catalog_id)
  where catalog_id is not null;

-- Backfilling catalog_id is left to the client: it already maps titles (including the three seed titles
-- and "Play with <name>") and picks the oldest row when a title appears twice, which this index requires.

-- ---------- user_plans: what the person asked for help with ----------
-- The rhythm-care area never leaves the device (the cycle tracker is on-device only), so it is not an
-- allowed value here; the client strips it before syncing. Adding a new area means extending this list.
create table if not exists public.user_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  focus_areas text[] not null default '{}',
  daily_count smallint not null default 4 check (daily_count between 3 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_plans_focus_areas_max check (cardinality(focus_areas) <= 3),
  constraint user_plans_focus_areas_known check (
    focus_areas <@ array[
      'calm_mind', 'burnout', 'get_going', 'sleep', 'body_basics',
      'self_kindness', 'low_mood', 'connection', 'space_admin'
    ]::text[]
  )
);

drop trigger if exists user_plans_set_updated_at on public.user_plans;
create trigger user_plans_set_updated_at
before update on public.user_plans
for each row execute function public.set_updated_at();

-- ---------- RLS: owner CRUD, as rls_owner_policies.sql does for tables the app writes itself ----------
alter table public.user_plans enable row level security;

drop policy if exists user_plans_select_own on public.user_plans;
create policy user_plans_select_own on public.user_plans
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists user_plans_insert_own on public.user_plans;
create policy user_plans_insert_own on public.user_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists user_plans_update_own on public.user_plans;
create policy user_plans_update_own on public.user_plans
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists user_plans_delete_own on public.user_plans;
create policy user_plans_delete_own on public.user_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- privileges match the policies (a missing policy and a missing grant both deny) ----------
revoke all on table public.user_plans from anon;
grant select, insert, update, delete on table public.user_plans to authenticated;
revoke truncate, references, trigger on table public.user_plans from authenticated;
