# Feature Specification: Gamification Foundation (Earned XP + Forgiving Streaks)

**Feature Branch**: `010-gamification-foundation`
**Created**: 2026-09-29
**Status**: Implemented on branch `010-gamification-foundation` (Stories 1–4). Story 5 not started (D1 decided: keep ritual-only).
**Scope**: Step 0 (XP ledger) and Step 1 (streaks) of the gamification roadmap. Level-up moments, achievements, Circles v2 and AI quests are follow-up specs that build on this one.

## Why this exists

Today's levels and streaks have structural problems that any further gamification would inherit:

| # | Problem | Where | Effect on users |
|---|---------|-------|-----------------|
| P1 | XP = life score × 50, and life score maxes at 100, so XP maxes at 5,000 | `constants/data.ts` `levelForGoals` | Levels 6–8 (Forerunner, Mentor, Legend) can never be reached. Max is Level 5, Anchored (4,200) |
| P2 | Life score is an **average** of goal progress per life area | `computeSphereData` | Adding a goal (0%) lowers the score, so **setting a new goal costs XP and can drop a level** |
| P3 | Only subtask completion moves XP | — | Rituals, habits, journal and Circles, most of the daily work, earn nothing |
| P4 | A miss resets the streak to 0, with no forgiveness | `lib/date.ts` `streakFromDates`, SQL `compute_streak` | A single missed day wipes weeks of progress, and that's the moment people usually quit |
| P5 | Three separate streaks (ritual on Today, overall on Habits, one per habit) | Today, Habits tabs | Confusing: "which streak am I protecting?" |
| P6 | Streak info copy lists "Checking off a Today action" and "Completing your morning ritual", but only **must-do done** or **evening closed** actually count | `app/streak-info.tsx` vs `activeDatesFromIntentions` / `compute_streak` | Users do what the screen says and still lose their streak |

**Principle kept from the brand:** the life score stays a *mirror* (it can go up and down). The **level** becomes a *record* of effort (it only goes up). They are two different numbers and must not be derived from each other again.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every kind of showing up earns XP (Priority: P1)

A user locks their morning ritual, checks off two habits, completes a subtask and writes a journal entry. Each action visibly adds XP, and their level progress bar moves.

**Why this priority**: Fixes P1–P3. Everything else in the roadmap (level-up moments, unlocks, achievements) depends on XP that is earned rather than calculated.

**Independent Test**: A fresh account does one of each action in the XP table. Total XP equals the table sum (plus the one-time "first time" bonuses) and matches on a second device.

**Acceptance Scenarios**:

