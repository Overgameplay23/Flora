-- Supabase lint 0011: pin search_path on the remaining helper functions.
-- Applied to Bloom on 2026-10-02 as migration 20261002014442_pin_function_search_path.
alter function public.set_updated_at() set search_path = public;
alter function public.seed_default_tasks() set search_path = public;
alter function public.clamp_local_day(date, timestamptz) set search_path = public;
alter function public.clamp_client_instant(timestamptz) set search_path = public;
