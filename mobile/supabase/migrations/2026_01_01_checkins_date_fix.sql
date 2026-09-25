-- Ensure checkins.date exists and is populated for legacy tables.
alter table public.checkins add column if not exists date date;
alter table public.checkins add column if not exists win_text text;
alter table public.checkins add column if not exists mood_score integer;

update public.checkins
set date = coalesce(date, created_at::date)
where date is null;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'checkins' and column_name = 'note') then
    update public.checkins set win_text = coalesce(win_text, note) where win_text is null;
  end if;
end$$;

create unique index if not exists checkins_user_date_idx on public.checkins (user_id, date);
