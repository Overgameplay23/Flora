-- Privileges behind the policies: nothing in public is reachable without a session, the chat quota is
-- the server's alone (R-39), and objects created by later migrations start closed.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@grants.test', now(), now());

-- ---------------------------------------------------------------- functions
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')),
          0, 'anon can execute no function in public');
select ok(has_function_privilege('authenticated', 'public.complete_task(text, timestamptz, date)', 'execute'), 'signed-in users can call complete_task');
select ok(has_function_privilege('authenticated', 'public.get_garden_points()', 'execute'), 'signed-in users can call get_garden_points');
select ok(has_function_privilege('authenticated', 'public.upgrade_plant(text)', 'execute'), 'signed-in users can call upgrade_plant');
select ok(has_function_privilege('authenticated', 'public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb, date)', 'execute'), 'signed-in users can call log_event_and_rollup');
select ok(has_function_privilege('authenticated', 'public.recompute_pet_state(date)', 'execute'), 'signed-in users can call recompute_pet_state');
select ok(not has_function_privilege('authenticated', 'public.consume_pet_chat_quota(uuid, date, integer)', 'execute'), 'signed-in users cannot call consume_pet_chat_quota');
select ok(has_function_privilege('service_role', 'public.consume_pet_chat_quota(uuid, date, integer)', 'execute'), 'Edge Functions (service role) can call consume_pet_chat_quota');

set local role anon;
select throws_ok($$select public.consume_pet_chat_quota('aaaaaaaa-0000-4000-8000-00000000000a', null, 100000)$$, '42501', null, 'anon cannot burn a user''s chat allowance');
select throws_ok($$select public.get_garden_points()$$, '42501', null, 'anon cannot call the garden RPCs');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.consume_pet_chat_quota('aaaaaaaa-0000-4000-8000-00000000000a', null, 100000)$$, '42501', null, 'a signed-in user cannot move the chat counter directly');
reset role;
set local role service_role;
select is((select allowed from public.consume_pet_chat_quota('aaaaaaaa-0000-4000-8000-00000000000a', null, 30)), true, 'pet-talk''s service-role call still works');
reset role;

-- ---------------------------------------------------------------- tables
select is((select count(*)::int from pg_class c cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) priv
           where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm') and has_table_privilege('anon', c.oid, priv)),
          0, 'anon has no privilege on any table in public');
select is((select count(*)::int from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and has_table_privilege('authenticated', c.oid, 'truncate')),
          0, 'signed-in users cannot TRUNCATE (which would bypass RLS)');
select is((select count(*)::int from unnest(array['task_completions', 'user_plants', 'user_plant_upgrades', 'user_events', 'daily_user_metrics', 'pet_state',
                                                  'pet_chat_usage', 'pet_stylize_requests', 'user_memories', 'weekly_summaries', 'plant_catalog', 'garden_items']) t
           cross join unnest(array['insert', 'update', 'delete']) priv where has_table_privilege('authenticated', 'public.' || t, priv)),
          0, 'signed-in users hold no write privilege on server-written tables or catalogs');

-- ---------------------------------------------------------------- objects created later start closed
create table public.zz_future_table (id int primary key, user_id uuid);
create function public.zz_future_fn() returns int language sql as $$ select 1 $$;
select ok(not has_table_privilege('anon', 'public.zz_future_table', 'select'), 'a table added by a later migration is not readable by anon');
select ok(not has_table_privilege('authenticated', 'public.zz_future_table', 'truncate'), 'a table added later is not truncatable by signed-in users');
select ok(not has_function_privilege('anon', 'public.zz_future_fn()', 'execute'), 'a function added later is not executable by anon');

select * from finish();
rollback;
