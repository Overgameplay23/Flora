-- Garden upgrade system: catalog + user inventory + secure point spending.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.plant_catalog (
  id text primary key,
  name text not null,
  rarity text not null default 'common',
  max_level integer not null default 5,
  base_cost integer not null default 10,
  cost_multiplier numeric not null default 1.6,
  created_at timestamptz not null default now(),
  constraint plant_catalog_max_level_positive check (max_level >= 1),
  constraint plant_catalog_base_cost_positive check (base_cost >= 1),
  constraint plant_catalog_cost_multiplier_positive check (cost_multiplier >= 1)
);

create table if not exists public.user_plants (
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id text not null references public.plant_catalog(id) on delete restrict,
  level integer not null default 1,
  equipped boolean not null default false,
  purchased_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, plant_id),
  constraint user_plants_level_positive check (level >= 1)
);

-- Tracks point spending server-side so upgrade spending is verifiable and immutable.
create table if not exists public.user_plant_upgrades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id text not null references public.plant_catalog(id) on delete restrict,
  from_level integer not null,
  to_level integer not null,
  cost_paid integer not null,
  created_at timestamptz not null default now(),
  constraint user_plant_upgrades_levels_valid check (from_level >= 0 and to_level >= 1 and to_level = from_level + 1),
  constraint user_plant_upgrades_cost_nonnegative check (cost_paid >= 0)
);

create index if not exists user_plants_user_id_idx on public.user_plants(user_id);
create index if not exists user_plant_upgrades_user_id_idx on public.user_plant_upgrades(user_id, created_at desc);
create index if not exists user_plant_upgrades_plant_id_idx on public.user_plant_upgrades(plant_id);

alter table public.plant_catalog enable row level security;
alter table public.user_plants enable row level security;
alter table public.user_plant_upgrades enable row level security;

drop policy if exists plant_catalog_select_all on public.plant_catalog;
create policy plant_catalog_select_all
  on public.plant_catalog
  for select
  using (true);

drop policy if exists user_plants_select_own on public.user_plants;
drop policy if exists user_plants_insert_own on public.user_plants;
drop policy if exists user_plants_update_own on public.user_plants;
drop policy if exists user_plants_delete_own on public.user_plants;

create policy user_plants_select_own
  on public.user_plants
  for select
  using (auth.uid() = user_id);

create policy user_plants_insert_own
  on public.user_plants
  for insert
  with check (auth.uid() = user_id);

create policy user_plants_update_own
  on public.user_plants
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy user_plants_delete_own
  on public.user_plants
  for delete
  using (auth.uid() = user_id);

drop policy if exists user_plant_upgrades_select_own on public.user_plant_upgrades;
create policy user_plant_upgrades_select_own
  on public.user_plant_upgrades
  for select
  using (auth.uid() = user_id);

insert into public.plant_catalog (id, name, rarity, max_level, base_cost, cost_multiplier)
values
  ('bamboo', 'Bamboo', 'common', 5, 8, 1.50),
  ('cactus', 'Cactus', 'common', 5, 9, 1.55),
  ('lavender', 'Lavender', 'common', 5, 10, 1.60),
  ('sunflower', 'Sunflower', 'common', 5, 11, 1.60),
  ('fern', 'Fern', 'uncommon', 6, 13, 1.65),
  ('lotus', 'Lotus', 'uncommon', 6, 15, 1.70),
  ('monstera', 'Monstera', 'uncommon', 6, 18, 1.72),
  ('orchid', 'Orchid', 'rare', 7, 22, 1.78),
  ('bonsai', 'Bonsai', 'rare', 7, 26, 1.82),
  ('sakura', 'Sakura', 'epic', 8, 34, 1.90)
on conflict (id) do update
set
  name = excluded.name,
  rarity = excluded.rarity,
  max_level = excluded.max_level,
  base_cost = excluded.base_cost,
  cost_multiplier = excluded.cost_multiplier;

drop function if exists public.get_garden_points();

