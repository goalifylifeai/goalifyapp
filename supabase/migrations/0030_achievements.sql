-- Achievements + sphere on the XP ledger.
-- Spec: specs/012-levels-achievements (FR-001 – FR-004).
--
-- 1. xp_events.sphere: which life area an event belongs to, set by the award
--    triggers (needed for "Balanced week"). Backfilled where the source row
--    still exists.
-- 2. user_achievements: unlocked achievements, written only by
--    evaluate_achievements() from a trigger on xp_events. Permanent: nothing
--    revokes them (the source event may be undone later; the achievement
--    stays). They grant no XP, so the 010 economy is unchanged.
--
-- Keys MUST stay in lockstep with lib/achievements.ts.

-- ── 1. Sphere on the ledger ─────────────────────────────────────────

alter table public.xp_events
  add column if not exists sphere text
  check (sphere is null or sphere in ('finance','health','career','relationships'));

-- award_xp gains p_sphere. Drop the old signature so no caller can keep
-- reaching a version that ignores the sphere.
drop function if exists public.award_xp(uuid, text, text, date, integer, integer);

create or replace function public.award_xp(
  p_user_id uuid, p_kind text, p_source_key text, p_local_date date,
  p_xp integer, p_daily_cap integer default null, p_sphere text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  used integer;
  amount integer := p_xp;
begin
  -- Serialise per user so two concurrent writes can't both slip under a cap.
  perform pg_advisory_xact_lock(hashtextextended('xp:' || p_user_id::text, 0));

  if p_daily_cap is not null then
    select count(*) into used from public.xp_events
    where user_id = p_user_id and kind = p_kind and local_date = p_local_date and xp > 0;
    if used >= p_daily_cap then
      amount := 0;   -- keep the event (explainable ledger), award nothing
    end if;
  end if;

  insert into public.xp_events (user_id, kind, source_key, xp, local_date, sphere)
  values (p_user_id, p_kind, p_source_key, amount, p_local_date, p_sphere)
  on conflict (user_id, source_key) do nothing;

  if p_kind = any(public.xp_first_bonus_kinds()) then
    insert into public.xp_events (user_id, kind, source_key, xp, local_date)
    values (p_user_id, 'first_bonus', 'first:' || p_kind, 50, p_local_date)
    on conflict (user_id, source_key) do nothing;
  end if;
end;
$$;

create or replace function public.xp_on_subtask()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s text;
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    select sphere into s from public.goals where id = new.goal_id;
    perform public.award_xp(new.user_id, 'subtask_done', 'subtask:' || new.id,
                            public.user_local_date(new.user_id), 10, 10, s);
  elsif tg_op = 'UPDATE' and old.done and not new.done then
    perform public.revoke_xp(new.user_id, 'subtask:' || new.id);
  end if;
  return new;
end;
$$;

create or replace function public.xp_on_goal()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    perform public.award_xp(new.user_id, 'goal_completed', 'goal:' || new.id,
                            public.user_local_date(new.user_id, new.completed_at), 100, 3, new.sphere);
  elsif tg_op = 'UPDATE' and old.completed_at is not null and new.completed_at is null then
    perform public.revoke_xp(new.user_id, 'goal:' || new.id);
  end if;
  return new;
end;
$$;

create or replace function public.xp_on_habit_log()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  k text := 'habit:' || new.habit_id || ':' || new.date;
  s text;
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    select sphere into s from public.habits where id = new.habit_id;
    perform public.award_xp(new.user_id, 'habit_done', k, new.date, 5, 10, s);
  elsif tg_op = 'UPDATE' and old.done and not new.done then
    perform public.revoke_xp(new.user_id, k);
  end if;
  return new;
end;
$$;

create or replace function public.xp_on_daily_intention()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    perform public.award_xp(new.user_id, 'ritual_locked', 'lock:' || new.date, new.date, 15, null, new.focus_sphere);
  end if;

  if new.must_do_done and (tg_op = 'INSERT' or not old.must_do_done) then
    perform public.award_xp(new.user_id, 'must_do_done', 'mustdo:' || new.date, new.date, 15, null, new.focus_sphere);
  elsif tg_op = 'UPDATE' and old.must_do_done and not new.must_do_done then
    perform public.revoke_xp(new.user_id, 'mustdo:' || new.date);
  end if;

  if new.closed_at is not null and (tg_op = 'INSERT' or old.closed_at is null) then
    perform public.award_xp(new.user_id, 'ritual_closed', 'close:' || new.date, new.date, 20, null, new.focus_sphere);
  end if;

  if new.must_do_done or new.closed_at is not null then
    perform public.award_streak_milestones(new.user_id, new.date);
  end if;
  return new;
end;
$$;

-- Backfill sphere where the source row still exists.
update public.xp_events e set sphere = g.sphere
  from public.goal_subtasks s join public.goals g on g.id = s.goal_id
  where e.sphere is null and e.kind = 'subtask_done' and e.user_id = s.user_id
    and e.source_key = 'subtask:' || s.id;

update public.xp_events e set sphere = g.sphere
  from public.goals g
  where e.sphere is null and e.kind = 'goal_completed' and e.user_id = g.user_id
    and e.source_key = 'goal:' || g.id;

update public.xp_events e set sphere = h.sphere
  from public.habits h
  where e.sphere is null and e.kind = 'habit_done' and e.user_id = h.user_id
    and e.source_key like 'habit:' || h.id || ':%';

update public.xp_events e set sphere = d.focus_sphere
  from public.daily_intentions d
  where e.sphere is null and e.user_id = d.user_id
    and e.kind in ('ritual_locked', 'must_do_done', 'ritual_closed')
    and e.source_key in ('lock:' || d.date, 'mustdo:' || d.date, 'close:' || d.date);

-- ── 2. Achievements ─────────────────────────────────────────────────

create table if not exists public.user_achievements (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  key         text        not null check (length(key) <= 60),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own"
  on public.user_achievements for select
  using ((select auth.uid()) = user_id);
-- No insert/update/delete policies: writes only via evaluate_achievements().

grant select on public.user_achievements to authenticated;

-- Inserts every achievement the user now meets. Idempotent. p_kind narrows
-- the work to the families an event of that kind can affect (null = all).
create or replace function public.evaluate_achievements(p_user_id uuid, p_kind text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Firsts: one per first-time bonus row ('first:<kind>' is also the key).
  if p_kind is null or p_kind = 'first_bonus' then
    insert into public.user_achievements (user_id, key, unlocked_at)
    select user_id, source_key, created_at from public.xp_events
    where user_id = p_user_id and kind = 'first_bonus'
    on conflict (user_id, key) do nothing;
  end if;

  -- Streak milestones: 'milestone:<n>' → 'streak:<n>'.
  if p_kind is null or p_kind = 'streak_milestone' then
    insert into public.user_achievements (user_id, key, unlocked_at)
    select user_id, 'streak:' || substr(source_key, length('milestone:') + 1), created_at
    from public.xp_events
    where user_id = p_user_id and kind = 'streak_milestone'
    on conflict (user_id, key) do nothing;
  end if;

  -- Volume: counts of events (capped 0-XP events count; revoked ones are gone).
  if p_kind is null or p_kind in ('goal_completed', 'habit_done', 'ritual_closed') then
    insert into public.user_achievements (user_id, key)
    select p_user_id, t.key
    from (values
      ('goals:5',     'goal_completed',   5),
      ('goals:25',    'goal_completed',  25),
      ('habits:50',   'habit_done',      50),
      ('habits:250',  'habit_done',     250),
      ('evenings:10', 'ritual_closed',   10),
      ('evenings:50', 'ritual_closed',   50)
    ) as t(key, kind, n)
    where (p_kind is null or t.kind = p_kind)
      and (select count(*) from public.xp_events e
           where e.user_id = p_user_id and e.kind = t.kind) >= t.n
    on conflict (user_id, key) do nothing;
  end if;

  -- Balanced week: all four spheres in one ISO week (Mon–Sun, local dates).
  if p_kind is null or p_kind in ('subtask_done', 'goal_completed', 'habit_done', 'must_do_done') then
    insert into public.user_achievements (user_id, key)
    select p_user_id, 'balanced_week'
    where exists (
      select 1 from public.xp_events
      where user_id = p_user_id and sphere is not null
        and kind in ('subtask_done', 'goal_completed', 'habit_done', 'must_do_done')
      group by date_trunc('week', local_date)
      having count(distinct sphere) = 4
    )
    on conflict (user_id, key) do nothing;
  end if;
end;
$$;

create or replace function public.achievements_on_xp_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.evaluate_achievements(new.user_id, new.kind);
  return new;
end;
$$;

drop trigger if exists xp_events_evaluate_achievements on public.xp_events;
create trigger xp_events_evaluate_achievements
  after insert on public.xp_events
  for each row execute function public.achievements_on_xp_event();

-- Backfill for everyone with a ledger. Not celebrated: the app marks
-- everything it sees on first load as already seen (spec 012 Story 1 AS3).
select public.evaluate_achievements(u.user_id) from (select distinct user_id from public.xp_events) u;

-- ── Lock down (same policy as 0018 / 0027) ──────────────────────────
revoke execute on function public.award_xp(uuid, text, text, date, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.xp_on_subtask()                   from public, anon, authenticated;
revoke execute on function public.xp_on_goal()                      from public, anon, authenticated;
revoke execute on function public.xp_on_habit_log()                 from public, anon, authenticated;
revoke execute on function public.xp_on_daily_intention()           from public, anon, authenticated;
revoke execute on function public.evaluate_achievements(uuid, text) from public, anon, authenticated;
revoke execute on function public.achievements_on_xp_event()        from public, anon, authenticated;
