-- Lock down SECURITY DEFINER functions in `public`.
--
-- 0002/0014 revoked EXECUTE from PUBLIC, but Supabase's default privileges
-- also grant EXECUTE directly to anon and authenticated, so every one of
-- these was still callable via /rest/v1/rpc/* — compute_streak, for
-- example, returned any user's streak to an unauthenticated caller.

-- Trigger-only functions. Postgres checks EXECUTE when a trigger is created,
-- not when it fires, so the triggers keep working.
revoke execute on function public.handle_new_user()              from public, anon, authenticated;
revoke execute on function public.sync_circle_daily_status()     from public, anon, authenticated;
revoke execute on function public.backfill_circle_daily_status() from public, anon, authenticated;

-- Only called from the SECURITY DEFINER trigger functions above, which run
-- as the function owner.
revoke execute on function public.compute_streak(uuid, date) from public, anon, authenticated;

-- Needed by signed-in users: is_circle_member is evaluated inside circles RLS
-- policies, and the app calls lookup_circle_by_code to join a circle.
revoke execute on function public.is_circle_member(uuid, uuid) from public, anon;
revoke execute on function public.lookup_circle_by_code(text)  from public, anon;
grant  execute on function public.is_circle_member(uuid, uuid) to authenticated;
grant  execute on function public.lookup_circle_by_code(text)  to authenticated;

-- Advisor: function_search_path_mutable.
alter function public.set_updated_at() set search_path = public, pg_temp;
