create table if not exists public.pet_stylize_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_requested_at timestamptz not null default now(),
  last_source_hash text
);

alter table public.pet_stylize_requests enable row level security;

drop policy if exists "pet stylize requests read" on public.pet_stylize_requests;
drop policy if exists "pet stylize requests insert" on public.pet_stylize_requests;
drop policy if exists "pet stylize requests update" on public.pet_stylize_requests;

create policy "pet stylize requests read"
on public.pet_stylize_requests
for select
using (auth.uid() = user_id);

create policy "pet stylize requests insert"
on public.pet_stylize_requests
for insert
with check (auth.uid() = user_id);

create policy "pet stylize requests update"
on public.pet_stylize_requests
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
