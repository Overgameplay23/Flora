-- The cycle tracker is on-device only (src/services/cycleStore.ts). The database must have nowhere to put
-- cycle data: no table, column or bucket for it. If a later migration adds one, this fails so the owner
-- decides deliberately (docs/dev-notes.md), instead of it arriving quietly.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select is(
  (select coalesce(string_agg(c.relname || coalesce('.' || a.attname, ''), ', '), '')
   from pg_class c
   left join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     and a.attname ~* '(cycle|menstru|period|ovulat|fertil|luteal|follicul)'
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
     and (c.relname ~* '(cycle|menstru|period|ovulat|fertil|luteal|follicul)' or a.attname is not null)),
  '',
  'no table or column in public is named for cycle data');

select is(
  (select count(*)::int from storage.buckets where id ~* '(cycle|menstru|period|health)'),
  0,
  'no storage bucket is meant for cycle data');

select * from finish();
rollback;
