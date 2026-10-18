-- Wardrobe (local-backend/sql/wardrobe_v1.sql): starters are claimed for free, Sprouts buy the rest, buying
-- twice charges once, premium and retired items are not for sale, the one balance counts plant and wardrobe
-- spending both ways, outfits hold only owned items in their own slot, fit nudges are clamped, and nobody
-- reads or writes another person's wardrobe (or their own, around the RPCs).
-- Run: npm run backend:test (supabase test db --workdir local-backend). Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------- fixtures and helpers
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@wardrobe.test', now(), now()),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@wardrobe.test', now(), now());

create schema tests;
grant usage on schema tests to authenticated, anon, service_role;

create function tests.act_as(who uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
end $$;

-- Sprouts the way the server records them: one task and one paid completion (run as the table owner)
create function tests.give_points(who uuid, pts integer) returns void language plpgsql as $$
declare t bigint;
begin
  insert into public.tasks (user_id, title) values (who, 'Wardrobe fixture task') returning id into t;
  insert into public.task_completions (user_id, task_id, completed_at, completed_date, completion_date, points, done)
  values (who, t, now(), current_date, current_date, pts, true);
end $$;

grant execute on all functions in schema tests to authenticated, anon, service_role;

-- ---------------------------------------------------------------- structure
select is((select count(*)::int from public.wardrobe_items where active and not premium), 24, 'the catalog seed has all 24 items, all on sale for Sprouts');
select is((select count(*)::int from public.wardrobe_items where price_sprouts = 0), 3, 'three of them are free starters');
select is((select count(*)::int from pg_class c where c.oid in ('public.wardrobe_items'::regclass, 'public.user_wardrobe'::regclass,
                                                                'public.wardrobe_purchases'::regclass, 'public.pet_outfits'::regclass)
             and c.relrowsecurity),
          4, 'RLS is on for all four wardrobe tables');
select is((select count(*)::int from pg_policies where schemaname = 'public'
             and tablename in ('wardrobe_items', 'user_wardrobe', 'wardrobe_purchases', 'pet_outfits') and roles <> '{authenticated}'::name[]),
          0, 'every wardrobe policy applies to authenticated only');
select is((select count(*)::int from pg_policies where schemaname = 'public'
             and tablename in ('wardrobe_items', 'user_wardrobe', 'wardrobe_purchases', 'pet_outfits') and cmd <> 'SELECT'),
          0, 'no wardrobe table has an insert/update/delete policy');
select is((select count(*)::int from unnest(array['wardrobe_items', 'user_wardrobe', 'wardrobe_purchases', 'pet_outfits']) t
           cross join unnest(array['insert', 'update', 'delete', 'truncate', 'references', 'trigger']) priv
           where has_table_privilege('authenticated', 'public.' || t, priv)),
          0, 'signed-in users hold no write privilege on the wardrobe tables');
select is((select count(*)::int from unnest(array['wardrobe_items', 'user_wardrobe', 'wardrobe_purchases', 'pet_outfits']) t
           cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) priv
           where has_table_privilege('anon', 'public.' || t, priv)),
          0, 'anon has no privilege on the wardrobe tables');

select ok(has_function_privilege('authenticated', 'public.buy_wardrobe_item(text)', 'execute'), 'signed-in users can call buy_wardrobe_item');
select ok(has_function_privilege('authenticated', 'public.equip_outfit(jsonb, jsonb)', 'execute'), 'signed-in users can call equip_outfit');
select ok(has_function_privilege('authenticated', 'public.get_garden_points()', 'execute'), 'get_garden_points is still callable');
select ok(has_function_privilege('authenticated', 'public.upgrade_plant(text)', 'execute'), 'upgrade_plant is still callable');
select ok(not has_function_privilege('anon', 'public.buy_wardrobe_item(text)', 'execute'), 'anon cannot call buy_wardrobe_item');
select ok(not has_function_privilege('anon', 'public.equip_outfit(jsonb, jsonb)', 'execute'), 'anon cannot call equip_outfit');
select ok(not has_function_privilege('authenticated', 'public.points_balance(uuid)', 'execute'), 'the balance helper (any user id) is not callable by the app');
select ok(not has_function_privilege('anon', 'public.points_balance(uuid)', 'execute'), 'nor by anon');
select is((select count(*)::int from pg_proc p
           where p.oid in ('public.buy_wardrobe_item(text)'::regprocedure, 'public.equip_outfit(jsonb, jsonb)'::regprocedure,
                           'public.get_garden_points()'::regprocedure, 'public.upgrade_plant(text)'::regprocedure)
             and p.prosecdef and 'search_path=public' = any (p.proconfig)),
          4, 'the four spending RPCs are SECURITY DEFINER with search_path pinned');
