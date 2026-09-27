-- Forward migration (2026-09-27): who may execute functions in public.
-- Source: docs/backend/STAGING_PLAN.md P0 #1 (R-39, verified 2026-09-27).
--
-- Earlier migrations ran `revoke ... from public` and then granted `authenticated`, but Supabase's default
-- privileges had already granted EXECUTE to `anon` explicitly, so every RPC stayed callable without a
-- session. The worst case was consume_pet_chat_quota, which trusts its p_user_id argument: anyone could
-- use up any user's pet-talk allowance for the day.

-- nothing in public is callable without a session
revoke execute on all functions in schema public from anon, public;

-- the RPCs the app calls (each raises "Not authenticated" without a user and acts only on auth.uid())
grant execute on function public.complete_task(text, timestamptz, date) to authenticated;
grant execute on function public.get_garden_points() to authenticated;
grant execute on function public.upgrade_plant(text) to authenticated;
grant execute on function public.log_event_and_rollup(text, timestamptz, uuid, text, integer, integer, jsonb, date) to authenticated;
grant execute on function public.recompute_pet_state(date) to authenticated;

-- the daily chat counter belongs to the server: only Edge Functions (service role) may move it
revoke execute on function public.consume_pet_chat_quota(uuid, date, integer) from authenticated;
grant execute on function public.consume_pet_chat_quota(uuid, date, integer) to service_role;

-- functions created later by migrations: no EXECUTE for anon, and none for PUBLIC unless granted.
-- The PUBLIC default can only be revoked globally (not per schema), so this applies to every schema
-- for functions created by postgres. New RPCs must grant `authenticated` explicitly.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;
