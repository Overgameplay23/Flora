-- Add per-user pet name and allow owners to update it.

alter table public.pet
  add column if not exists pet_name text;

alter table public.pet
  drop constraint if exists pet_pet_name_length;

alter table public.pet
  add constraint pet_pet_name_length
  check (pet_name is null or char_length(btrim(pet_name)) between 1 and 24);

alter table public.pet enable row level security;

drop policy if exists pet_update_own on public.pet;

create policy pet_update_own
  on public.pet
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant update (pet_name) on table public.pet to authenticated;
