-- Pet photos: the `pets` bucket is private and each person can read and write only objects under their
-- own user-id folder (<uid>/original.<ext>, <uid>/processed/*.png). The Storage API signs, downloads and
-- uploads with the caller's role, so these row-level checks are what decides who may fetch a photo.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@photos.test', now(), now()),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@photos.test', now(), now());

create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.act_as(who uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
end $$;
create function tests.photo_rows(prefix text) returns int language sql as $$
  select count(*)::int from storage.objects where bucket_id = 'pets' and name like prefix || '%'
$$;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------------------------------------------------------------- bucket
select is((select public from storage.buckets where id = 'pets'), false, 'the pets bucket is private');
select is((select file_size_limit from storage.buckets where id = 'pets'), 10485760::bigint, 'the pets bucket caps uploads at 10 MiB');
select ok((select 'image/jpeg' = any (allowed_mime_types) and not ('text/html' = any (allowed_mime_types)) from storage.buckets where id = 'pets'),
          'the pets bucket accepts images only');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and (qual like '%pets%' or with_check like '%pets%') and roles <> '{authenticated}'::name[]),
          0, 'no pets storage policy applies to anon or public');

-- ---------------------------------------------------------------- each owner uploads into their own folder
select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('pets', 'aaaaaaaa-0000-4000-8000-00000000000a/original.jpg', 'aaaaaaaa-0000-4000-8000-00000000000a')$$,
                'A can upload its original photo under its own folder');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('pets', 'aaaaaaaa-0000-4000-8000-00000000000a/processed/cutout.png', 'aaaaaaaa-0000-4000-8000-00000000000a')$$,
                'A can upload a processed image under its own folder');
select tests.act_as('bbbbbbbb-0000-4000-8000-00000000000b');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('pets', 'bbbbbbbb-0000-4000-8000-00000000000b/original.jpg', 'bbbbbbbb-0000-4000-8000-00000000000b')$$,
                'B can upload its original photo under its own folder');

-- ---------------------------------------------------------------- A cannot read or change B's photos
select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a');
select is(tests.photo_rows('aaaaaaaa-0000-4000-8000-00000000000a/'), 2, 'A can read its own photos');
select is(tests.photo_rows('bbbbbbbb-0000-4000-8000-00000000000b/'), 0, 'A cannot read B''s photos (so cannot sign or download them)');
select is(tests.photo_rows(''), 2, 'A sees only its own objects in the bucket');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('pets', 'bbbbbbbb-0000-4000-8000-00000000000b/original.jpg')$$,
                 '42501', null, 'A cannot write into B''s folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('pets', 'original/aaaaaaaa-0000-4000-8000-00000000000a.jpg')$$,
                 '42501', null, 'A cannot write outside a user folder (the old original/<uid> layout)');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('pets', 'shared/aaaaaaaa-0000-4000-8000-00000000000a/x.png')$$,
                 '42501', null, 'the user id must be the first path segment');
select is_empty($$update storage.objects set metadata = '{"tampered":true}' where name like 'bbbbbbbb-0000-4000-8000-00000000000b/%' returning name$$,
                'A cannot update B''s photos');
select is_empty($$delete from storage.objects where name like 'bbbbbbbb-0000-4000-8000-00000000000b/%' returning name$$,
                'A cannot delete B''s photos');
select throws_ok($$update storage.objects set name = 'bbbbbbbb-0000-4000-8000-00000000000b/planted.jpg' where name = 'aaaaaaaa-0000-4000-8000-00000000000a/original.jpg'$$,
                 '42501', null, 'A cannot move its photo into B''s folder');

-- ---------------------------------------------------------------- owners manage their own photos
select lives_ok($$update storage.objects set metadata = '{"note":"mine"}' where name = 'aaaaaaaa-0000-4000-8000-00000000000a/original.jpg'$$,
                'A can update its own photo');
select lives_ok($$delete from storage.objects where name = 'aaaaaaaa-0000-4000-8000-00000000000a/processed/cutout.png'$$,
                'A can delete its own photo');

-- ---------------------------------------------------------------- no session
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(tests.photo_rows(''), 0, 'anon cannot see any pet photo');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('pets', 'anon/x.png')$$, '42501', null, 'anon cannot upload');

reset role;
select is(tests.photo_rows('bbbbbbbb-0000-4000-8000-00000000000b/'), 1, 'B''s photo is intact after A''s attempts');
select * from finish();
rollback;
