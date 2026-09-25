-- Journal (restoration change set 6.22): a plain private journal with the pet's daily prompt.
-- The original screen inserted into public.journal_entries, which no migration ever created, and then
-- called an external "aiPrompt" API that no longer exists. This creates the table (keeping the old
-- columns so an older hosted table with the same name stays compatible) and locks it to its owner.
-- The client keeps a device copy as well, so an older database without the table still works.

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_text text,
  entry_audio_url text,
  mood_score integer,
  follow_up text,
  created_at timestamptz not null default now()
);

alter table public.journal_entries add column if not exists entry_date date;
alter table public.journal_entries add column if not exists prompt text;
alter table public.journal_entries add column if not exists entry_text text;
alter table public.journal_entries add column if not exists created_at timestamptz not null default now();

create index if not exists journal_entries_user_created_idx
  on public.journal_entries (user_id, created_at desc);

alter table public.journal_entries enable row level security;

drop policy if exists journal_entries_select_own on public.journal_entries;
create policy journal_entries_select_own on public.journal_entries
  for select using (auth.uid() = user_id);

drop policy if exists journal_entries_insert_own on public.journal_entries;
create policy journal_entries_insert_own on public.journal_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists journal_entries_update_own on public.journal_entries;
create policy journal_entries_update_own on public.journal_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists journal_entries_delete_own on public.journal_entries;
create policy journal_entries_delete_own on public.journal_entries
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on table public.journal_entries to authenticated;
