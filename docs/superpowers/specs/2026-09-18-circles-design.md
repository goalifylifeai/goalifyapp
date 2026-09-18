# Circles — light-touch social accountability

Status: approved, ready for implementation planning
Date: 2026-09-18

## Context

A market-fit review (see conversation history / product-manager + market-fit-analyst
findings) identified light-touch social accountability as a validated opportunity:
comparable apps (e.g. Fabulous's "Circles") ship group-based accountability
without undermining a private/reflective positioning. Goalify currently has
zero cross-user visibility: `profiles` RLS is `SELECT` own-row only, and no
social/sharing concept exists anywhere in the schema.

This spec covers the first version: small, invite-only circles where members
see only a minimal daily signal about each other (did they complete today's
must-do, and their current streak) — never goal/habit/journal content.

## Goals

- Let a user create a circle and invite people they already know via a
  shareable code.
- Let circle members see each other's today-status (done/not done) and
  streak, and nothing else.
- Keep the blast radius of any bug capped at "wrong streak shown to a
  friend" — never expose real ritual/goal/journal data through a new RLS
  hole.

## Non-goals (YAGNI for v1)

- Public/topic-based circle discovery with strangers.
- Chat, comments, reactions, or any content sharing within a circle.
- Leaving/removing members, renaming circles, circle deletion (add later if
  users actually create v1 circles and need cleanup).
- Push notifications about circle activity (e.g. "your friend just finished
  today") — purely a pull view for v1.

## Data model

New migration `supabase/migrations/0014_circles.sql`:

```sql
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
```

Helper function (avoids RLS self-recursion on `circle_members`):

```sql
create or replace function public.is_circle_member(p_circle_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = p_user_id
  );
$$;
```

RLS:
- `circles`: `SELECT` where `is_circle_member(id, auth.uid())`; `INSERT` where
  `created_by = auth.uid()`.
- `circle_members`: `SELECT` where `is_circle_member(circle_id, auth.uid())`;
  `INSERT` where `user_id = auth.uid()` (self-join only, via a valid invite
  code lookup in application logic).
- `circle_daily_status`: `SELECT` where `is_circle_member(circle_id, auth.uid())`.
  No client-facing `INSERT`/`UPDATE`/`DELETE` policy — writes happen only via
  the trigger below (running as the table owner).

Streak helper, mirroring `lib/date.ts`'s `streakFromDates` (consecutive
active days ending at `asof`, capped at 3650 iterations as a sanity bound):

```sql
create or replace function public.compute_streak(p_user_id uuid, p_asof date)
returns integer language plpgsql stable as $$
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
```

Trigger on `daily_intentions` (AFTER INSERT OR UPDATE OF must_do_done, closed_at):
for every circle the row's `user_id` belongs to, upsert
`circle_daily_status(circle_id, user_id, NEW.date, NEW.must_do_done or NEW.closed_at is not null, compute_streak(NEW.user_id, NEW.date))`.

Trigger on `circle_members` (AFTER INSERT): if a `daily_intentions` row
already exists for the new member for today, backfill today's
`circle_daily_status` row immediately (so the view isn't empty right after
joining).

## Invite mechanism

- `invite_code`: a short random string (6 uppercase alphanumeric chars),
  generated client-side at circle creation, retried on unique-constraint
  conflict.
- Join flow: user enters a code → client looks up `circles` by exact code
  match → if found, inserts a `circle_members` row (with their own
  `profiles.display_name` copied in) → RLS then grants them visibility.
- No public listing/browse endpoint — the code itself is the capability.

## Client

- `store/circles.tsx` — new provider following the `store/coach-ai.tsx`
  pattern (context + hook). Exposes:
  - `circles: Circle[]`
  - `membersFor(circleId): CircleMemberStatus[]` (id, display_name,
    must_do_done today, streak)
  - `createCircle(name): Promise<{ error?: string }>`
  - `joinCircle(code): Promise<{ error?: string }>`
- New screen(s): a circles list (create/join entry points) and a circle
  detail view (member roster with a status dot + streak number). Exact
  navigation placement (new tab vs. nested under profile) is an
  implementation-planning decision, not a design-spec decision.

## Error handling

- Unknown/invalid invite code on join → inline error, no crash (matches
  `store/daily-ritual.tsx`'s existing `error` state pattern).
- Duplicate join (already a member) → inline error via the unique
  `(circle_id, user_id)` primary key violation, surfaced as a friendly
  message.
- Network/Supabase failure on create/join → inline error, retry is just
  "try again" (no offline queue needed for this — unlike ritual data,
  circle membership isn't something that must survive being offline).

## Testing

- `__tests__/circles.test.ts`: store-level tests for `createCircle`,
  `joinCircle` (success + duplicate + invalid-code paths), and
  `membersFor` shape, mocking `supabase` the way `sync.test.ts` and
  `bootstrap.test.ts` already do.
- RLS/trigger behavior isn't Jest-testable in this repo; add cases to the
  existing (currently-skipped-by-default) `__tests__/rls.integration.test.ts`
  / `__tests__/rls-sync.integration.test.ts` following their existing
  pattern, rather than introducing a new test path.

## Open questions for implementation planning

- Exact navigation placement of the circles UI (new tab vs. nested screen).
- Whether `circles`/`circle_members` need an `updated_at` trigger for
  consistency with other tables (`public.set_updated_at()` already exists
  from `0001_profiles.sql`) — likely yes for `circles.name` if renaming is
  ever added, but out of scope for v1 since renaming isn't supported.