create or replace function public.get_garden_points()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_total_earned integer := 0;
  v_total_spent integer := 0;
  v_remaining integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  select coalesce(sum(tc.points), 0)::integer
  into v_total_earned
  from public.task_completions tc
  where tc.user_id = v_user_id;

  select coalesce(sum(up.cost_paid), 0)::integer
  into v_total_spent
  from public.user_plant_upgrades up
  where up.user_id = v_user_id;

  v_remaining := greatest(v_total_earned - v_total_spent, 0);

  return jsonb_build_object(
    'earnedPoints', v_total_earned,
    'spentPoints', v_total_spent,
    'remainingPoints', v_remaining
  );
end;
$$;

drop function if exists public.upgrade_plant(text);

create or replace function public.upgrade_plant(p_plant_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_catalog public.plant_catalog%rowtype;
  v_current_level integer := 0;
  v_target_level integer := 1;
  v_exponent integer := 0;
  v_cost integer := 0;
  v_total_earned integer := 0;
  v_total_spent integer := 0;
  v_remaining integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if p_plant_id is null or btrim(p_plant_id) = '' then
    raise exception 'Plant id is required'
      using errcode = '22023';
  end if;

  -- Serialize upgrades per user so point spending cannot race.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select *
  into v_catalog
  from public.plant_catalog
  where id = p_plant_id;

  if not found then
    raise exception 'Plant not found'
      using errcode = 'P0002';
  end if;

  select level
  into v_current_level
  from public.user_plants
  where user_id = v_user_id
    and plant_id = p_plant_id
  for update;

  if not found then
    v_current_level := 0;
    v_target_level := 1;
  elsif v_current_level >= v_catalog.max_level then
    select coalesce(sum(tc.points), 0)::integer
    into v_total_earned
    from public.task_completions tc
    where tc.user_id = v_user_id;

    select coalesce(sum(up.cost_paid), 0)::integer
    into v_total_spent
    from public.user_plant_upgrades up
    where up.user_id = v_user_id;

    v_remaining := greatest(v_total_earned - v_total_spent, 0);

    return jsonb_build_object(
      'plantId', p_plant_id,
      'newLevel', v_current_level,
      'costPaid', 0,
      'remainingPoints', v_remaining,
      'maxLevelReached', true
    );
  else
    v_target_level := v_current_level + 1;
  end if;

  v_exponent := case when v_current_level <= 0 then 0 else v_current_level - 1 end;
  v_cost := ceil(v_catalog.base_cost::numeric * power(v_catalog.cost_multiplier, v_exponent::numeric))::integer;

  select coalesce(sum(tc.points), 0)::integer
  into v_total_earned
  from public.task_completions tc
  where tc.user_id = v_user_id;

  select coalesce(sum(up.cost_paid), 0)::integer
  into v_total_spent
  from public.user_plant_upgrades up
  where up.user_id = v_user_id;

  v_remaining := greatest(v_total_earned - v_total_spent, 0);

  if v_remaining < v_cost then
    raise exception 'Not enough points'
      using errcode = 'P0001',
        detail = jsonb_build_object(
          'requiredPoints', v_cost,
          'remainingPoints', v_remaining
        )::text;
  end if;

  if v_current_level = 0 then
    insert into public.user_plants (user_id, plant_id, level, equipped, purchased_at, updated_at)
    values (v_user_id, p_plant_id, 1, false, now(), now());
  else
    update public.user_plants
    set
      level = v_target_level,
      updated_at = now()
    where user_id = v_user_id
      and plant_id = p_plant_id;
  end if;

  insert into public.user_plant_upgrades (user_id, plant_id, from_level, to_level, cost_paid)
  values (v_user_id, p_plant_id, v_current_level, v_target_level, v_cost);

  v_remaining := v_remaining - v_cost;

  return jsonb_build_object(
    'plantId', p_plant_id,
    'newLevel', v_target_level,
    'costPaid', v_cost,
    'remainingPoints', v_remaining
  );
end;
$$;

revoke all on function public.get_garden_points() from public;
grant execute on function public.get_garden_points() to authenticated;
grant execute on function public.get_garden_points() to service_role;

revoke all on function public.upgrade_plant(text) from public;
grant execute on function public.upgrade_plant(text) to authenticated;
grant execute on function public.upgrade_plant(text) to service_role;