select ok(pg_get_functiondef('public.buy_wardrobe_item(text)'::regprocedure) like '%pg_advisory_xact_lock(hashtext(v_user_id::text))%'
          and pg_get_functiondef('public.upgrade_plant(text)'::regprocedure) like '%pg_advisory_xact_lock(hashtext(v_user_id::text))%',
          'wardrobe and plant spending take the same per-user lock');

-- one item sold for real money only, and one that has left the shop (created the way an operator would)
insert into public.wardrobe_items (id, name, slot, category, price_sprouts, rarity, species, collection, premium, active, sort) values
  ('head.zz_premium', 'Test premium hat', 'head', 'hats', 10, 'rare', array['dog', 'cat'], 'Test', true, true, 900),
  ('head.zz_retired', 'Test retired hat', 'head', 'hats', 10, 'common', array['dog', 'cat'], 'Test', false, false, 901);

-- ---------------------------------------------------------------- A: starters and buying
select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.wardrobe_items where collection <> 'Test'), 24, 'signed-in users can read the wardrobe catalog');
select is(public.get_garden_points(), '{"earnedPoints": 0, "spentPoints": 0, "remainingPoints": 0}'::jsonb, 'A starts with no Sprouts');

select is(public.buy_wardrobe_item('head.daisy_crown'),
          '{"item_id": "head.daisy_crown", "cost_paid": 0, "remaining_points": 0, "already_owned": false}'::jsonb,
          'a free starter is claimed with no Sprouts at all');
select is((select source from public.user_wardrobe where item_id = 'head.daisy_crown'), 'starter', 'the claim is recorded as a starter');
select is((select cost_paid from public.wardrobe_purchases where item_id = 'head.daisy_crown'), 0, 'and the ledger shows it cost nothing');
select is(public.buy_wardrobe_item('head.daisy_crown'),
          '{"item_id": "head.daisy_crown", "cost_paid": 0, "remaining_points": 0, "already_owned": true}'::jsonb,
          'claiming it again says it is already owned');
select is((select count(*)::int from public.wardrobe_purchases where item_id = 'head.daisy_crown'), 1, 'and adds no second ledger row');

select throws_ok($$select public.buy_wardrobe_item('neck.collar_sky')$$, 'P0001', 'Not enough points', 'a 20-Sprout item is refused with 0 Sprouts');
select is((select count(*)::int from public.user_wardrobe where item_id = 'neck.collar_sky'), 0, 'the refused item is not owned');

reset role;
select tests.give_points('aaaaaaaa-0000-4000-8000-00000000000a', 100);
select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a');

select is(public.buy_wardrobe_item('neck.collar_sky'),
          '{"item_id": "neck.collar_sky", "cost_paid": 20, "remaining_points": 80, "already_owned": false}'::jsonb,
          'with 100 Sprouts the 20-Sprout collar is bought');
select is((select source from public.user_wardrobe where item_id = 'neck.collar_sky'), 'sprouts', 'it is recorded as bought with Sprouts');
select is(public.buy_wardrobe_item('neck.collar_sky'),
          '{"item_id": "neck.collar_sky", "cost_paid": 0, "remaining_points": 80, "already_owned": true}'::jsonb,
          'buying it again is idempotent: already owned, nothing charged');
select is((select count(*)::int from public.wardrobe_purchases where item_id = 'neck.collar_sky'), 1, 'one ledger row for the collar');
select is(public.get_garden_points(), '{"earnedPoints": 100, "spentPoints": 20, "remainingPoints": 80}'::jsonb,
          'the Sprouts balance subtracts wardrobe spending');

select throws_ok($$select public.buy_wardrobe_item('head.gold_crown')$$, 'P0001', 'Not enough points', 'the 160-Sprout crown is refused at 80');
select throws_ok($$select public.buy_wardrobe_item('head.zz_premium')$$, 'P0001', 'Item not available', 'a premium item cannot be bought with Sprouts');
select throws_ok($$select public.buy_wardrobe_item('head.zz_retired')$$, 'P0001', 'Item not available', 'an inactive item cannot be bought');
select throws_ok($$select public.buy_wardrobe_item('head.no_such_hat')$$, '22023', 'Item not found', 'an unknown item is refused');
select throws_ok($$select public.buy_wardrobe_item('  ')$$, '22023', 'Item id is required', 'a blank item id is refused');
select is((public.get_garden_points() ->> 'remainingPoints')::int, 80, 'refused purchases charge nothing');
select is((select count(*)::int from public.user_wardrobe), 2, 'A owns exactly the starter and the collar');

