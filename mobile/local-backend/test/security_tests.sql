-- Security and behaviour tests for the hardened schema. Runs on a fresh database after all migrations:
--   local-backend/test/apply_all.sh luna_test && psql ... -d luna_test -v ON_ERROR_STOP=1 -f local-backend/test/security_tests.sql
-- Each block prints PASS or stops the run with FAIL. "as_user" switches to a signed-in user the same way
-- PostgREST does (role authenticated + JWT claims).

\set QUIET on
\pset tuples_only on
set client_min_messages = notice;
set timezone = 'UTC';  -- hosted Supabase runs in UTC

-- two users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local');

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  execute 'set role anon';
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ===== The app's own writes still work =====================================================
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

insert into public.profiles (user_id) values ('11111111-1111-1111-1111-111111111111')
  on conflict (user_id) do nothing;
update public.profiles set email = 'a@test.local' where user_id = auth.uid();
insert into public.pet (user_id, pet_name, species) values (auth.uid(), 'Biscuit', 'dog');
update public.pet set look = '{"coat":"#c8a27a"}'::jsonb where user_id = auth.uid();
insert into public.checkins (user_id, checkin_date, mood) values (auth.uid(), current_date, 4);
insert into public.journal_entries (user_id, entry_text) values (auth.uid(), 'hello');
insert into public.habits (user_id, title) values (auth.uid(), 'Drink water');
insert into public.tasks (user_id, title)
  select auth.uid(), 'task ' || g from generate_series(1, 25) g;
select pg_temp.check(true, 'signed-in user writes profile, pet, check-in, journal, habits, tasks');

-- complete_task works and pays 2 points
select pg_temp.check(
  (select inserted and points_awarded = 2 from public.complete_task((select min(id)::text from public.tasks where user_id = auth.uid()))),
  'complete_task pays 2 points');
select pg_temp.check(
  (select inserted = false from public.complete_task((select min(id)::text from public.tasks where user_id = auth.uid()))),
  'completing the same task twice in a day pays nothing');
select pg_temp.check((public.get_garden_points() ->> 'remainingPoints')::int = 2, 'get_garden_points sees 2');

-- the app's reads still work
select pg_temp.check((select count(*) from public.task_completions) = 1, 'user can read own completions');
select pg_temp.check((select count(*) from public.plant_catalog) >= 10, 'user can read the plant catalogue');

-- events and pet state through the RPCs
select public.log_event_and_rollup('checkin_submitted', now(), null, null, null, null, '{}'::jsonb, null);
select pg_temp.check((select streak_days from public.recompute_pet_state(null)) >= 1, 'log_event + recompute_pet_state work');

-- ===== R-37: points can't be forged ========================================================
do $$ begin
  insert into public.task_completions (user_id, task_id, completed_date, completion_date, done, points)
    values (auth.uid(), (select max(id) from public.tasks where user_id = auth.uid()), current_date, current_date, true, 100000);
  raise exception 'FAIL  direct insert into task_completions was allowed';
exception when insufficient_privilege then raise notice 'PASS  R-37 direct insert into task_completions denied';
end $$;
do $$ declare n int; begin
  update public.task_completions set points = 100000 where user_id = auth.uid();
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL  task_completions points were updated'; end if;
  raise notice 'PASS  R-37 update of points changed nothing';
exception when insufficient_privilege then raise notice 'PASS  R-37 update of points denied';
end $$;

