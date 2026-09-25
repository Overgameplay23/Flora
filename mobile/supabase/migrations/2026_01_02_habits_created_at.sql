alter table public.habits
  add column if not exists created_at timestamptz;

update public.habits
  set created_at = now()
  where created_at is null;

alter table public.habits
  alter column created_at set default now(),
  alter column created_at set not null;
