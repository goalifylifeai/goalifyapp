# Feature Specification: Goal Health + Due-Date Reminders

**Feature Branch**: `011-goal-health`
**Created**: 2026-10-13
**Status**: Implemented on branch `011-goal-health` (Stories 1–3)
**Input**: User description: "Goal progress reflects reality (subtasks, linked habit consistency, time to due date), goals show overdue/at-risk states, and users get a reminder before a goal is due."

## Why this exists

Goals are the thinnest part of a goal app. Today:

| # | Problem | Where | Effect on users |
|---|---------|-------|-----------------|
| P1 | Progress = done subtasks ÷ total subtasks. A goal with no subtasks is 0% forever | `store/reducer.ts` | The most common first goal ("Run a 5k", no subtasks yet) never moves and drags its sphere's score down — the "setting a goal costs you" problem 010 fixed for XP still exists for the life score |
| P2 | Habits can be created *for* a goal (`goalId`) but checking them does nothing to the goal | `HabitPromptModal`, reducer | The daily work the app asks for is invisible on the goal it was meant to serve |
| P3 | Due dates are stored and displayed ("Due 12 Nov") but never acted on | `goals.tsx` | No overdue state, no urgency ordering, no reminder. A due date is decoration |
| P4 | The due date defaults to *today* and cannot be cleared | `goals.tsx`, `(welcome)/add-goal.tsx` | Almost every goal has a meaningless due date — which makes P3 dangerous to fix naively: an overdue state would fire on nearly every goal tomorrow |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Progress moves when I do the work (Priority: P1)

A user creates "Run a 5k" with no subtasks and, when prompted, a linked habit "Run 3× a week". After a week of checking the habit, the goal card and its sphere bar show progress — not 0%.

**Why this priority**: Fixes P1 and P2. This is the single biggest lever on activation ("first goal → first completion") and on the life score feeling honest.

**Independent Test**: Create a goal with no subtasks and a linked habit; check the habit on 5 of the last 7 days; goal health is visibly > 0 and the sphere bar moved. Add 2 subtasks and finish one; health reflects both.

**Acceptance Scenarios**:

1. **Given** a goal with no subtasks and no linked habits, **When** the user views it, **Then** it shows a "no plan yet" state rather than 0%, and it does **not** lower its sphere's score.
2. **Given** a goal with a linked habit checked on 5 of the last 7 days, **When** the user views the goal, **Then** its health reflects ~71% habit consistency.
3. **Given** a goal with 4 subtasks (2 done) and a linked habit at 100% over the last 7 days, **When** viewed, **Then** health blends both and sits between 50% and 100%, and the sphere score uses the same number.
4. **Given** a goal with subtasks only, **When** all subtasks are done, **Then** health is 100% (unchanged behaviour).
5. **Given** a user who un-checks a habit, **When** the goal is viewed again, **Then** health decreases accordingly (health is derived, never ratcheted).
6. **Given** the Home sphere balance, Goals tab, Vision banner and the widget, **When** the same goal is shown, **Then** all show the same health number.

---

### User Story 2 - Due dates mean something (Priority: P1)

A user sets a goal due in 30 days. As the date approaches with little progress, the card shows "at risk"; after the date passes it shows "overdue"; the Goals list surfaces those first.

**Why this priority**: Fixes P3 and defuses P4. Without an honest due date, reminders (Story 3) would be noise.

**Independent Test**: Create three goals: due in 60 days at 80% health, due in 3 days at 10% health, due yesterday. The list orders them overdue → at risk → on track and labels each.

**Acceptance Scenarios**:

1. **Given** the goal form, **When** the user creates a goal, **Then** the due date is **optional** and defaults to "No date"; the user can set or clear it at any time.
2. **Given** a goal with no due date, **When** viewed, **Then** it is never overdue or at risk; it shows neither label.
3. **Given** a goal due in ≤ 7 days whose health is below the share of time elapsed (behind the pace needed), **When** viewed, **Then** it shows "At risk · due in N days".
4. **Given** a goal whose due date is in the past and which is not completed, **When** viewed, **Then** it shows "Overdue · N days" and the user can, in one tap, either move the date or clear it.
5. **Given** a goal that is completed, **When** its due date passes, **Then** it is never shown as overdue.
6. **Given** the Goals tab, **When** the active list renders, **Then** overdue goals come first, then at-risk, then the rest in existing order; search and sphere filters still apply.
7. **Given** existing goals whose due date equals their creation day (the old default), **When** the app updates, **Then** they are treated as having **no due date** and are not flagged overdue. **Decided 2026-10-14: display-only.** The stored value is kept; `effectiveDue()` ignores it. Editing such a goal without touching the date does not rewrite it.