-- ---------------------------------------------------------------- one balance for plants and the wardrobe
select is(public.upgrade_plant('bamboo'), '{"plantId": "bamboo", "newLevel": 1, "costPaid": 8, "remainingPoints": 72}'::jsonb,
          'a plant upgrade starts from the balance left after wardrobe spending');
select is(public.buy_wardrobe_item('face.heart_sunnies') ->> 'remaining_points', '17', 'a wardrobe purchase sees plant spending too (72 - 55)');
select throws_ok($$select public.upgrade_plant('sakura')$$, 'P0001', 'Not enough points',
                 'a 34-Sprout plant is refused at 17 (it would pass if wardrobe spending were ignored)');
select is(public.upgrade_plant('lavender') ->> 'remainingPoints', '7', 'a 10-Sprout plant still fits (17 - 10)');
select is(public.get_garden_points(), '{"earnedPoints": 100, "spentPoints": 93, "remainingPoints": 7}'::jsonb,
          'earned 100, spent 20 + 8 + 55 + 10');

-- ---------------------------------------------------------------- A: wearing things
select is(public.equip_outfit('{"head": "head.daisy_crown", "neck": "neck.collar_sky"}'::jsonb),
          '{"slots": {"head": "head.daisy_crown", "neck": "neck.collar_sky"}, "fit": {}}'::jsonb,
          'owned items are worn in their own slots');
select is((select slots from public.pet_outfits), '{"head": "head.daisy_crown", "neck": "neck.collar_sky"}'::jsonb, 'and the outfit is stored for the pet');

select throws_ok($$select public.equip_outfit('{"face": "face.star_glasses"}'::jsonb)$$, 'P0001', 'Item not owned', 'an item A does not own cannot be worn');
select throws_ok($$select public.equip_outfit('{"face": "head.daisy_crown"}'::jsonb)$$, '22023', 'Item does not fit that slot', 'a hat cannot be worn as glasses');
select throws_ok($$select public.equip_outfit('{"tail": "head.daisy_crown"}'::jsonb)$$, '22023', 'Unknown outfit slot', 'an unknown slot is rejected');
select throws_ok($$select public.equip_outfit('{"head": "head.no_such_hat"}'::jsonb)$$, '22023', 'Item not found', 'an unknown item is rejected');
select throws_ok($$select public.equip_outfit('{"head": 7}'::jsonb)$$, '22023', 'Outfit item id must be text', 'a non-text item id is rejected');
select throws_ok($$select public.equip_outfit('["head.daisy_crown"]'::jsonb)$$, '22023', 'Outfit must be an object', 'an outfit that is not an object is rejected');
select throws_ok($$select public.equip_outfit(null)$$, '22023', 'Outfit must be an object', 'a missing outfit is rejected');
select is((select slots from public.pet_outfits), '{"head": "head.daisy_crown", "neck": "neck.collar_sky"}'::jsonb, 'refused outfits leave the stored one unchanged');

select is(public.equip_outfit('{"head": "head.daisy_crown", "neck": "neck.collar_sky"}'::jsonb,
                              '{"head": {"dx": 3, "dy": -9, "scale": 10}, "neck": {"dx": 0.1, "dy": -0.25, "scale": 0.1}, "face": {"scale": 1.25}}'::jsonb) -> 'fit',
          '{"head": {"dx": 0.5, "dy": -0.5, "scale": 2}, "neck": {"dx": 0.1, "dy": -0.25, "scale": 0.5}, "face": {"dx": 0, "dy": 0, "scale": 1.25}}'::jsonb,
          'fit nudges are clamped (dx, dy to -0.5..0.5, scale to 0.5..2) and missing numbers default to automatic');
select throws_ok($$select public.equip_outfit('{}'::jsonb, '{"head": {"dx": "left"}}'::jsonb)$$, '22023', 'Fit values must be numbers', 'a non-numeric nudge is rejected');
select throws_ok($$select public.equip_outfit('{}'::jsonb, '{"tail": {"dx": 0}}'::jsonb)$$, '22023', 'Unknown outfit slot', 'a nudge for an unknown slot is rejected');
select throws_ok($$select public.equip_outfit('{}'::jsonb, '[1, 2]'::jsonb)$$, '22023', 'Fit must be an object', 'a fit that is not an object is rejected');

