# Feature Specification: Level-up Moments + Achievements

**Feature Branch**: `012-levels-achievements`
**Created**: 2026-10-14
**Status**: Implemented on branch `012-levels-achievements`
**Input**: Follow-ups Q1 (level-up moment) and Q2 (achievements) from `specs/010-gamification-foundation`.

## Why this exists

Spec 010 made XP earned and levels honest, but reaching a level is invisible: the header number changes and nothing else happens. `store/xp.tsx` already detects level-ups (server-confirmed XP, per-user "seen level", silent for backfilled levels — 010 FR-014) and only sends `level_reached` to analytics. There is nothing to work toward between levels either.

## Decisions (2026-10-14)

| # | Decision |
|---|----------|
| D1 | A level-up gets a **full-screen moment, once per level**. No level unlocks in this increment (themes/widget styles/vision looks get their own spec once level-up data exists). |
| D2 | Achievement families: **Firsts**, **Streak milestones**, **Volume**, **Balanced week**. |
| D3 | Achievements are awarded **by the database**, are **permanent** (never revoked, even if the source event is later undone), and grant **no XP** (the 010 economy is unchanged). |
| D4 | Level-up and achievements share **one moment screen** and one dismissal, shown only on the main tabs (never mid-ritual or during onboarding). |

## User Scenarios & Testing

### Story 1 — Reaching a level is a moment (P1)
A user checks off a habit and crosses 900 XP. Back on Today, a full-screen card shows "Level 3 · Builder", how far the next level is, and "Continue". It never shows again for that level.

**Acceptance**
1. **Given** server-confirmed XP crosses a level threshold, **When** the user is on a main tab, **Then** the moment shows once.
2. **Given** the user is mid-ritual or in onboarding, **When** they level up, **Then** the moment waits until they are back on a main tab.
3. **Given** the first sight of a user on this build (or after reinstall), **When** levels/achievements are loaded, **Then** everything already earned is recorded as seen and nothing is celebrated (010 FR-014).
4. **Given** optimistic (unconfirmed) XP crosses a threshold, **When** the server later disagrees, **Then** no moment was shown (moments use confirmed data only).
5. **Given** two levels gained at once, **When** the moment shows, **Then** it shows the highest level only.

### Story 2 — Achievements to work toward (P1)
| Family | Achievements | Rule (from the XP ledger) |
|---|---|---|
| Firsts | First subtask, first goal completed, first morning ritual, first must-do, first evening close, first habit, first journal entry | the `first:<kind>` bonus row exists |
| Streak | 7 / 30 / 100 / 365 days | the `milestone:<n>` row exists |
| Volume | Goals completed 5 / 25 · Habits checked 50 / 250 · Evenings closed 10 / 50 | count of events of that kind (capped 0-XP events count; revoked ones don't) |
| Balanced week | Progress in all four spheres in one week (Mon–Sun, local) | events of kind subtask_done / goal_completed / habit_done / must_do_done covering all 4 spheres within one ISO week |

**Acceptance**
1. **Given** a qualifying event is written on any device, **When** the server records it, **Then** the achievement is unlocked once with its unlock time.
2. **Given** an unlocked achievement whose source event is later revoked (e.g. habit unchecked), **Then** the achievement stays.
3. **Given** new unlocks since the user last looked, **When** they reach a main tab, **Then** the moment lists them (with any level-up).
4. **Given** the Level screen, **When** opened, **Then** it shows every achievement, earned (with date) or locked (with what's needed).

## Requirements

- **FR-001** `xp_events.sphere` (nullable, one of the four spheres) is set by the existing award triggers: subtask → its goal's sphere; goal → goal sphere; habit log → habit sphere; morning ritual / must-do / evening close → the day's `focus_sphere`. Journal, first-bonus and milestone rows have none. Existing rows are backfilled where the source row still exists.
- **FR-002** `user_achievements (user_id, key, unlocked_at)`, unique per (user, key). RLS: select own; no client writes.
- **FR-003** An `AFTER INSERT` trigger on `xp_events` evaluates the catalogue for that user and inserts newly met achievements (`on conflict do nothing`). Nothing ever deletes from `user_achievements` except account deletion (cascade).
- **FR-004** Migration backfills achievements for every existing user from the current ledger. Backfilled unlocks are not celebrated (Story 1 AS3).
- **FR-005** Client catalogue `lib/achievements.ts` mirrors the SQL keys with title, description and how to earn. A key unknown to the client is ignored (forward-compatible with new server achievements).
- **FR-006** `XpProvider` loads achievements with the XP total (and on the same refresh triggers). Seen state per user in AsyncStorage: `xp_seen_level` (existing) and `achievements_seen`.
- **FR-007** One moment screen: highest new level (if any) + new achievements. Dismissing marks all of them seen. Shown only when the top route segment is `(tabs)`.
- **FR-008** Analytics: existing `level_reached {level}`; new `achievement_unlocked {achievement}` (the key, enum-like) when first shown. Both only via the consent-gated wrapper.
- **FR-009** No XP, no paywall gating: achievements are free for everyone.

## Out of scope
Level unlocks (D1), sharing an achievement, Circles visibility of achievements, a weekly-rhythm streak (010 Q3).

## Implementation notes (2026-10-14)

- **Migration `0030_achievements.sql`** — verified against Postgres 16 with all migrations 0001–0030 applied in order: every family unlocks through the real triggers; unchecking habits removes their XP but keeps the achievements; three spheres in one week plus one the next week earns nothing; another user can't read, insert or call `evaluate_achievements`; re-running the migration is a no-op; the sphere backfill restores spheres for rows whose source still exists.
- `award_xp` gains `p_sphere` (old 6-arg signature dropped). Events whose source row is already deleted keep `sphere = null` and don't count toward Balanced week.
- **"Achievements unknown" is its own state.** If `user_achievements` can't be read (e.g. the app ships before 0030 is applied), level-up moments still work and nothing about achievements is seeded; the first successful read seeds silently. Otherwise every backfilled achievement would be celebrated at once.
- **`level_reached` now fires when the moment is dismissed** (was: at detection). Seen state also advances only on dismiss, so an unseen moment survives a restart.
- A known achievement that unlocks while the moment is open is left unseen and gets its own moment; unknown keys (from a newer server) are recorded as seen so a later app version doesn't celebrate them retroactively.
- With `EARNED_XP = false` no level moments fire (achievements still do).