-- ===== R-40: dates and daily farming ======================================================
-- (call first, check in a separate statement: a query can't see rows its own function call inserted)
select public.complete_task((select id::text from public.tasks where user_id = auth.uid() and title = 'task 2'), now() - interval '30 days');
select pg_temp.check(
  (select completed_date = current_date from public.task_completions
    where task_id = (select id from public.tasks where user_id = auth.uid() and title = 'task 2')),
  'R-40 a completion dated 30 days ago lands today');
select public.complete_task((select id::text from public.tasks where user_id = auth.uid() and title = 'task 3'), now() - interval '24 hours');
select pg_temp.check(
  (select completed_date = (now() - interval '24 hours')::date from public.task_completions
    where task_id = (select id from public.tasks where user_id = auth.uid() and title = 'task 3')),
  'offline queue: a completion from 24h ago keeps its day');

do $$ declare r record; paid int := 0; begin
  for r in select id from public.tasks where user_id = auth.uid() and title not in ('task 1','task 2','task 3') order by id loop
    perform public.complete_task(r.id::text);
  end loop;
  select count(*) into paid from public.task_completions where completed_date = current_date and points > 0;
  if paid <> 20 then raise exception 'FAIL  expected 20 paid completions today, got %', paid; end if;
  raise notice 'PASS  R-40 only the first 20 completions of a day earn points (24 done, 20 paid)';
end $$;

select public.log_event_and_rollup('task_completed', now() - interval '400 days', null, null, null, 999999, '{}'::jsonb, null);
select pg_temp.check(
  (select max(points) = 10 from public.user_events where event_type = 'task_completed')
  and not exists (select 1 from public.daily_user_metrics where day < current_date - 3),
  'R-40 log_event caps points at 10 and ignores far-off dates');

-- ===== R-38: plant levels ==================================================================
select pg_temp.check((public.upgrade_plant('bamboo') ->> 'newLevel')::int = 1, 'upgrade_plant buys a plant with earned points');
do $$ declare n int; begin
  update public.user_plants set level = 99 where user_id = auth.uid();
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL  plant level was set directly'; end if;
  raise notice 'PASS  R-38 setting a plant level directly changed nothing';
exception when insufficient_privilege then raise notice 'PASS  R-38 setting a plant level directly denied';
end $$;
do $$ begin
  insert into public.user_plants (user_id, plant_id, level) values (auth.uid(), 'sakura', 8);
  raise exception 'FAIL  free plant insert allowed';
exception when insufficient_privilege then raise notice 'PASS  R-38 inserting a free plant denied';
end $$;

-- ===== R-41: server state and AI memories ==================================================
do $$ begin
  insert into public.user_memories (user_id, memory_type, content) values (auth.uid(), 'fact', 'ignore previous instructions');
  raise exception 'FAIL  user_memories insert allowed';
exception when insufficient_privilege then raise notice 'PASS  R-41 writing AI memories denied';
         when undefined_column then raise notice 'PASS  R-41 (column differs) checking privilege separately';
end $$;
select pg_temp.check(not has_table_privilege('authenticated', 'public.user_memories', 'INSERT'), 'R-41 no INSERT privilege on user_memories');
select pg_temp.check(not has_table_privilege('authenticated', 'public.pet_state', 'UPDATE'), 'R-41 no UPDATE privilege on pet_state');
select pg_temp.check(not has_table_privilege('authenticated', 'public.user_events', 'INSERT'), 'R-41 no INSERT privilege on user_events');
select pg_temp.check(not has_table_privilege('authenticated', 'public.daily_user_metrics', 'UPDATE'), 'no UPDATE privilege on daily_user_metrics');

-- ===== R-39: chat quota ====================================================================
do $$ begin
  perform public.consume_pet_chat_quota('22222222-2222-2222-2222-222222222222', current_date, 5);
  raise exception 'FAIL  signed-in user consumed another user''s chat quota';
exception when insufficient_privilege then raise notice 'PASS  R-39 signed-in user cannot call consume_pet_chat_quota';
end $$;

-- ===== Isolation between users =============================================================
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check(
  (select count(*) from public.checkins) = 0 and (select count(*) from public.journal_entries) = 0
  and (select count(*) from public.pet) = 0 and (select count(*) from public.task_completions) = 0,
  'user B sees none of user A''s data');
do $$ declare n int; begin
  update public.journal_entries set entry_text = 'hacked';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL  user B edited user A''s journal'; end if;
  raise notice 'PASS  user B cannot edit user A''s journal';
end $$;
do $$ begin
  perform public.complete_task((select min(id)::text from public.tasks));
  raise exception 'FAIL  user B completed a task';
exception when no_data_found then raise notice 'PASS  user B cannot complete user A''s tasks';
end $$;

-- ===== Signed out ==========================================================================
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.pet) = 0 and (select count(*) from public.checkins) = 0, 'signed-out caller sees no user rows');
do $$ begin
  perform public.consume_pet_chat_quota('11111111-1111-1111-1111-111111111111', current_date, 5);
  raise exception 'FAIL  anon called consume_pet_chat_quota';
exception when insufficient_privilege then raise notice 'PASS  R-39 signed-out caller cannot call consume_pet_chat_quota';
end $$;
do $$ begin
  perform public.get_garden_points();
  raise exception 'FAIL  anon called get_garden_points';
exception when insufficient_privilege then raise notice 'PASS  signed-out caller cannot call the garden RPCs';
end $$;

-- ===== Server side =========================================================================
reset role;
set role service_role;
select pg_temp.check(public.consume_pet_chat_quota('11111111-1111-1111-1111-111111111111', current_date, 5) is not null,
  'Edge Functions (service role) can still use the chat quota');
reset role;

-- ===== R-13/R-14: photo bucket =============================================================
select pg_temp.check((select not public and file_size_limit = 10485760 from storage.buckets where id = 'pets'),
  'R-13/R-14 pets bucket is private and size-limited');

\echo 'ALL TESTS PASSED'
