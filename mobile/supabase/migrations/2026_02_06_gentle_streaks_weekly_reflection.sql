-- Gentle streaks + weekly reflection profile metadata.
alter table public.profiles
  add column if not exists current_streak integer not null default 0,
  add column if not exists best_streak integer not null default 0,
  add column if not exists last_reflection_viewed_week text;

-- Keep existing streak values aligned with the new fields.
update public.profiles
set current_streak = coalesce(current_streak, streak_count, 0);

update public.profiles
set best_streak = greatest(
  coalesce(best_streak, 0),
  coalesce(current_streak, 0),
  coalesce(streak_count, 0)
);