---

### User Story 3 - A reminder before it's due (Priority: P2)

A user with a goal due Friday gets one notification on Wednesday evening: "Run a 5k is due in 2 days — 60% there." Tapping it opens the goal.

**Why this priority**: Turns the due date into a retention touchpoint. Depends on Stories 1–2 being honest first.

**Independent Test**: Set a goal due in 2 days with notification permission granted; a reminder is scheduled for the evening slot 2 days before; completing the goal or clearing the date cancels it; no reminder exists for goals without a due date.

**Acceptance Scenarios**:

1. **Given** notification permission is granted and a goal has a due date more than 2 days out, **When** the goal is saved, **Then** one reminder is scheduled for 2 days before the due date at the user's evening ritual time.
2. **Given** a goal due in ≤ 2 days when created, **When** saved, **Then** the reminder is scheduled for the next evening slot before the due date, or not at all if none remains.
3. **Given** a scheduled reminder, **When** the goal is completed, deleted, or its due date is cleared or moved, **Then** the old reminder is cancelled (and re-scheduled if a new date applies).
4. **Given** the reminder fires, **When** tapped, **Then** the app opens the Goals tab filtered to that goal's sphere, and the open is counted as a goal-reminder notification.
5. **Given** notification permission is denied, **When** a goal with a due date is saved, **Then** nothing is scheduled and nothing fails visibly.
6. **Given** ten goals due the same day, **When** reminders are scheduled, **Then** at most one goal reminder is delivered per day (the most at-risk goal; others are folded into its copy: "and 2 more").

---

### Edge Cases

- Goal with subtasks **and** a linked habit that has never been checked: habit component counts as 0, not "no data" — the user committed to it.
- Habit linked to a goal is deleted: the goal falls back to subtasks only (or "no plan yet").
- Habit linked to a goal whose goal is deleted: the habit stays (existing behaviour) and simply has no goal.
- Due date set in the past deliberately: shows overdue immediately; allowed.
- Device date changes / timezone travel: overdue and at-risk use the device's local calendar day, like streaks do.
- Offline: health is computed locally from local state; reminders are scheduled locally; nothing waits on the server.
- Web: no notifications (existing rule); states and ordering still apply.
- A goal completed while overdue: completion wins; the overdue label disappears and completion XP is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each active goal MUST have a single **health** value in [0, 1] derived from (a) subtask completion and (b) linked-habit consistency over the trailing 7 days. With only one component present, health equals that component. With both, health is their average.
- **FR-002**: A goal with neither subtasks nor linked habits MUST have **no health** (distinct from 0) and MUST be excluded from its sphere's score, the same way an empty sphere is excluded from the overall score today.
- **FR-003**: Every surface that shows goal progress (Goals tab, Home sphere balance, Vision banner, widget snapshot if it carries progress) MUST use the same health value.
- **FR-004**: The due date MUST be optional. The goal form MUST default to no due date and MUST let the user clear a set date.
- **FR-005**: An active goal with a past due date MUST be labelled **overdue** with the number of days.
- **FR-006**: An active goal due within 7 days MUST be labelled **at risk** when its health is below the fraction of the goal's lifetime already elapsed (created → due), with a floor so that a goal at ≥ 80% health is never "at risk".
- **FR-007**: Completed goals MUST never be overdue or at risk.
- **FR-008**: The active goal list MUST order overdue first, then at risk, then remaining goals in their existing order, after applying search and sphere filters.
- **FR-009**: Goals created before this feature whose due date equals their creation date MUST be treated as having no due date.
- **FR-010**: With notification permission granted, saving a goal with a due date MUST schedule exactly one local reminder 2 days before the due date at the user's evening-ritual time; changing, clearing, completing or deleting MUST cancel and, if applicable, re-schedule.
- **FR-011**: At most one goal reminder MUST be delivered per calendar day; when several goals qualify, the most at-risk one is named and the rest are counted.
- **FR-012**: Tapping a goal reminder MUST open the Goals tab on that goal's sphere.
- **FR-013**: Reminder copy MUST NOT be sent to analytics; the reminder open is tracked as an existing notification-open kind `goal_due`.
- **FR-014**: Health, overdue and at-risk MUST be computed on device from local state and work offline.
- **FR-015**: Health MUST NOT change XP or streaks (010 is unaffected); only the life score and labels change.