-- an item that left the shop stays A's and stays wearable (owned items never expire)
reset role;
insert into public.user_wardrobe (user_id, item_id, source) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'head.zz_retired', 'gift');
select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a');
select is(public.buy_wardrobe_item('head.zz_retired') ->> 'already_owned', 'true', 'an owned item that left the shop still reads as owned');
select is(public.equip_outfit('{"head": "head.zz_retired", "neck": null}'::jsonb),
          '{"slots": {"head": "head.zz_retired"}, "fit": {"head": {"dx": 0.5, "dy": -0.5, "scale": 2}, "neck": {"dx": 0.1, "dy": -0.25, "scale": 0.5}, "face": {"dx": 0, "dy": 0, "scale": 1.25}}}'::jsonb,
          'without a fit the saved nudges are kept, a null slot is emptied, and a retired owned item can be worn');
select is(public.equip_outfit('{"head": "head.zz_retired"}'::jsonb, '{"head": null}'::jsonb) -> 'fit', '{}'::jsonb,
          'a null nudge puts that slot back to the automatic fit');

-- ---------------------------------------------------------------- A cannot write around the RPCs
select throws_ok($$insert into public.user_wardrobe (user_id, item_id, source) values (auth.uid(), 'head.gold_crown', 'gift')$$, '42501', null, 'A cannot give itself an item');
select throws_ok($$update public.pet_outfits set slots = '{"head": "head.gold_crown"}' where user_id = auth.uid()$$, '42501', null, 'A cannot write its outfit directly');
select throws_ok($$delete from public.wardrobe_purchases where user_id = auth.uid()$$, '42501', null, 'A cannot erase its spending (that would refund Sprouts)');
select throws_ok($$update public.wardrobe_purchases set cost_paid = 0 where user_id = auth.uid()$$, '42501', null, 'A cannot rewrite its spending');
select throws_ok($$insert into public.wardrobe_purchases (user_id, item_id, cost_paid) values (auth.uid(), 'head.gold_crown', 0)$$, '42501', null, 'A cannot add ledger rows');
select throws_ok($$update public.wardrobe_items set price_sprouts = 0$$, '42501', null, 'A cannot change prices');
select throws_ok($$insert into public.pet_outfits (user_id) values (auth.uid()) on conflict do nothing$$, '42501', null, 'A cannot create an outfit row directly');

-- ---------------------------------------------------------------- B cannot see or touch A
select tests.act_as('bbbbbbbb-0000-4000-8000-00000000000b');
select is(public.get_garden_points(), '{"earnedPoints": 0, "spentPoints": 0, "remainingPoints": 0}'::jsonb, 'A''s spending is not B''s');
select is(public.buy_wardrobe_item('neck.bandana_red') ->> 'cost_paid', '0', 'B claims its own starter');
select is(public.equip_outfit('{"neck": "neck.bandana_red"}'::jsonb) -> 'slots', '{"neck": "neck.bandana_red"}'::jsonb, 'and wears it');
select is((select count(*)::int from public.user_wardrobe where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'), 0, 'B reads none of A''s wardrobe');
select is((select count(*)::int from public.wardrobe_purchases where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'), 0, 'B reads none of A''s purchases');
select is((select count(*)::int from public.pet_outfits where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'), 0, 'B reads none of A''s outfit');
select is((select count(*)::int from public.user_wardrobe), 1, 'B sees only its own item');
select throws_ok($$select public.equip_outfit('{"neck": "neck.collar_sky"}'::jsonb)$$, 'P0001', 'Item not owned', 'B cannot wear an item only A owns');
select throws_ok($$update public.pet_outfits set slots = '{}' where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'$$, '42501', null, 'B cannot change A''s outfit');
select throws_ok($$delete from public.user_wardrobe where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'$$, '42501', null, 'B cannot take A''s items');

reset role;
select is((select slots from public.pet_outfits where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'), '{"head": "head.zz_retired"}'::jsonb,
          'A''s outfit is unchanged after B''s attempts');
select is((select count(*)::int from public.user_wardrobe where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'), 4, 'A still owns its four items');

-- ---------------------------------------------------------------- no session
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.buy_wardrobe_item('head.daisy_crown')$$, '42501', null, 'anon cannot buy or claim');
select throws_ok($$select public.equip_outfit('{}'::jsonb)$$, '42501', null, 'anon cannot dress a pet');
select throws_ok($$select count(*) from public.wardrobe_items$$, '42501', null, 'anon cannot read the wardrobe catalog');
select throws_ok($$select count(*) from public.pet_outfits$$, '42501', null, 'anon cannot read outfits');

reset role;
select * from finish();
rollback;
