-- Restoration compatibility objects.
-- Everything here is something the CLIENT already reads or writes but that no SQL in
-- supabase/schema_*.sql or supabase/migrations/*.sql ever defined
-- (docs/RESTORATION_BASELINE.md, sections 5.3 and R-13 / R-15).
-- Idempotent. Intended for the local development stack first; review before using on a hosted project.

-- 1) pet.original_photo_url: selected by src/services/petService.js (PET_SELECT_NEW) and written by
--    src/services/petStylize.js. Without it every pet read/write degrades to the "legacy" fallback.
alter table public.pet
  add column if not exists original_photo_url text;

-- 2) Storage bucket "pets".
--    The current client uploads original/<uid>.<ext> and processed/<uid>/{stylized,cutout,mask}.png and
--    reads processed files through getPublicUrl(), which only works on a PUBLIC bucket.
--    That mirrors today's code, not the target design: baseline risks R-13/R-14 call for a private
--    bucket with short-lived signed URLs. Revisit before any hosted deployment.
insert into storage.buckets (id, name, public)
values ('pets', 'pets', true)
on conflict (id) do nothing;

-- Writes and listing are limited to the caller's own paths. Public reads of a public bucket bypass RLS.
drop policy if exists "pets_select_own" on storage.objects;
create policy "pets_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pets'
    and (
      name like 'original/' || auth.uid()::text || '.%'
      or name like 'processed/' || auth.uid()::text || '/%'
    )
  );

drop policy if exists "pets_insert_own" on storage.objects;
create policy "pets_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pets'
    and (
      name like 'original/' || auth.uid()::text || '.%'
      or name like 'processed/' || auth.uid()::text || '/%'
    )
  );

drop policy if exists "pets_update_own" on storage.objects;
create policy "pets_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pets'
    and (
      name like 'original/' || auth.uid()::text || '.%'
      or name like 'processed/' || auth.uid()::text || '/%'
    )
  )
  with check (
    bucket_id = 'pets'
    and (
      name like 'original/' || auth.uid()::text || '.%'
      or name like 'processed/' || auth.uid()::text || '/%'
    )
  );

drop policy if exists "pets_delete_own" on storage.objects;
create policy "pets_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pets'
    and (
      name like 'original/' || auth.uid()::text || '.%'
      or name like 'processed/' || auth.uid()::text || '/%'
    )
  );
