-- Rainbow Bridge memorial mode (restoration change set 6.20): when a real pet has passed away the
-- garden becomes a quiet memorial and the daily loop pauses. The client also keeps a device copy so an
-- older database without these columns behaves the same.

alter table public.pet
  add column if not exists memorial_at date;

alter table public.pet
  add column if not exists memorial_note text;

alter table public.pet
  drop constraint if exists pet_memorial_note_length;

alter table public.pet
  add constraint pet_memorial_note_length
  check (memorial_note is null or char_length(memorial_note) <= 280);

grant update (memorial_at, memorial_note) on table public.pet to authenticated;
