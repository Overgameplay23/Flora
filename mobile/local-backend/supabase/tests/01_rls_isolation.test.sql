-- Row-level security: user A cannot read or modify user B's rows in any table in public, a signed-out
-- caller sees nothing, and signed-in users cannot write the tables that only the server writes.
-- Run: npm run backend:test (supabase test db --workdir local-backend). Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------- fixtures and helpers
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls.test', now(), now()),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls.test', now(), now());

create schema tests;
grant usage on schema tests to authenticated, anon, service_role;

-- every table in public that has a user_id column (new tables are covered automatically)
create function tests.user_tables() returns setof text language sql stable as $$
  select c.relname::text from pg_class c
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  order by 1
$$;

-- tables only SECURITY DEFINER RPCs or the service role may write
create function tests.server_tables() returns setof text language sql immutable as $$
  select unnest(array['task_completions', 'user_plants', 'user_plant_upgrades', 'user_events', 'daily_user_metrics',
                      'pet_state', 'pet_chat_usage', 'pet_stylize_requests', 'user_memories', 'weekly_summaries'])
$$;

-- the helpers run as the caller (SECURITY INVOKER), so the caller's RLS and privileges apply
create function tests.visible_rows(tbl text, who uuid) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where user_id = $1', tbl) into n using who;
  return n::text;
exception when insufficient_privilege then return 'denied';
end $$;

create function tests.touch_rows(tbl text, who uuid, action text) returns text language plpgsql as $$
declare n bigint;
begin
  if action = 'update' then
    execute format('update public.%I set user_id = user_id where user_id = $1', tbl) using who;
  else
    execute format('delete from public.%I where user_id = $1', tbl) using who;
  end if;
  get diagnostics n = row_count;
  return n::text;
exception when insufficient_privilege then return 'denied';
end $$;

create function tests.insert_bare(tbl text, who uuid) returns text language plpgsql as $$
begin
  execute format('insert into public.%I (user_id) values ($1)', tbl) using who;
  return 'inserted';
exception when insufficient_privilege then return 'denied';
          when others then return sqlstate;
end $$;

