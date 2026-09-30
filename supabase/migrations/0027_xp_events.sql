-- Earned XP ledger.
-- Spec: specs/010-gamification-foundation FR-001 – FR-007.
--
-- XP is awarded by the database, from triggers on the tables the app already
-- writes. The client never writes here (RLS: select own only). Every award
-- has a source_key that is unique per user, so offline replays, retries and
-- repeated upserts are no-ops.
--
-- MUST stay in lockstep with lib/xp.ts (the client's optimistic mirror).

create table if not exists public.xp_events (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  kind        text        not null,
  source_key  text        not null check (length(source_key) <= 200),
  xp          integer     not null check (xp >= 0),
  local_date  date        not null,
  created_at  timestamptz not null default now(),
  unique (user_id, source_key)
);

create index if not exists xp_events_user_kind_date_idx
  on public.xp_events (user_id, kind, local_date);

alter table public.xp_events enable row level security;

create policy "xp_events_select_own"
  on public.xp_events for select
  using ((select auth.uid()) = user_id);
-- No insert/update/delete policies: writes only via award_xp()/revoke_xp().

-- Total per user. security_invoker, so the RLS above applies to readers.
create or replace view public.user_xp
with (security_invoker = true) as
  select user_id, coalesce(sum(xp), 0)::integer as total
  from public.xp_events
  group by user_id;

grant select on public.user_xp to authenticated;

-- ── Award / revoke ──────────────────────────────────────────────────

-- Kinds that earn a one-time +50 "first time" bonus.
create or replace function public.xp_first_bonus_kinds()
returns text[]
language sql immutable
set search_path = public, pg_temp
as $$
  select array['subtask_done','goal_completed','ritual_locked','must_do_done',
               'ritual_closed','habit_done','journal_entry'];
$$;

create or replace function public.award_xp(
  p_user_id uuid, p_kind text, p_source_key text, p_local_date date,
  p_xp integer, p_daily_cap integer default null
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

  insert into public.xp_events (user_id, kind, source_key, xp, local_date)
  values (p_user_id, p_kind, p_source_key, amount, p_local_date)
  on conflict (user_id, source_key) do nothing;

  if p_kind = any(public.xp_first_bonus_kinds()) then
    insert into public.xp_events (user_id, kind, source_key, xp, local_date)
    values (p_user_id, 'first_bonus', 'first:' || p_kind, 50, p_local_date)
    on conflict (user_id, source_key) do nothing;
  end if;
end;
$$;

create or replace function public.revoke_xp(p_user_id uuid, p_source_key text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.xp_events where user_id = p_user_id and source_key = p_source_key;
$$;

-- Streak milestones: 7/30/100/365 days, once ever each.
create or replace function public.award_streak_milestones(p_user_id uuid, p_local_date date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s integer := public.compute_streak(p_user_id, p_local_date);
  m record;
begin
  for m in select * from (values (7, 50), (30, 200), (100, 500), (365, 1500)) v(days, xp) loop
    if s >= m.days then
      perform public.award_xp(p_user_id, 'streak_milestone', 'milestone:' || m.days, p_local_date, m.xp);
    end if;
  end loop;
end;
$$;

-- ── Triggers ────────────────────────────────────────────────────────

create or replace function public.xp_on_subtask()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    perform public.award_xp(new.user_id, 'subtask_done', 'subtask:' || new.id,
                            public.user_local_date(new.user_id), 10, 10);
  elsif tg_op = 'UPDATE' and old.done and not new.done then
    perform public.revoke_xp(new.user_id, 'subtask:' || new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists goal_subtasks_award_xp on public.goal_subtasks;
create trigger goal_subtasks_award_xp
  after insert or update of done on public.goal_subtasks
  for each row execute function public.xp_on_subtask();

create or replace function public.xp_on_goal()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    perform public.award_xp(new.user_id, 'goal_completed', 'goal:' || new.id,
                            public.user_local_date(new.user_id, new.completed_at), 100, 3);
  elsif tg_op = 'UPDATE' and old.completed_at is not null and new.completed_at is null then
    perform public.revoke_xp(new.user_id, 'goal:' || new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists goals_award_xp on public.goals;
create trigger goals_award_xp
  after insert or update of completed_at on public.goals
  for each row execute function public.xp_on_goal();

create or replace function public.xp_on_habit_log()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  k text := 'habit:' || new.habit_id || ':' || new.date;
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    perform public.award_xp(new.user_id, 'habit_done', k, new.date, 5, 10);
  elsif tg_op = 'UPDATE' and old.done and not new.done then
    perform public.revoke_xp(new.user_id, k);
  end if;
  return new;
end;
$$;

drop trigger if exists habit_logs_award_xp on public.habit_logs;
create trigger habit_logs_award_xp
  after insert or update of done on public.habit_logs
  for each row execute function public.xp_on_habit_log();

create or replace function public.xp_on_daily_intention()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    perform public.award_xp(new.user_id, 'ritual_locked', 'lock:' || new.date, new.date, 15);
  end if;

  if new.must_do_done and (tg_op = 'INSERT' or not old.must_do_done) then
    perform public.award_xp(new.user_id, 'must_do_done', 'mustdo:' || new.date, new.date, 15);
  elsif tg_op = 'UPDATE' and old.must_do_done and not new.must_do_done then
    perform public.revoke_xp(new.user_id, 'mustdo:' || new.date);
  end if;

  if new.closed_at is not null and (tg_op = 'INSERT' or old.closed_at is null) then
    perform public.award_xp(new.user_id, 'ritual_closed', 'close:' || new.date, new.date, 20);
  end if;

  if new.must_do_done or new.closed_at is not null then
    perform public.award_streak_milestones(new.user_id, new.date);
  end if;
  return new;
end;
$$;

drop trigger if exists daily_intentions_award_xp on public.daily_intentions;
create trigger daily_intentions_award_xp
  after insert or update of must_do_done, closed_at on public.daily_intentions
  for each row execute function public.xp_on_daily_intention();

create or replace function public.xp_on_journal_entry()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.award_xp(new.user_id, 'journal_entry', 'journal:' || new.date, new.date, 10);
  return new;
end;
$$;

drop trigger if exists journal_entries_award_xp on public.journal_entries;
create trigger journal_entries_award_xp
  after insert on public.journal_entries
  for each row execute function public.xp_on_journal_entry();

-- ── Lock down (same policy as 0018) ─────────────────────────────────
revoke execute on function public.xp_first_bonus_kinds()                               from public, anon, authenticated;
revoke execute on function public.award_xp(uuid, text, text, date, integer, integer)   from public, anon, authenticated;
revoke execute on function public.revoke_xp(uuid, text)                                from public, anon, authenticated;
revoke execute on function public.award_streak_milestones(uuid, date)                  from public, anon, authenticated;
revoke execute on function public.xp_on_subtask()                                      from public, anon, authenticated;
revoke execute on function public.xp_on_goal()                                         from public, anon, authenticated;
revoke execute on function public.xp_on_habit_log()                                    from public, anon, authenticated;
revoke execute on function public.xp_on_daily_intention()                              from public, anon, authenticated;
revoke execute on function public.xp_on_journal_entry()                                from public, anon, authenticated;
