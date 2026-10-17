-- Account deletion (local-backend/sql/delete_my_account.sql, App Store Guideline 5.1.1(v)): a signed-in person can
-- delete their own account and every row keyed to them goes with it; nobody else's rows move; a signed-out
-- caller cannot call it. The structural check covers tables added later: each user_id column must cascade
-- from auth.users, or deleting an account would either fail or leave the person's data behind.
-- Run: npm run backend:test (supabase test db --workdir local-backend). Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------- every user_id cascades
select is(
  (select coalesce(string_agg(c.relname::text, ', ' order by c.relname), '')
   from pg_class c
   join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     and not exists (
       select 1 from pg_constraint k
       where k.conrelid = c.oid and k.contype = 'f' and k.confrelid = 'auth.users'::regclass
         and k.confdeltype = 'c' and k.conkey = array[a.attnum])),
  '',
  'every public user_id column references auth.users on delete cascade');

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@delete.test', now(), now()),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@delete.test', now(), now());

create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.act_as(who uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
end $$;

-- rows across the app's own paths, as the signed-in person
create function tests.seed_as_owner() returns void language plpgsql as $$
declare
  me uuid := auth.uid();
  habit bigint;
begin
  insert into public.profiles (user_id, email) values (me, me::text || '@delete.test'); -- trigger seeds 3 tasks
  insert into public.pet (user_id, name, photo_url) values (me, 'Probe', 'look://chosen');
  insert into public.checkins (user_id, checkin_date, mood, note) values (me, current_date, 3, 'private note');
  insert into public.habits (user_id, title) values (me, 'Stretch') returning id into habit;
  insert into public.habit_completions (user_id, habit_id, date, completed) values (me, habit, current_date, true);
  insert into public.journal_entries (user_id, entry_text, entry_date) values (me, 'private journal line', current_date);
  perform public.log_event_and_rollup('checkin_submitted', now(), null, null, 0, 3, '{}'::jsonb, current_date);
  perform public.recompute_pet_state(current_date);
end $$;
grant execute on function tests.seed_as_owner() to authenticated;

-- how many rows each person owns across every user_id table (runs as the table owner, so RLS does not hide any)
create function tests.owned_rows(who uuid) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  t text;
  n bigint;
  total bigint := 0;
begin
  for t in
    select c.relname::text from pg_class c
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  loop
    execute format('select count(*) from public.%I where user_id = $1', t) into n using who;
    total := total + n;
  end loop;
  return total;
end $$;

select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a');
select tests.seed_as_owner();
reset role;
select tests.act_as('bbbbbbbb-0000-4000-8000-00000000000b');
select tests.seed_as_owner();
reset role;

select ok(tests.owned_rows('aaaaaaaa-0000-4000-8000-00000000000a') >= 8, 'A owns rows before deleting');
select ok(tests.owned_rows('bbbbbbbb-0000-4000-8000-00000000000b') >= 8, 'B owns rows too');

-- ---------------------------------------------------------------- who may call it
select ok(not has_function_privilege('anon', 'public.delete_my_account()', 'execute'), 'anon cannot call delete_my_account');
select ok(has_function_privilege('authenticated', 'public.delete_my_account()', 'execute'), 'signed-in users can call delete_my_account');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'a token without a user id deletes nothing');
reset role;

-- ---------------------------------------------------------------- A deletes their account
select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a');
select lives_ok($$select public.delete_my_account()$$, 'A deletes their own account');
reset role;

select is((select count(*)::int from auth.users where id = 'aaaaaaaa-0000-4000-8000-00000000000a'), 0, 'A''s auth user is gone');
select is(tests.owned_rows('aaaaaaaa-0000-4000-8000-00000000000a'), 0::bigint, 'no row anywhere in public still belongs to A');
select is((select count(*)::int from auth.users where id = 'bbbbbbbb-0000-4000-8000-00000000000b'), 1, 'B''s account is untouched');
select ok(tests.owned_rows('bbbbbbbb-0000-4000-8000-00000000000b') >= 8, 'B''s rows are untouched');

select * from finish();
rollback;