create function tests.act_as(who uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
end $$;

-- the rows a signed-in person creates through the app's own paths (RLS + RPCs), as that person
create function tests.seed_as_owner() returns void language plpgsql as $$
declare
  me uuid := auth.uid();
  habit bigint;
begin
  insert into public.profiles (user_id, email) values (me, me::text || '@rls.test'); -- trigger seeds 3 tasks
  insert into public.pet (user_id, name, photo_url) values (me, 'Probe', 'look://chosen');
  insert into public.checkins (user_id, checkin_date, mood, note) values (me, current_date, 3, 'private note');
  insert into public.habits (user_id, title) values (me, 'Stretch') returning id into habit;
  insert into public.habit_completions (user_id, habit_id, date, completed) values (me, habit, current_date, true);
  insert into public.journal_entries (user_id, entry_text, entry_date) values (me, 'private journal line', current_date);
  insert into public.user_stats (user_id, streak) values (me, 1);
  insert into public.garden_unlocks (user_id, item_id) select me, min(id) from public.garden_items;
  insert into public.garden_plants (user_id, plant_type) values (me, 'fern');
  perform public.complete_task((select min(id) from public.tasks where user_id = me)::text, now(), current_date);
  perform public.log_event_and_rollup('checkin_submitted', now(), null, null, null, null, '{}'::jsonb, current_date);
  perform public.recompute_pet_state(current_date);
end $$;

-- rows only the server writes, created the way the server does (table owner / service role)
create function tests.seed_as_server(who uuid) returns void language plpgsql as $$
begin
  insert into public.user_plants (user_id, plant_id, level) values (who, 'bamboo', 1);
  insert into public.user_plant_upgrades (user_id, plant_id, from_level, to_level, cost_paid) values (who, 'bamboo', 0, 1, 8);
  insert into public.pet_stylize_requests (user_id, last_requested_at) values (who, now());
  insert into public.user_memories (user_id, memory_type, content) values (who, 'fact', 'likes the park');
  insert into public.weekly_summaries (user_id, week_start, summary) values (who, current_date, 'a gentle week');
end $$;

grant execute on all functions in schema tests to authenticated, anon, service_role;

select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a');
select tests.seed_as_owner();
select tests.act_as('bbbbbbbb-0000-4000-8000-00000000000b');
select tests.seed_as_owner();
reset role;
select tests.seed_as_server('aaaaaaaa-0000-4000-8000-00000000000a');
select tests.seed_as_server('bbbbbbbb-0000-4000-8000-00000000000b');
set local role service_role;
select public.consume_pet_chat_quota('aaaaaaaa-0000-4000-8000-00000000000a', current_date, 30);
select public.consume_pet_chat_quota('bbbbbbbb-0000-4000-8000-00000000000b', current_date, 30);
reset role;

create table tests.baseline as
  select t as tbl, tests.visible_rows(t, 'aaaaaaaa-0000-4000-8000-00000000000a')::int as a_rows,
                   tests.visible_rows(t, 'bbbbbbbb-0000-4000-8000-00000000000b')::int as b_rows
  from tests.user_tables() t;
grant select on tests.baseline to authenticated, anon;

-- ---------------------------------------------------------------- structure
select is((select count(*)::int from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity),
          0, 'RLS is enabled on every table in public');
select is((select count(*)::int from pg_policies where schemaname = 'public' and roles <> '{authenticated}'::name[]),
          0, 'every policy in public applies to authenticated only (none to anon or public)');
select is((select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename in (select tests.user_tables())
             and coalesce(p.qual, '') || coalesce(p.with_check, '') not like '%auth.uid()%'),
          0, 'every policy on a user table is scoped by auth.uid()');
select is((select count(*)::int from pg_policies where schemaname = 'public' and qual = 'true' and tablename not in ('plant_catalog', 'garden_items')),
          0, 'only the two catalogs have an unconditional policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in (select tests.server_tables()) and cmd <> 'SELECT'),
          0, 'server-written tables have no insert/update/delete policy');
select cmp_ok(a_rows, '>', 0, format('fixture: A has rows in %s', tbl)) from tests.baseline;
select cmp_ok(b_rows, '>', 0, format('fixture: B has rows in %s', tbl)) from tests.baseline;

-- ---------------------------------------------------------------- A sees only A
select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a');
select is(tests.visible_rows(tbl, 'aaaaaaaa-0000-4000-8000-00000000000a'), a_rows::text, format('A reads all of A''s rows in %s', tbl)) from tests.baseline;
select is(tests.visible_rows(tbl, 'bbbbbbbb-0000-4000-8000-00000000000b'), '0', format('A reads none of B''s rows in %s', tbl)) from tests.baseline;

-- ---------------------------------------------------------------- B cannot touch A
select tests.act_as('bbbbbbbb-0000-4000-8000-00000000000b');
select is(tests.visible_rows(tbl, 'aaaaaaaa-0000-4000-8000-00000000000a'), '0', format('B reads none of A''s rows in %s', tbl)) from tests.baseline;
select ok(tests.touch_rows(tbl, 'aaaaaaaa-0000-4000-8000-00000000000a', 'update') in ('0', 'denied'), format('B updates none of A''s rows in %s', tbl)) from tests.baseline;
select ok(tests.touch_rows(tbl, 'aaaaaaaa-0000-4000-8000-00000000000a', 'delete') in ('0', 'denied'), format('B deletes none of A''s rows in %s', tbl)) from tests.baseline;

-- B cannot plant rows that belong to A
select throws_ok($$insert into public.profiles (user_id, email) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'x')$$, '42501', null, 'B cannot insert a profile as A');
select throws_ok($$insert into public.pet (user_id, name) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'x')$$, '42501', null, 'B cannot insert a pet as A');
select throws_ok($$insert into public.checkins (user_id, checkin_date, mood) values ('aaaaaaaa-0000-4000-8000-00000000000a', current_date - 3, 1)$$, '42501', null, 'B cannot insert a check-in as A');
select throws_ok($$insert into public.journal_entries (user_id, entry_text) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'x')$$, '42501', null, 'B cannot insert a journal entry as A');
select throws_ok($$insert into public.tasks (user_id, title) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'x')$$, '42501', null, 'B cannot insert a task as A');
select throws_ok($$insert into public.habits (user_id, title) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'x')$$, '42501', null, 'B cannot insert a habit as A');
select throws_ok($$insert into public.habit_completions (user_id, habit_id, date) select 'aaaaaaaa-0000-4000-8000-00000000000a', min(id), current_date - 3 from public.habits$$, '42501', null, 'B cannot insert a habit completion as A');
select throws_ok($$insert into public.user_stats (user_id, streak) values ('aaaaaaaa-0000-4000-8000-00000000000a', 9)$$, '42501', null, 'B cannot insert user_stats as A');
select throws_ok($$insert into public.garden_unlocks (user_id, item_id) select 'aaaaaaaa-0000-4000-8000-00000000000a', max(id) from public.garden_items$$, '42501', null, 'B cannot insert a garden unlock as A');
select throws_ok($$insert into public.garden_plants (user_id, plant_type) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'x')$$, '42501', null, 'B cannot insert a garden plant as A');
select is(tests.insert_bare(t, 'aaaaaaaa-0000-4000-8000-00000000000a'), 'denied', format('B cannot insert into %s as A', t)) from tests.server_tables() t;

