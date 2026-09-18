-- Circles: light-touch social accountability.
-- Invite-only small groups where members see only a minimal daily status
-- signal about each other (today's must-do done/not-done + streak) — never
-- goal/habit/journal content. See docs/superpowers/specs/2026-09-18-circles-design.md.

-- ── Tables ────────────────────────────────────────────────────────

-- circles: one row per group.
create table if not exists public.circles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(name) between 1 and 50),
  invite_code  text not null unique,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- circle_members: membership + a denormalized display name captured at
-- join time. Denormalized deliberately — this avoids ever widening RLS on
-- the real `profiles` table (which also holds pronouns / coaching prefs)
-- to let circle-mates read it. Staleness (name changes later don't
-- propagate) is an accepted v1 tradeoff.
create table if not exists public.circle_members (
  circle_id     uuid not null references public.circles(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null,
  joined_at     timestamptz not null default now(),
  primary key (circle_id, user_id)
);

-- circle_daily_status: the ONLY per-day signal exposed to other members.
-- Populated exclusively by trigger — no direct client writes.
create table if not exists public.circle_daily_status (
  circle_id     uuid not null references public.circles(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  must_do_done  boolean not null,
  streak        integer not null,
  updated_at    timestamptz not null default now(),
  primary key (circle_id, user_id, date)
);

create index if not exists circle_members_user_id_idx on public.circle_members(user_id);
create index if not exists circle_daily_status_user_id_idx on public.circle_daily_status(user_id);

-- ── Helper functions ─────────────────────────────────────────────

-- Avoids RLS self-recursion on circle_members (a policy on circle_members
-- that queried circle_members directly would recurse).
create or replace function public.is_circle_member(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = p_user_id
  );
$$;

revoke all on function public.is_circle_member(uuid, uuid) from public;
grant execute on function public.is_circle_member(uuid, uuid) to authenticated;

-- Streak helper, mirroring lib/date.ts's streakFromDates (consecutive
-- active days ending at p_asof, capped at 3650 iterations as a sanity
-- bound — matches the spec's stated cap).
create or replace function public.compute_streak(p_user_id uuid, p_asof date)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  cursor_date date := p_asof;
  result integer := 0;
  is_active boolean;
begin
  loop
    select exists (
      select 1 from public.daily_intentions
      where user_id = p_user_id and date = cursor_date
        and (must_do_done or closed_at is not null)
    ) into is_active;
    exit when not is_active or result >= 3650;
    result := result + 1;
    cursor_date := cursor_date - 1;
  end loop;
  return result;
end;
$$;

revoke all on function public.compute_streak(uuid, date) from public;
grant execute on function public.compute_streak(uuid, date) to authenticated;

-- Point lookup by invite code, used by the join flow. A client can't
-- otherwise SELECT a circles row before becoming a member (see RLS below),
-- and the invite code is the intended "capability" per the design spec
-- ("No public listing/browse endpoint — the code itself is the
-- capability."). This function only ever returns the single exact-match
-- row for a code the caller already has — it grants no browse/listing
-- ability and does not widen the circles SELECT policy.
create or replace function public.lookup_circle_by_code(p_code text)
returns table(id uuid, name text)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select c.id, c.name from public.circles c where c.invite_code = p_code;
$$;

revoke all on function public.lookup_circle_by_code(text) from public;
grant execute on function public.lookup_circle_by_code(text) to authenticated;

-- ── RLS ───────────────────────────────────────────────────────────

alter table public.circles enable row level security;

-- Members can see circles they belong to. The creator can also see the
-- circle immediately after creating it (before their own circle_members
-- row exists) — otherwise `insert ... returning` from the client would
-- return zero rows for their own just-created circle, since Postgres RLS
-- filters RETURNING output through the SELECT policy.
create policy "circles_select_member_or_creator"
  on public.circles for select
  using (public.is_circle_member(id, auth.uid()) or created_by = auth.uid());

create policy "circles_insert_own"
  on public.circles for insert
  with check (created_by = auth.uid());

alter table public.circle_members enable row level security;

create policy "circle_members_select_member"
  on public.circle_members for select
  using (public.is_circle_member(circle_id, auth.uid()));

-- Self-join only. The application looks up circle_id via
-- lookup_circle_by_code() using a valid invite code before inserting.
create policy "circle_members_insert_self"
  on public.circle_members for insert
  with check (user_id = auth.uid());

alter table public.circle_daily_status enable row level security;

create policy "circle_daily_status_select_member"
  on public.circle_daily_status for select
  using (public.is_circle_member(circle_id, auth.uid()));

-- Deliberately no insert/update/delete policy: circle_daily_status is
-- populated exclusively by the SECURITY DEFINER trigger functions below,
-- which run as the table owner and so bypass RLS regardless of policies.

-- ── Triggers ──────────────────────────────────────────────────────

-- Keeps circle_daily_status in sync whenever a user's daily_intentions row
-- changes. Fans the update out to every circle the user belongs to.
create or replace function public.sync_circle_daily_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.circle_daily_status (circle_id, user_id, date, must_do_done, streak, updated_at)
  select cm.circle_id, new.user_id, new.date,
         (new.must_do_done or new.closed_at is not null),
         public.compute_streak(new.user_id, new.date),
         now()
  from public.circle_members cm
  where cm.user_id = new.user_id
  on conflict (circle_id, user_id, date) do update
    set must_do_done = excluded.must_do_done,
        streak = excluded.streak,
        updated_at = excluded.updated_at;
  return new;
end;
$$;

drop trigger if exists daily_intentions_sync_circle_status on public.daily_intentions;
create trigger daily_intentions_sync_circle_status
  after insert or update of must_do_done, closed_at on public.daily_intentions
  for each row execute function public.sync_circle_daily_status();

-- Backfills today's status immediately after joining, so the roster isn't
-- empty right after a member joins mid-day.
create or replace function public.backfill_circle_daily_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  di record;
begin
  select * into di from public.daily_intentions
  where user_id = new.user_id and date = current_date;

  if found then
    insert into public.circle_daily_status (circle_id, user_id, date, must_do_done, streak, updated_at)
    values (
      new.circle_id, new.user_id, di.date,
      (di.must_do_done or di.closed_at is not null),
      public.compute_streak(new.user_id, di.date),
      now()
    )
    on conflict (circle_id, user_id, date) do update
      set must_do_done = excluded.must_do_done,
          streak = excluded.streak,
          updated_at = excluded.updated_at;
  end if;

  return new;
end;
$$;

drop trigger if exists circle_members_backfill_status on public.circle_members;
create trigger circle_members_backfill_status
  after insert on public.circle_members
  for each row execute function public.backfill_circle_daily_status();
