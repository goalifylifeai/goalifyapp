-- XP ledger behaviour tests (spec 010, FR-001 – FR-007, Story 2).
--
-- Run against a local Supabase DB (never production):
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/xp_ledger.sql
--
-- One transaction, rolled back at the end. Raises on the first failure.

begin;

create or replace function pg_temp.eq(label text, got bigint, want bigint) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL %: got %, want %', label, got, want;
  end if;
end $$;

create or replace function pg_temp.total(u uuid) returns bigint
language sql as $$ select coalesce(sum(xp), 0) from public.xp_events where user_id = u $$;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000b2'),
  ('00000000-0000-4000-8000-0000000000c3');
update public.profiles set timezone = 'Europe/Berlin' where user_id = '00000000-0000-4000-8000-0000000000a1';
update public.profiles set timezone = 'Not/AZone'    where user_id = '00000000-0000-4000-8000-0000000000b2';

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-0000000000a1';
  g uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  h uuid := gen_random_uuid();
  i integer;
  today date := public.user_local_date(a);
begin
  -- Subtasks: award, first bonus, revoke, re-award, no double award ------
  insert into public.goals (id, user_id, sphere, title) values (g, a, 'health', 'Run a 10k');
  perform pg_temp.eq('new goal earns nothing', pg_temp.total(a), 0);

  insert into public.goal_subtasks (id, goal_id, user_id, text, done) values (s, g, a, 'Buy shoes', false);
  update public.goal_subtasks set done = true where id = s;
  perform pg_temp.eq('subtask + first bonus', pg_temp.total(a), 60);

  update public.goal_subtasks set done = true where id = s;            -- repeated upsert
  perform pg_temp.eq('same state again is a no-op', pg_temp.total(a), 60);

  update public.goal_subtasks set done = false where id = s;
  perform pg_temp.eq('uncheck revokes (bonus stays)', pg_temp.total(a), 50);
  update public.goal_subtasks set done = true where id = s;
  perform pg_temp.eq('recheck re-awards', pg_temp.total(a), 60);

  -- Daily cap: 10 subtasks/day with XP (1 already) -----------------------
  for i in 1..12 loop
    insert into public.goal_subtasks (goal_id, user_id, text, done) values (g, a, 'st ' || i, true);
  end loop;
  perform pg_temp.eq('subtask cap = 10 per day', pg_temp.total(a), 50 + 10 * 10);
  perform pg_temp.eq('capped events kept at 0 XP',
    (select count(*) from public.xp_events where user_id = a and kind = 'subtask_done' and xp = 0), 3);

  -- Goals: complete, uncomplete, complete -------------------------------
  update public.goals set completed_at = now() where id = g;
  perform pg_temp.eq('goal complete + first bonus', pg_temp.total(a), 150 + 150);
  update public.goals set completed_at = null where id = g;
  perform pg_temp.eq('uncomplete revokes', pg_temp.total(a), 150 + 50);
  update public.goals set completed_at = now() where id = g;
  perform pg_temp.eq('recomplete', pg_temp.total(a), 300);

  -- Habits: upsert pattern used by store/sync.ts ------------------------
  insert into public.habits (id, user_id, label, icon, sphere, target_description)
    values (h, a, 'Stretch', 'x', 'health', 'daily');
  insert into public.habit_logs (habit_id, user_id, date, done) values (h, a, today, true)
    on conflict (habit_id, date) do update set done = excluded.done;
  perform pg_temp.eq('habit + first bonus', pg_temp.total(a), 355);
  insert into public.habit_logs (habit_id, user_id, date, done) values (h, a, today, false)
    on conflict (habit_id, date) do update set done = excluded.done;
  perform pg_temp.eq('habit uncheck revokes', pg_temp.total(a), 350);

  -- Rituals ---------------------------------------------------------------
  insert into public.daily_intentions (user_id, date, focus_sphere) values (a, today, 'health');
  perform pg_temp.eq('lock + first', pg_temp.total(a), 415);
  update public.daily_intentions set must_do_done = true where user_id = a and date = today;
  perform pg_temp.eq('must-do + first', pg_temp.total(a), 480);
  update public.daily_intentions set closed_at = now() where user_id = a and date = today;
  perform pg_temp.eq('close + first', pg_temp.total(a), 550);

  -- Journal: one per day --------------------------------------------------
  insert into public.journal_entries (user_id, date, excerpt, sentiment) values (a, today, 'good day', 0.5);
  insert into public.journal_entries (user_id, date, excerpt, sentiment) values (a, today, 'second', 0.1);
  perform pg_temp.eq('journal once/day + first', pg_temp.total(a), 610);

  -- Deleting a goal keeps XP (FR-006) -------------------------------------
  delete from public.goals where id = g;
  perform pg_temp.eq('goal delete keeps XP', pg_temp.total(a), 610);

  -- Streak milestone at 7 days -------------------------------------------
  for i in reverse 6..1 loop                -- oldest first, as in real life
    insert into public.daily_intentions (user_id, date, focus_sphere, must_do_done)
      values (a, today - i, 'health', true);
  end loop;
  perform pg_temp.eq('6 back-days: lock + must-do each', pg_temp.total(a), 610 + 6 * 30);
  update public.daily_intentions set closed_at = closed_at where user_id = a and date = today;
  perform pg_temp.eq('streak 7 reached today -> milestone', pg_temp.total(a), 790 + 50);
  perform pg_temp.eq('7-day milestone once',
    (select count(*) from public.xp_events where user_id = a and source_key = 'milestone:7'), 1);

  -- Bad time zone falls back to UTC instead of failing the write ---------
  perform pg_temp.eq('bad tz falls back',
    (public.user_local_date('00000000-0000-4000-8000-0000000000b2') = (now() at time zone 'UTC')::date)::int, 1);