1. **Given** a user at 0 XP, **When** they complete a subtask, **Then** they gain 10 XP (+50 first-subtask bonus) immediately, even offline.
2. **Given** a user who adds a new goal, **When** the goal is created, **Then** their XP and level do **not** decrease (their life score may, by design).
3. **Given** a user who checks and un-checks the same subtask 20 times, **When** the day ends, **Then** they hold at most 10 XP for that subtask (no farming).
4. **Given** a user who checks 30 subtasks in one day, **When** XP is totalled, **Then** only 10 count toward XP that day (daily cap).
5. **Given** a user with enough XP, **When** they pass 12,000 XP, **Then** they reach Level 7 (proving P1 is fixed).
6. **Given** a user who deletes a goal whose subtasks earned XP, **When** the goal is deleted, **Then** the XP is kept (earned effort isn't taken back).

---

### User Story 2 - Existing users are never demoted by the switch (Priority: P1)

An existing user who is Level 4 under the old formula opens the updated app. They are still at least Level 4, and their history (past rituals, habit logs, journal entries, completed goals) has been credited.

**Why this priority**: A visible demotion on update is the fastest way to break trust and get 1-star reviews.

**Independent Test**: Snapshot `levelForGoals` for a set of seeded accounts, run the migration and backfill, then verify `new_level >= old_level` for every account.

**Acceptance Scenarios**:

1. **Given** a user whose backfilled XP is below their old formula XP, **When** the migration runs, **Then** a one-time `carryover` event makes up the difference.
2. **Given** a user whose backfilled XP is above their old formula XP, **When** the migration runs, **Then** no carryover is added and they may level up (the level-up moment is suppressed on this first open. See FR-014).
3. **Given** the backfill runs twice, **When** totals are compared, **Then** they are identical (idempotent).

---

### User Story 3 - One missed day doesn't erase a streak (Priority: P1)

A user on a 12-day streak misses Saturday. On Sunday their streak is still alive and the Streak screen shows Saturday as a rest day. A second consecutive miss does reset it.

**Why this priority**: Fixes P4, the single biggest quit trigger in habit apps.

**Independent Test**: Seed active dates for days 1–12, skip day 13, add day 14. Streak = 13, day 13 is marked as a rest day, and no rest days are left.

**Acceptance Scenarios**:

1. **Given** 7 consecutive active days, **When** day 7 completes, **Then** the user holds 1 rest day (maximum 1).
2. **Given** a user holding a rest day, **When** they miss one day, **Then** the rest day is used automatically and the streak survives.
3. **Given** a user with no rest day, **When** they miss a full day, **Then** the streak resets to 0.
4. **Given** a rest day was used, **When** the streak count is shown, **Then** the rest day neither adds to nor breaks the count.
5. **Given** the same history, **When** the streak is read from Today, the Streak screen, the home-screen widget and a Circle, **Then** all four show the same number.

---

### User Story 4 - The streak screen tells the truth (Priority: P2)

The "What counts" copy matches the real rule, and the Streak screen shows rest days in the 28-day grid.

**Why this priority**: Fixes P6. It's cheap and should ship with Story 3.

**Acceptance Scenarios**:

1. **Given** the streak rule (must-do done OR evening closed), **When** the user opens Streak info, **Then** the copy lists exactly those two things.
2. **Given** a rest day in the last 28 days, **When** the grid renders, **Then** that day is visually distinct from both active and missed days.

---

### User Story 5 - One streak, not three (Priority: P3, **needs decision D1**)

The Today streak and the Habits overall streak become one "showing up" streak. Per-habit streaks stay as detail on each habit.

**Why P3**: It widens what counts as an active day. That changes the Circles trigger (it currently fires only on `daily_intentions`), so the blast radius is larger. It ships after Stories 1–4 have settled.

---

### Edge Cases

- **Offline:** actions queued in `lib/offline-queue.ts` earn XP optimistically on the device. The server credits XP when the write lands. The client shows `server_total + pending_xp(queue)` and never double-counts.
- **Time zones / travel:** daily caps and streak days use the user's *local* date. The server needs the user's time zone (see FR-009). A user who flies Berlin → Delhi may get a 29-hour or 19-hour "day". This is accepted, and the rule is always evaluated in the time zone stored at the moment of the write.
- **Old app versions:** they still render `levelForGoals` (old formula). This is acceptable because they keep writing the same tables, so the server ledger stays correct. When they update, the new app reads the ledger.
- **Account deletion:** `xp_events` cascades with `auth.users`, as all other tables do (`delete-account` function needs no change beyond verification).
- **Un-check after days:** un-checking a subtask done long ago removes its XP (it's a correction). Deleting the goal does not (FR-006).
- **Clock tampering:** caps are enforced by the server's time-zone-aware date, not the device clock.

---

## Requirements *(mandatory)*

### XP economy

**FR-001** XP is recorded in an append-only ledger, `xp_events`. A user's XP is the sum of their events. Level = `levelFromXp(total)` using the **existing** `LEVELS` thresholds (unchanged; see modelling below).

**FR-002** XP awards:

| Kind | XP | Cap | Source key (dedupe) |
|------|----|-----|---------------------|
| `subtask_done` | 10 | 10 per local day | `subtask:{id}` |
| `goal_completed` | 100 | 3 per local day | `goal:{id}` |
| `ritual_locked` (morning) | 15 | 1 per day | `lock:{date}` |
| `must_do_done` | 15 | 1 per day | `mustdo:{date}` |
| `ritual_closed` (evening) | 20 | 1 per day | `close:{date}` |
| `habit_done` | 5 | 10 per local day | `habit:{habit_id}:{date}` |
| `journal_entry` | 10 | 1 per day | `journal:{date}` |
| `first_*` bonus | 50 | once ever per kind (7 kinds) | `first:{kind}` |
| `streak_milestone` | 50 / 200 / 500 / 1500 | at 7 / 30 / 100 / 365 days, once ever each | `milestone:{n}` |
| `carryover` | variable | once | `carryover` |

**FR-003** `(user_id, source_key)` is unique. Writing the same event twice is a no-op. This makes offline replays and retries safe.

**FR-004** XP is awarded **by the database**, via `AFTER INSERT/UPDATE` triggers on the tables the app already writes (`goal_subtasks`, `goals`, `habit_logs`, `daily_intentions`, `journal_entries`). The client never inserts into `xp_events` (RLS: select own only, no insert/update/delete).
  *Rationale:* no new client write path, the offline queue is unchanged, and a modified app can't grant itself XP. This is the same pattern already used for `circle_daily_status`.

**FR-005** When a done flag flips back to false (subtask, habit log, must-do), or a goal is un-completed (`completed_at` set back to null, which the Goals tab supports), the matching event is deleted. Re-completing awards it again, so toggling nets zero.

  *Accepted simplification:* if an uncapped event is revoked on a day where later events were capped at 0 XP, those later events are **not** promoted. The user loses at most one item's XP on an edge case, in exchange for triggers that never rewrite history.

**FR-006** Deleting a goal, habit or journal entry does **not** remove earned XP. `xp_events.source_key` is text, with no foreign key to the source row.

**FR-007** Caps: when the cap for a kind on a given local date is reached, further events of that kind are still inserted with `xp = 0` (keeps the ledger explainable for support and analytics).

**FR-008** Life score (`computeOverallScore`) is unchanged and remains its own number on Today and Score info. It no longer feeds XP. `levelForGoals` is removed. All level reads go through one `useLevel()` hook.

**FR-009** Add `profiles.timezone` (IANA name, e.g. `Europe/Berlin`). The client sets it on sign-in and app foreground from `expo-localization` (already a dependency). Triggers derive the local date with `(now() at time zone tz)::date`. Where a row already carries a local `date` (`habit_logs`, `daily_intentions`, `journal_entries`), that date is used as-is.

**FR-010** Client-side mirror `lib/xp.ts` holds the same XP table and is used only for optimistic display ("+10" feedback and pending XP for queued writes). The server total is the source of truth on every fetch.

### Streaks

**FR-011** An **active day** stays defined as it is today: `must_do_done OR closed_at IS NOT NULL` on `daily_intentions` (until D1 is decided).

**FR-012** Rest days:
- A user earns 1 rest day for every 7 consecutive active days and can hold at most **1**.
- A missed day consumes it automatically.
- A rest day keeps the streak alive but does not add to the count.
- Today not being active yet never consumes a rest day. As now, the streak is measured ending yesterday until today is done.
- Rest days are **derived from the date history** (forward pass over active dates). They are not stored, so there is no new state to sync and no way for devices to disagree.

**FR-013** A single pure function, `streakState(activeDates, today) → { streak, restDaysHeld, restDates[] }`, lives in `lib/date.ts` and replaces `streakFromDates` for the ritual streak. SQL `compute_streak` is rewritten to the same algorithm. Both are tested against **one shared JSON fixture file** (`__tests__/fixtures/streak-cases.json`), so drift between the two fails CI.

**FR-014** On the first open after the update, the app records the migrated level as "already seen", so no level-up celebration fires for levels gained by backfill.

**FR-015** After the migration, `backfill_circle_daily_status()` is run so friends' stored streak numbers use the new rule immediately.

**FR-016** Analytics (PostHog, only with consent, per `docs/analytics.md`): `level_reached {level}` and `rest_day_used {streak}` from the app. XP awards, caps and streak milestones are queried from `xp_events` directly rather than duplicated as PostHog events. *(Changed during build.)*

**FR-017** The earned level ships behind `EARNED_XP` in `constants/flags.ts` (fallback: the old formula). The server ledger runs regardless. **Rest days have no flag**: the rule lives in SQL too (Circles), and a client-only flag would make the app and friends' view disagree. *(Changed during build.)*

---

## Data model (sketch)

```sql
-- 0025_profiles_timezone.sql
alter table public.profiles add column if not exists timezone text not null default 'UTC';

-- 0026_xp_events.sql
create table public.xp_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  source_key  text not null,
  xp          integer not null check (xp >= 0),
  local_date  date not null,
  created_at  timestamptz not null default now(),
  unique (user_id, source_key)
);
create index xp_events_user_kind_date on public.xp_events (user_id, kind, local_date);
alter table public.xp_events enable row level security;
create policy xp_events_select_own on public.xp_events for select using ((select auth.uid()) = user_id);
-- no insert/update/delete policies: writes only via security-definer award_xp()

create view public.user_xp with (security_invoker = true) as
  select user_id, coalesce(sum(xp), 0)::int as total from public.xp_events group by user_id;

-- award_xp(user, kind, source_key, local_date, base_xp): applies the cap, inserts with ON CONFLICT DO NOTHING
-- revoke_xp(user, source_key): deletes the event
-- one trigger function per source table calls award_xp / revoke_xp
-- security definer + fixed search_path + revoke from public (same hardening as migration 0018)
```

**Backfill** (`0027_xp_backfill.sql`, idempotent via the unique key):

| Source | Event | Date used | Caveat |
|--------|-------|-----------|--------|
| `daily_intentions` | lock / must-do / close | `date` | Exact |
| `habit_logs where done` | `habit_done` | `date` | Exact |
| `journal_entries` | `journal_entry` | `date` | Exact |
| `goals where completed_at` | `goal_completed` | `completed_at` in the user's time zone | Exact |
| `goal_subtasks where done` | `subtask_done` | `updated_at` | **Approximate**: there's no `done_at` column, so caps may be applied to the wrong day. Acceptable for a one-off backfill |
| Old formula | `carryover` | migration date | `max(0, old_xp − backfilled_xp)`. **Goal progress isn't stored in the DB** (the reducer derives it), so the SQL must reproduce `computeSphereData` exactly: per goal `done_subtasks / max(subtask_count, 1)`; average per life area over **all** goals, including completed ones; average over life areas that have ≥1 goal; `round(×100) × 50`. Test it against the TS function on the same seeded accounts |

Deleted goals and subtasks can't be backfilled (their rows are gone). The carryover covers that gap.

---

## XP modelling (why the existing level thresholds stay)

Monte-Carlo, 300 runs × 2 years per persona, using the XP table above. Script: `specs/010-gamification-foundation/xp-sim.py`.

| Persona | Active days | Typical day |
|---------|-------------|-------------|
| Light | 40% | 1 subtask, 2 habits, morning ritual, rarely closes |
| Regular | 75% | 2 subtasks, 3 habits, full ritual most days, journals half the time |
| Power | 95% | 5 subtasks, 6 habits, full ritual, journals daily |

**Median day each level is reached (with first-time bonuses and rest days of 1 per 7 days, hold 1):**

| Level | Light | Regular | Power |
|-------|-------|---------|-------|
| 2 Seeker | 5 | 2 | 1 |
| 3 Builder | 31 | 10 | 5 |
| 4 Practiced | 85 | 26 | 12 |
| 5 Anchored | 188 | 60 | 29 |
| 6 Forerunner | 341 | 110 | 51 |
| 7 Mentor | 553 | 180 | 84 |
| 8 Legend | > 2 years | 304 | 140 |

**Reading it:**
- For the regular user, the current thresholds already give a good curve: a level in the first days, then roughly monthly, reaching Legend in about 10 months. **So `LEVELS` stays unchanged, which means no copy or design churn.**
- The first-time bonuses matter. Without them, a light user waits 16 days for Level 2. With them, it's 5.
- Light users level slowly after Level 3. That's acceptable for levels, but see the streak finding below.

**Rest-day variants: median best streak over 2 years**

| Rule | Light | Regular | Power |
|------|-------|---------|-------|
| No rest days (today) | 7 | 19 | 74 |
| 1 per 7 days, hold 2 | 7 | 36 | 552 |
| **1 per 7 days, hold 1 (chosen)** | **7** | **31** | **260** |
| 1 per 14 days, hold 1 | 7 | 23 | 187 |

- "Hold 2" makes streaks almost unbreakable for power users, so the streak stops meaning anything. **"Hold 1" gives regular users about 60% longer streaks** while keeping a real stake.
- **Finding:** light users (active about 40% of days) never build a daily streak under *any* rule. A daily streak is the wrong mechanic for them. A weekly rhythm ("3 active days this week") is the candidate follow-up (open question Q3).

---

## Dependencies & impact map

| Area | Change | Risk |
|------|--------|------|
| `constants/data.ts` | Remove `levelForGoals`; keep `levelFromXp`, `LEVELS` | Three call sites (Today, Profile, Level info) must all move to `useLevel()` in the same PR |
| `app/level-info.tsx` | Copy: "How XP works" becomes the XP table | Copy only |
| `app/streak-info.tsx` | Fix "What counts" copy (P6); rest days in the grid | — |
| `lib/date.ts` | `streakState()`; keep `streakFromDates` for per-habit streaks | Habits tab uses the same helper. Rest days apply to the **ritual streak only** in this spec |
| `lib/widget-snapshot.ts` + iOS/Android widgets | Streak from `streakState` | Widget renders from the snapshot, so no Swift change is expected. Verify on both platforms |
| SQL `compute_streak` | Rewritten to the forward pass | Circles show this number. Parity fixture test is mandatory |
| `store/daily-ritual.tsx` | Expose `restDaysHeld`, `restDates` | — |
| New `store/xp.tsx` | Fetch `user_xp`, subscribe to Realtime inserts (optional), add pending queue XP | Must reset on sign-out, like other stores (see sync fixes `a5f3999`, `3404dda`) |
| `supabase/functions/delete-account` | Verify cascade | — |
| Paid tiers | None. XP and rest days are **Free** for everyone | Don't gate earned progress behind Beyond |

---

## Success Criteria *(mandatory)*

- **SC-001** 0 accounts show a lower level after migration (checked with a pre/post snapshot).
- **SC-002** Streak parity: `streakState` (TS) and `compute_streak` (SQL) agree on 100% of the shared fixtures.
- **SC-003** XP parity: for a seeded account, device-optimistic XP equals the server total after the queue drains.
- **SC-004** (Behavioural, from PostHog, flag on vs off, 4 weeks) Day-30 retention and evening-close rate go up. **Guardrail:** the median number of subtasks per goal must not rise more than 20% (a sign of XP farming).

---

## Related quirk (out of scope, noted)

- Marking a goal complete doesn't set its progress to 100%. A goal completed with unchecked subtasks keeps pulling the life score down. Worth a small follow-up fix to the life-score calculation (count completed goals as 1.0). It doesn't block this spec because XP no longer depends on the score.

## Decisions needed

- **D1 (decided: a) What counts as an active day for the one unified streak (Story 5)?** Options: (a) keep ritual-only; (b) ritual OR ≥1 habit OR journal entry. Option (b) is friendlier but requires Circles triggers on `habit_logs` and `journal_entries`. Recommendation: (a) now, revisit (b) with data.
- **D2 (decided: yes) Should un-checking an old subtask remove its XP?** The spec says yes (a correction). The alternative, "only same-day un-check removes XP", is kinder but farmable across days.
- **D3 (decided: view) Should the XP total be read via the view (always correct) or a counter column updated by trigger (faster)?** Start with the view. Revisit if `xp_events` gets past about 50k rows per user (it won't soon).

## Open questions (follow-up specs)

- **Q1** Level-up moment and what each level unlocks (ritual themes, widget styles, vision looks).
- **Q2** Life-area achievements ("Balanced week") and reopening the future-self letter at Levels 3, 5 and 8.
- **Q3** A weekly-rhythm streak for light users.
- **Q4** Circles v2: a shared circle streak and one-tap reactions.
