-- The user's IANA time zone (e.g. 'Europe/Berlin'), set by the app from
-- expo-localization on sign-in and on foreground.
-- Spec: specs/010-gamification-foundation FR-009.
--
-- Server-side code that needs "the user's today" (XP daily caps) goes
-- through public.user_local_date(), which falls back to UTC for a missing or
-- unknown zone rather than erroring inside a trigger.

alter table public.profiles
  add column if not exists timezone text not null default 'UTC'
  check (length(timezone) between 1 and 64);

create or replace function public.user_local_date(p_user_id uuid, p_at timestamptz default now())
returns date
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  tz text;
begin
  select timezone into tz from public.profiles where user_id = p_user_id;
  begin
    return (p_at at time zone coalesce(tz, 'UTC'))::date;
  exception when others then
    return (p_at at time zone 'UTC')::date;
  end;
end;
$$;

revoke execute on function public.user_local_date(uuid, timestamptz) from public, anon, authenticated;