### Key Entities

- **Goal**: gains derived *health* (not stored), an optional *due date* (already stored, now nullable in practice), and derived *status* ∈ {no plan, on track, at risk, overdue, completed}.
- **Habit → Goal link**: existing `goalId`; a goal may have several linked habits; consistency = done days ÷ 7 averaged across its linked habits.
- **Goal reminder**: a local notification keyed by goal id, kind `goal_due`, carrying only the sphere and goal id as payload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A goal with a linked habit shows non-zero health within 24 h of the first habit check (today: never).
- **SC-002**: Zero goals created after release are flagged overdue by default (today's default-to-today behaviour would flag ~100%).
- **SC-003**: Users can set, change or clear a due date in ≤ 3 taps from the goal card.
- **SC-004**: In the 4 weeks after release, the share of goals that reach completion within 7 days of their due date increases versus the 4 weeks before (goal_created → goal_updated{completed}).
- **SC-005**: The goal-reminder open rate is measurable from day one (notification_opened{kind: goal_due}) and the reminder sends at most one notification per user per day.
- **SC-006**: Health shown on Home, Goals and Vision for the same goal never differs (property-tested over random states).

## Assumptions

- "Linked habit consistency" uses the trailing 7 local calendar days, matching the streak and widget conventions; weekly-frequency habits are out of scope (spec 013).
- Evening-ritual time is the user's existing evening notification time; no new settings screen.
- No new server tables: health is derived and reminders are local notifications. **One column is added** (see Implementation notes): the habit → goal link was never persisted.
- Web keeps no notifications (existing rule).
- Reorder/archive of goals is out of scope (sorting is derived from status only).
- Rest days (010) are not applied to habit consistency; a missed habit day counts as missed for health even if the streak survived.

## Implementation notes (2026-10-14)

- **Migration `0029_habits_goal_id.sql`** adds `habits.goal_id uuid null references goals on delete set null`. The link the habit prompt creates (`HabitItem.goalId`) was never written to the server and `bootstrap` never read it back, so every link vanished on the next launch, which would have made Story 1 invisible after a restart. Links created before this migration cannot be recovered; users will need to re-link (out of scope: a "link a habit" control on the goal card).
- **`Goal.createdAt`** now comes from `goals.created_at` (bootstrap) or is stamped locally on create. Needed by FR-006 (elapsed share) and FR-009.
- **Legacy rule (FR-009)**: any goal whose due date equals its creation day is treated as undated, with no release-date cutoff. To keep that unambiguous, the date picker's earliest date is **tomorrow** (a goal due the day it is made is a task; Today covers those).
- **Health vs `progress`**: `Goal.progress` stays the raw subtask ratio (legacy XP formula, analytics `progress_pct`). Every display surface uses `goalHealth()` (FR-003, FR-015).
- **Habit window**: trailing 7 days ending today *or* yesterday, whichever is higher, so health doesn't dip every morning before the user acts.
- **Completed goals** have health 1 in the sphere average.
- **No-plan goals near their due date** are labelled at risk (treated as 0 health for FR-006 only).
- **Reminders**: pure planner (`lib/goal-reminders.ts`) + reconciler (`ensureGoalRemindersScheduled`) run on every goals/habits change, so create, move, clear, complete and delete all go through one path. Identifier `goal-due-<day>` (one per day, FR-011); at most 10 days scheduled ahead (iOS keeps 64 pending notifications per app). Copy is computed at schedule time and refreshed on the next state change.
- Also fixed: the notification tap handler had no `journal` branch, so the sentiment check-in opened nothing.
