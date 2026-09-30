-- One-off XP backfill from existing history, plus a carryover so nobody is
-- demoted by the switch from "XP = life score × 50" to earned XP.
-- Spec: specs/010-gamification-foundation Story 2, FR-014.
--
-- Idempotent: every award goes through award_xp(), whose unique source_key
-- makes a re-run a no-op. Rows are replayed in time order per kind so the
-- daily caps land on the same items the live triggers would have chosen.
--
-- Known approximations (documented in the spec):
--   * goal_subtasks has no done_at, so updated_at stands in for the day it
--     was checked off.
--   * Deleted goals/subtasks can't be backfilled; the carryover covers them.
--
-- Cost: one function call per historic row. Fine at current volumes; if
-- this is ever re-run at scale, batch it per user instead.

do $$
declare
  r record;
begin
  -- Rituals
  for r in select * from public.daily_intentions order by user_id, date loop
    perform public.award_xp(r.user_id, 'ritual_locked', 'lock:' || r.date, r.date, 15);
    if r.must_do_done then
      perform public.award_xp(r.user_id, 'must_do_done', 'mustdo:' || r.date, r.date, 15);
    end if;
    if r.closed_at is not null then
      perform public.award_xp(r.user_id, 'ritual_closed', 'close:' || r.date, r.date, 20);
    end if;
  end loop;

  -- Habits
  for r in select * from public.habit_logs where done order by user_id, date, created_at loop
    perform public.award_xp(r.user_id, 'habit_done', 'habit:' || r.habit_id || ':' || r.date, r.date, 5, 10);
  end loop;

  -- Journal
  for r in select * from public.journal_entries order by user_id, date, created_at loop
    perform public.award_xp(r.user_id, 'journal_entry', 'journal:' || r.date, r.date, 10);
  end loop;

  -- Completed goals
  for r in select * from public.goals where completed_at is not null order by user_id, completed_at loop
    perform public.award_xp(r.user_id, 'goal_completed', 'goal:' || r.id,
                            public.user_local_date(r.user_id, r.completed_at), 100, 3);
  end loop;

  -- Checked subtasks (updated_at approximates when)
  for r in select * from public.goal_subtasks where done order by user_id, updated_at loop
    perform public.award_xp(r.user_id, 'subtask_done', 'subtask:' || r.id,
                            public.user_local_date(r.user_id, r.updated_at), 10, 10);
  end loop;
end $$;

-- Streak milestones from each user's best-ever streak (same rest-day rules
-- as compute_streak_state, over full history).
do $$
declare
  u record;
  d date;
  s integer;
  held integer;
  best integer;
  active date[];
  m record;
begin
  for u in select user_id, min(date) as first_day
           from public.daily_intentions
           where must_do_done or closed_at is not null
           group by user_id loop
    select array_agg(date) into active from public.daily_intentions
      where user_id = u.user_id and (must_do_done or closed_at is not null);
    s := 0; held := 0; best := 0;
    d := u.first_day;
    while d <= current_date loop
      if d = any(active) then
        s := s + 1;
        if s % 7 = 0 then held := least(1, held + 1); end if;
        best := greatest(best, s);
      elsif d < current_date then          -- today pending never breaks
        if s > 0 and held > 0 then held := held - 1;
        else s := 0; held := 0; end if;
      end if;
      d := d + 1;
    end loop;
    for m in select * from (values (7, 50), (30, 200), (100, 500), (365, 1500)) v(days, xp) loop
      if best >= m.days then
        perform public.award_xp(u.user_id, 'streak_milestone', 'milestone:' || m.days,
                                public.user_local_date(u.user_id), m.xp);
      end if;
    end loop;
  end loop;
end $$;

-- Carryover: make sure earned XP >= the old formula's XP for every user.
-- Old formula (constants/data.ts before this change):
--   goal progress   = done subtasks / max(subtask count, 1)
--   sphere progress = avg over ALL that sphere's goals (completed included)
--   overall         = Math.round(avg over spheres with >= 1 goal × 100)
--   xp              = overall × 50
-- ceil() instead of round() so float-vs-numeric rounding can only ever
-- err in the user's favour.
with goal_progress as (
  select g.user_id, g.sphere,
         coalesce(count(s.id) filter (where s.done), 0)::numeric / greatest(count(s.id), 1) as p
  from public.goals g
  left join public.goal_subtasks s on s.goal_id = g.id
  group by g.id, g.user_id, g.sphere
),
sphere_progress as (
  select user_id, sphere, avg(p) as p from goal_progress group by user_id, sphere
),
old_xp as (
  select user_id, ceil(avg(p) * 100)::integer * 50 as xp
  from sphere_progress group by user_id
),
earned as (
  select user_id, coalesce(sum(xp), 0) as xp from public.xp_events group by user_id
)
insert into public.xp_events (user_id, kind, source_key, xp, local_date)
select o.user_id, 'carryover', 'carryover', o.xp - coalesce(e.xp, 0),
       public.user_local_date(o.user_id)
from old_xp o
left join earned e using (user_id)
where o.xp > coalesce(e.xp, 0)
on conflict (user_id, source_key) do nothing;