end $$;

-- RLS: users read only their own events and can't write any ------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);
do $$
begin
  perform pg_temp.eq('B sees none of A''s events', (select count(*) from public.xp_events), 0);
  perform pg_temp.eq('B sees no A total', (select count(*) from public.user_xp), 0);
  begin
    insert into public.xp_events (user_id, kind, source_key, xp, local_date)
      values ('00000000-0000-4000-8000-0000000000b2', 'x', 'cheat', 99999, current_date);
    raise exception 'FAIL client insert was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.award_xp('00000000-0000-4000-8000-0000000000b2', 'x', 'cheat', current_date, 99999);
    raise exception 'FAIL client could call award_xp';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
do $$ begin
  perform pg_temp.eq('A reads own total via view', (select total from public.user_xp), 840);
end $$;
reset role;

-- Backfill + carryover (Story 2) ------------------------------------------
-- C has history written with XP triggers off (as if before this release).
set local session_replication_role = replica;
do $$
declare
  c constant uuid := '00000000-0000-4000-8000-0000000000c3';
  g1 uuid := gen_random_uuid();
  i integer;
begin
  insert into public.goals (id, user_id, sphere, title) values (g1, c, 'career', 'Ship');
  -- 4 subtasks, 3 done -> progress .75 -> old score 75 -> old XP 3750
  insert into public.goal_subtasks (goal_id, user_id, text, done)
    select g1, c, 's' || n, n <= 3 from generate_series(1, 4) n;
  for i in 0..2 loop
    insert into public.daily_intentions (user_id, date, focus_sphere, must_do_done, closed_at)
      values (c, current_date - i, 'career', true, now());
  end loop;
end $$;
set local session_replication_role = origin;

\ir ../migrations/0028_xp_backfill.sql

do $$
declare
  c constant uuid := '00000000-0000-4000-8000-0000000000c3';
begin
  -- earned: 3 subtasks 30 + first 50; 3 days x (15+15+20) = 150 + firsts 150
  perform pg_temp.eq('backfilled + carryover = old XP (no demotion)', pg_temp.total(c), 3750);
  perform pg_temp.eq('carryover amount',
    (select xp from public.xp_events where user_id = c and kind = 'carryover'), 3750 - 380);
end $$;

\ir ../migrations/0028_xp_backfill.sql

do $$ begin
  perform pg_temp.eq('backfill is idempotent', pg_temp.total('00000000-0000-4000-8000-0000000000c3'), 3750);
  raise notice 'xp ledger: all checks pass';
end $$;

rollback;
