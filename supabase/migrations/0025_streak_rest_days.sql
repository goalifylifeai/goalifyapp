-- Rest days for the daily ritual streak.
-- Spec: specs/010-gamification-foundation (FR-011 – FR-015).
--
-- Mirrors lib/date.ts streakState() exactly. Both are tested against
-- __tests__/fixtures/streak-cases.json (see supabase/tests/streak_parity.sql).
--
-- Rules:
--   * An active day = must_do_done OR closed_at IS NOT NULL (unchanged).
--   * Every 7 consecutive active days earns one rest day; hold at most 1.
--   * A missed day consumes a held rest day automatically: the streak
--     survives but doesn't grow. A miss with none held resets to 0.
--   * p_asof itself only ever adds: if it isn't active yet, the streak is
--     measured through the day before. (The old compute_streak returned 0
--     for a user who had locked the morning but not yet done the must-do,
--     so circle-mates saw a 0 streak all morning. This fixes that.)
--   * 400-day window, same as the client (STREAK_HISTORY_DAYS).

create or replace function public.compute_streak_state(
  p_user_id uuid,
  p_asof date,
  out streak integer,
  out rest_days_held integer,
  out rest_dates date[]
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c_every  constant integer := 7;
  c_max    constant integer := 1;
  c_window constant integer := 400;
  active   date[];
  d        date;
begin
  streak := 0;
  rest_days_held := 0;
  rest_dates := '{}';

  select coalesce(array_agg(di.date), '{}') into active
  from public.daily_intentions di
  where di.user_id = p_user_id
    and di.date between p_asof - c_window and p_asof
    and (di.must_do_done or di.closed_at is not null);

  d := p_asof - c_window;
  while d < p_asof loop
    if d = any(active) then
      streak := streak + 1;
      if streak % c_every = 0 then
        rest_days_held := least(c_max, rest_days_held + 1);
      end if;
    elsif streak > 0 and rest_days_held > 0 then
      rest_days_held := rest_days_held - 1;
      rest_dates := rest_dates || d;
    else
      streak := 0;
      rest_days_held := 0;
    end if;
    d := d + 1;
  end loop;

  if p_asof = any(active) then
    streak := streak + 1;
    if streak % c_every = 0 then
      rest_days_held := least(c_max, rest_days_held + 1);
    end if;
  end if;
end;
$$;

-- Keep the old signature: the circle triggers (0014) call it.
create or replace function public.compute_streak(p_user_id uuid, p_asof date)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (public.compute_streak_state(p_user_id, p_asof)).streak;
$$;

-- Definer helpers are internal only (same policy as 0018).
revoke execute on function public.compute_streak_state(uuid, date) from public, anon, authenticated;
revoke execute on function public.compute_streak(uuid, date)       from public, anon, authenticated;

-- Recompute stored circle streaks for recent days so friends see the new
-- rule immediately (FR-015). Older rows are history and are left as-is.
update public.circle_daily_status cds
set streak = public.compute_streak(cds.user_id, cds.date),
    updated_at = now()
where cds.date >= current_date - 2;