-- B cannot hand its own rows to A
select throws_ok($$update public.journal_entries set user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'$$, '42501', null, 'B cannot re-parent a journal entry to A');
select throws_ok($$update public.checkins set user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'$$, '42501', null, 'B cannot re-parent a check-in to A');
select throws_ok($$update public.pet set user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'$$, '42501', null, 'B cannot re-parent a pet to A');

reset role;
select is(tests.visible_rows(tbl, 'aaaaaaaa-0000-4000-8000-00000000000a'), a_rows::text, format('A''s rows in %s are unchanged after B''s attempts', tbl)) from tests.baseline;

-- ---------------------------------------------------------------- owners cannot write server tables
-- (R-37 forged points, R-38 plant levels, R-41 streaks/events/memories, stylize rate limit)
select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a');
select is(tests.insert_bare(t, 'aaaaaaaa-0000-4000-8000-00000000000a'), 'denied', format('A cannot insert its own %s rows', t)) from tests.server_tables() t;
select is(tests.touch_rows(t, 'aaaaaaaa-0000-4000-8000-00000000000a', 'update'), 'denied', format('A cannot update its own %s rows', t)) from tests.server_tables() t;
select is(tests.touch_rows(t, 'aaaaaaaa-0000-4000-8000-00000000000a', 'delete'), 'denied', format('A cannot delete its own %s rows', t)) from tests.server_tables() t;
select is((public.get_garden_points() ->> 'earnedPoints')::int, 2, 'A''s garden points come only from complete_task');

-- ---------------------------------------------------------------- the owner paths still work
select lives_ok($$update public.journal_entries set entry_text = 'edited' where user_id = auth.uid()$$, 'A can edit its own journal');
select lives_ok($$select public.complete_task((select max(id) from public.tasks where user_id = auth.uid())::text, now(), current_date)$$, 'A can complete a task through the RPC');
select is((select count(*)::int from public.plant_catalog), 10, 'signed-in users can read the plant catalog');

-- ---------------------------------------------------------------- no session
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(tests.visible_rows(tbl, 'aaaaaaaa-0000-4000-8000-00000000000a'), 'denied', format('anon cannot read %s', tbl)) from tests.baseline;
select throws_ok($$select count(*) from public.plant_catalog$$, '42501', null, 'anon cannot read the catalog either');

reset role;
select * from finish();
rollback;
