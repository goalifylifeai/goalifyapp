-- Streak parity: public.compute_streak_state() vs lib/date.ts streakState().
-- Both must satisfy __tests__/fixtures/streak-cases.json.
--
-- Run against a local Supabase DB (never production):
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 \
--     -v fixtures="$(cat __tests__/fixtures/streak-cases.json)" \
--     -f supabase/tests/streak_parity.sql
--
-- Everything happens in one transaction that is rolled back.

begin;

insert into auth.users (id) values ('00000000-0000-4000-8000-00000000f001');

create temp table fx on commit drop as
select value as c from jsonb_array_elements(:'fixtures'::jsonb);

do $$
declare
  r record;
  uid constant uuid := '00000000-0000-4000-8000-00000000f001';
  got record;
  fails integer := 0;
  total integer := 0;
  exp_rest date[];
begin
  for r in select c from fx loop
    total := total + 1;
    delete from public.daily_intentions where user_id = uid;
    insert into public.daily_intentions (user_id, date, focus_sphere, must_do_done)
    select distinct uid, d::date, 'health', true
    from jsonb_array_elements_text(r.c->'dates') d;

    select * into got from public.compute_streak_state(uid, (r.c->>'today')::date);
    select coalesce(array_agg(x::date order by x), '{}') into exp_rest
      from jsonb_array_elements_text(r.c->'restDates') x;

    if got.streak is distinct from (r.c->>'streak')::int
       or got.rest_days_held is distinct from (r.c->>'restDaysHeld')::int
       or got.rest_dates is distinct from exp_rest then
      fails := fails + 1;
      raise warning 'FAIL %: got (%, %, %) expected (%, %, %)', r.c->>'name',
        got.streak, got.rest_days_held, got.rest_dates,
        r.c->>'streak', r.c->>'restDaysHeld', exp_rest;
    end if;
  end loop;
  if fails > 0 then
    raise exception 'streak parity: % of % cases failed', fails, total;
  end if;
  raise notice 'streak parity: all % cases pass', total;
end $$;

rollback;
