# Feature Specification: Persistence + Sync Layer

**Feature Branch**: `008-persistence-sync`
**Created**: 2026-05-11
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Data Survives App Restart (Priority: P1)

A user creates a goal, logs a habit, and writes a journal entry. They close the app and re-open it — all their data is exactly where they left it.

**Why this priority**: Without this, the app has no value as a daily companion. Every other feature — streaks, history, coaching — depends on data being durable.

**Independent Test**: Create one goal, one habit completion, and one journal entry. Force-quit and relaunch. Verify all three items appear correctly.

**Acceptance Scenarios**:

1. **Given** a signed-in user who has created goals, habits, and journal entries, **When** they close and reopen the app, **Then** all their data is restored exactly as they left it.
2. **Given** a user who marks a habit complete, **When** they reopen the app the next day, **Then** the habit streak has incremented correctly and today's completion state is reset.
3. **Given** a user who partially edits a goal, **When** the app is closed during editing, **Then** the last saved state is restored (no partial write loss).

---

### User Story 2 - Offline Edits Queue and Sync (Priority: P2)

A user with no internet connection adds a goal and marks a habit. When connectivity is restored, those changes appear on all their devices without manual action.

**Why this priority**: Mobile users frequently lose connectivity. Data loss on disconnect would erode trust immediately.

**Independent Test**: Enable airplane mode, create a goal and complete a habit, then restore connectivity. Verify data syncs to the server and appears on a second device/session.

**Acceptance Scenarios**:

1. **Given** a user who goes offline, **When** they create or edit data, **Then** changes are saved locally and visible immediately in the app.
2. **Given** a user who made offline changes, **When** connectivity is restored, **Then** all queued changes sync to the cloud without user action and without data loss.
3. **Given** two devices logged in as the same user, **When** one device makes a change while online, **Then** the other device reflects that change within 30 seconds of coming online.

---

### User Story 3 - Data Restores on New Device (Priority: P3)

A user installs the app on a new phone, signs in, and all their history — goals, habits, streaks, journal — is restored.

**Why this priority**: Multi-device restore is the most visible proof of cloud sync and a major trust signal for users considering the Pro tier.

**Independent Test**: Sign in on a fresh install. Verify all previously created data (goals, habits with correct streak counts, journal entries) appears without any manual import step.

**Acceptance Scenarios**:

1. **Given** a user with existing cloud data, **When** they sign in on a new device, **Then** their complete history is restored within 5 seconds of a successful sign-in.
2. **Given** a user reinstalling the app, **When** they sign in, **Then** habit streaks reflect the correct historical record, not a reset.

---

### User Story 4 - Streak Accuracy Across Days (Priority: P2)

The streak counter on a habit reflects the true consecutive-day completion history, not a single boolean that resets on app restart.

**Why this priority**: Streaks are the primary motivational hook of the app. A wrong streak number destroys trust in the product.

**Independent Test**: Complete a habit on day 1. Skip day 2. Complete on days 3 and 4. Verify streak shows 2 (days 3–4), not 3 or 4.

**Acceptance Scenarios**:

1. **Given** a habit completed on consecutive days, **When** the user views it, **Then** the streak count matches the actual consecutive-day run.
2. **Given** a habit with a broken streak (day skipped), **When** the user views it, **Then** the streak resets to count from the most recent consecutive run.
3. **Given** a habit completed today, **When** midnight passes, **Then** today's completion state resets and the streak is preserved until the new day's window closes.

---

### Edge Cases

- What happens when the user deletes their account? All personal data must be removed from the server within 30 days (GDPR/CCPA compliance).
- What happens when two devices make conflicting edits to the same record while offline? Last-write-wins using server timestamp; no silent data loss.
- What happens when the sync queue grows large (>50 items) due to extended offline use? Queue is bounded; oldest unsynced items are preserved; user is notified if sync backlog exceeds a threshold.
- What happens when a habit is deleted but habit_logs remain? Habit deletion cascades to remove all associated logs.
- What happens when the user's auth session expires while offline? Local cache remains readable; sync resumes after re-authentication.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist all user-created data (goals, goal subtasks, habits, habit completions, journal entries) to the cloud so it survives app restart and device change.
- **FR-002**: System MUST store habit completions as a time-series log (one record per habit per date) rather than a single boolean, enabling accurate streak calculation.
- **FR-003**: System MUST apply row-level security so each user can only read and write their own data.
- **FR-004**: System MUST save data changes locally first (optimistic update) so the UI never waits for a network round-trip before reflecting a user action.
- **FR-005**: System MUST queue writes that fail due to no connectivity and replay them automatically when connectivity is restored.
- **FR-006**: System MUST bootstrap the in-app state from the cloud on first launch after sign-in, replacing any stale local cache.
- **FR-007**: System MUST derive a habit's current streak from the historical completion log, not from a stored counter.
- **FR-008**: System MUST cascade-delete all user data when the user's account is deleted.
- **FR-009**: System MUST NOT block the UI thread during sync operations; all network I/O runs in the background.
- **FR-010**: System MUST provide a local read cache so the app is fully usable when offline (read-only for any data not yet synced).

### Key Entities

- **Goal**: A user-defined objective with a title, target sphere, due date, progress, and ordered list of subtasks. Progress is derived from subtask completion ratio.
- **Goal Subtask**: A step within a goal, with text and a completion boolean. Ordered within its parent goal.
- **Habit**: A recurring behaviour tracked daily, with a label, icon, sphere, and daily target description. The `doneToday` field is derived at runtime from today's habit log entry.
- **Habit Log**: A time-series record of a single habit completion: (habit, date, done). One row per habit per calendar date. Drives streak calculation.
- **Journal Entry**: A dated reflection tagged to a sphere, with a sentiment score and text excerpt.
- **Sync Queue**: A local-only list of pending write operations (upserts/deletes) that failed to reach the server due to connectivity loss.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user's data is fully restored within 5 seconds of signing in on a new or reinstalled device, with no manual steps required.
- **SC-002**: Offline edits made during a connectivity loss of up to 72 hours sync successfully when connectivity is restored, with zero data loss.
- **SC-003**: Habit streak counts match the true consecutive-day completion history with 100% accuracy across restarts and device changes.
- **SC-004**: Every user action (create, update, delete) is reflected in the UI within 100 milliseconds regardless of network state.
- **SC-005**: No user's data is readable or writable by any other user's authenticated session (verified by automated tests).
- **SC-006**: Deleted accounts have all personal data removed from the server within 30 days.

## Assumptions

- Authentication is handled by feature 001 (`001-user-onboarding-auth`); this feature assumes a valid user session is always available before sync begins.
- The app targets iOS 15+ and Android 7+; web support is not required for sync in this version.
- Conflict resolution uses last-write-wins with server timestamp. Operational-transform or CRDT merge is out of scope for v1.
- The existing in-app domain reducer (`store/index.tsx`) remains the single source of truth for UI state; this feature wraps it with persistence side-effects rather than replacing it.
- The `daily_intentions`, `future_self_letters`, `vision_assets`, `profiles`, and `onboarding_state` tables already exist and are out of scope for new migrations.
- The sync queue is persisted locally (survives app restart) but is not synced to the server.
- GDPR/CCPA account-deletion flow (right-to-erasure endpoint) is required before public launch but is tracked as a sub-task of this feature, not a blocker for internal testing.
- Initial target scale is ≤ 10,000 users; the managed cloud backend handles scaling automatically.
