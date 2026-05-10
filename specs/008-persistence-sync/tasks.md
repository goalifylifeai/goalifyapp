# Tasks: Persistence + Sync Layer

**Input**: Design documents from `/specs/008-persistence-sync/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Organization**: Tasks are grouped by user story. Each phase is independently completable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared state)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies and add the `HYDRATE` action to the reducer. No existing files are broken.

- [x] T001 Install `@react-native-async-storage/async-storage` and `@react-native-community/netinfo` via `npx expo install @react-native-async-storage/async-storage @react-native-community/netinfo`
- [x] T002 Add `HYDRATE` action to `store/index.tsx`: add `| { type: 'HYDRATE'; state: Partial<AppState> }` to `AppAction` and handle it in `appReducer` by merging the payload into state (spread over `initialState` then payload fields)
- [x] T003 [P] Add TypeScript database types to `lib/supabase.ts`: export `GoalRow`, `GoalSubtaskRow`, `HabitRow`, `HabitLogRow`, `JournalEntryRow` interfaces that match each table's column shapes from `data-model.md`

**Checkpoint**: `npm test` still passes (reducer tests unaffected); TypeScript compiles cleanly.

---

## Phase 2: Foundational — Database Migrations

**Purpose**: Provision the five new Supabase tables with RLS. MUST be applied before any runtime code is written.

**⚠️ CRITICAL**: No user story code can land against production until migrations are applied via `supabase db push`.

- [x] T004 Create `supabase/migrations/0006_goals.sql`: `goals` table with columns `(id uuid PK, user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, sphere text NOT NULL CHECK(sphere IN ('finance','health','career','relationships')), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200), due_date date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`. Enable RLS, add four policies (select/insert/update/delete own). Add `updated_at` trigger reusing `set_updated_at()`.
- [x] T005 [P] Create `supabase/migrations/0007_goal_subtasks.sql`: `goal_subtasks` table with columns `(id uuid PK, goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, text text NOT NULL CHECK(length(text) BETWEEN 1 AND 500), done boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`. Enable RLS, four policies on `user_id`. Index on `(goal_id)`. Add `updated_at` trigger.
- [x] T006 [P] Create `supabase/migrations/0008_habits.sql`: `habits` table with columns `(id uuid PK, user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, label text NOT NULL CHECK(length(label) BETWEEN 1 AND 100), icon text NOT NULL, sphere text NOT NULL CHECK(sphere IN ('finance','health','career','relationships')), target_description text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`. Enable RLS, four policies. Add `updated_at` trigger.
- [x] T007 Create `supabase/migrations/0009_habit_logs.sql` (depends on T006): `habit_logs` table with columns `(id uuid PK, habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, date date NOT NULL, done boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())`. Add `UNIQUE(habit_id, date)`. Enable RLS, four policies on `user_id`. Indexes on `(habit_id, date)` and `(user_id, date)`.
- [x] T008 [P] Create `supabase/migrations/0010_journal_entries.sql`: `journal_entries` table with columns `(id uuid PK, user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, date date NOT NULL, sphere text NOT NULL CHECK(sphere IN ('finance','health','career','relationships')), sentiment smallint NOT NULL CHECK(sentiment BETWEEN -2 AND 2), excerpt text NOT NULL CHECK(length(excerpt) BETWEEN 1 AND 1000), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`. Enable RLS, four policies. Indexes on `(user_id)` and `(user_id, date)`. Add `updated_at` trigger.
- [ ] T009 Apply all migrations locally: `supabase start && supabase db push` and verify all five tables exist with `supabase db inspect`

**Checkpoint**: All five tables exist in local Supabase with RLS enabled. `supabase db inspect` shows `goals`, `goal_subtasks`, `habits`, `habit_logs`, `journal_entries`.

---

## Phase 3: User Story 1 — Data Survives App Restart (P1) 🎯 MVP

**Goal**: Every create/update/delete is durably persisted to Supabase and the local AsyncStorage cache. On relaunch, state hydrates from cache instantly then refreshes from the server in background.

**Independent Test**: Create a goal, mark a habit, write a journal entry. Force-quit and relaunch. All three items appear correctly with no manual steps.

- [x] T010 Create `lib/bootstrap.ts`: export `async function bootstrapUserData(userId: string): Promise<AppState>` that fetches goals, goal_subtasks, habits, habit_logs (last 365 days), and journal_entries from Supabase **in parallel** (five concurrent queries). Map rows to `AppState` types using mapper functions. Return the assembled `AppState`. Do not derive `doneToday`/`streak` yet (that is US4).
- [x] T011 [P] Create `lib/offline-queue.ts` (stub for US1, full implementation in US2): export `enqueue(item: QueueItem): Promise<void>` (appends to `@goalify/sync_queue` in AsyncStorage) and `getQueue(): Promise<QueueItem[]>` (reads the array). `QueueItem` type: `{ id: string; table: string; operation: 'upsert' | 'delete'; payload: Record<string, unknown>; created_at: string; retries: number }`.
- [x] T012 Create `store/sync.ts`: export `usePersistentStore()` hook that (a) reads `@goalify/cache` from AsyncStorage and dispatches `HYDRATE` immediately on mount, (b) calls `bootstrapUserData` in background and dispatches `HYDRATE` again with fresh data and writes updated cache, (c) wraps `dispatch` to intercept each action, call the original reducer, update AsyncStorage cache, and call `syncAction(action, newState)` which upserts the affected rows to Supabase (see contracts). Returns `{ state, dispatch }` — same interface as `useStore()`.
- [x] T013 Implement `syncAction(action: AppAction, state: AppState)` inside `store/sync.ts`: switch on `action.type` and call the appropriate Supabase upsert/delete from the contracts (goals-api.md, habits-api.md, journal-api.md). On network error, call `enqueue()` to add the write to the offline queue. Fire-and-forget (no `await` blocking the UI).
- [x] T014 Replace `useReducer(appReducer, initialState)` in `app/_layout.tsx` with `usePersistentStore()`. Remove the direct `StoreProvider` wrapping if `usePersistentStore` provides the context itself, or keep `StoreProvider` but pass the persistent `dispatch` and `state` into it.
- [x] T015 Write unit tests in `__tests__/sync.test.ts`: mock Supabase client and AsyncStorage. Test (a) cache is written after each dispatch, (b) `HYDRATE` fires on mount with cached data, (c) failed Supabase write enqueues an item, (d) `syncAction` maps each action type to the correct table + operation.
- [x] T016 [P] Write unit tests in `__tests__/bootstrap.test.ts`: mock Supabase. Test (a) all five queries run in parallel (assert no sequential `await` chain), (b) returned `AppState` has correct shape, (c) empty tables return empty arrays not null.

**Checkpoint**: Create a goal → force-quit → relaunch. Goal appears within 200ms (from cache). Background Supabase fetch updates it within 2 seconds.

---

## Phase 4: User Story 2 — Offline Edits Queue and Sync (P2)

**Goal**: Changes made with no connectivity are queued locally and automatically synced when the connection is restored.

**Independent Test**: Enable airplane mode, create a goal and complete a habit. Restore connectivity. Verify both changes appear in Supabase (check via Supabase Studio or a second device sign-in).

- [x] T017 Complete `lib/offline-queue.ts`: implement `dequeue(id: string): Promise<void>` (removes one item by id), `drainQueue(syncFn: (item: QueueItem) => Promise<void>): Promise<void>` (processes all items in FIFO order, increments `retries` on failure, removes dead items after 5 retries, persists updated queue after each item), and `clearQueue(): Promise<void>`.
- [x] T018 Add connectivity listener in `store/sync.ts`: subscribe to `NetInfo.addEventListener` on mount. When `isConnected` transitions to `true`, call `drainQueue(replaySyncItem)`. `replaySyncItem` reconstructs and re-issues the Supabase upsert/delete from the queued item's `table`, `operation`, and `payload`.
- [x] T019 Write unit tests in `__tests__/offline-queue.test.ts`: mock AsyncStorage. Test (a) `enqueue` appends and persists, (b) `dequeue` removes the correct item, (c) `drainQueue` processes FIFO, retries failed items, and stops after 5 failures, (d) queue survives simulated app restart (read back from AsyncStorage after write).
- [x] T020 [P] Write unit tests in `__tests__/sync.test.ts` (extend existing file): mock NetInfo. Test (a) connectivity change from false→true triggers `drainQueue`, (b) items in queue are replayed in order, (c) successful replay removes item from queue.

**Checkpoint**: Airplane mode → create goal → restore → goal appears in Supabase within 10 seconds of reconnect.

---

## Phase 5: User Story 4 — Streak Accuracy Across Days (P2)

**Goal**: Habit streaks and `doneToday` are computed from the `habit_logs` time-series, not from a stored boolean.

**Independent Test**: Complete a habit on 3 consecutive days (use the Supabase Studio to insert `habit_logs` rows backdated if needed). Verify streak = 3. Skip a day. Verify streak resets to 0. Complete again. Verify streak = 1.

- [x] T021 Add `computeStreak(habitId: string, logs: HabitLogRow[]): number` to `lib/bootstrap.ts`: walk backwards from yesterday, count consecutive `done = true` days, stop on first gap. Cap lookback at 365 days.
- [x] T022 Add `deriveDoneToday(habitId: string, logs: HabitLogRow[]): boolean` to `lib/bootstrap.ts`: return true if a log exists for today's local date with `done = true`.
- [x] T023 Update `bootstrapUserData` in `lib/bootstrap.ts`: after fetching `habit_logs`, call `computeStreak` and `deriveDoneToday` for each habit and set `streak` and `doneToday` on the mapped `HabitItem`.
- [x] T024 Update `syncAction` in `store/sync.ts` for `TOGGLE_HABIT`: upsert a `habit_logs` row (id = stable uuid derived from `${habitId}:${today}`, habit_id, user_id, date = today, done = new `doneToday` value) instead of updating the `habits` row directly.
- [x] T025 Write unit tests in `__tests__/bootstrap.test.ts` (extend existing): test `computeStreak` with (a) 3 consecutive days → 3, (b) gap on day 2 → 0, (c) 0 logs → 0, (d) 365-day cap. Test `deriveDoneToday` with (a) log for today done=true → true, (b) log for today done=false → false, (c) no log for today → false.

**Checkpoint**: Habit streak counter matches true consecutive-day history. doneToday resets correctly on date change (verify by checking today's log exists).

---

## Phase 6: User Story 3 — Data Restores on New Device (P3)

**Goal**: Sign-in on a fresh install fully restores all user data — goals, habits with correct streaks, journal entries — within 5 seconds with no manual steps.

**Independent Test**: Sign in on a simulator with a wiped app container (no AsyncStorage). Verify all previously created data appears within 5 seconds.

- [x] T026 Ensure `bootstrapUserData` handles the no-cache path: when `@goalify/cache` is absent in AsyncStorage, skip the cache `HYDRATE` dispatch and wait for the Supabase fetch to complete before dispatching `HYDRATE` once. Add a loading indicator to `app/_layout.tsx` while bootstrap is in-flight (show existing splash or a spinner — no new screen needed).
- [x] T027 Write RLS integration test in `__tests__/rls-sync.integration.test.ts`: sign in as User A, create a goal, a habit, a journal entry. Sign in as User B. Assert all three Supabase selects return empty (RLS blocks cross-user reads). Skip test when local Supabase stack is not running (`supabase status` check). Cover all five new tables.
- [ ] T028 Manual validation per `specs/008-persistence-sync/quickstart.md` step 4: run the smoke test checklist and confirm all steps pass.

**Checkpoint**: Fresh install sign-in restores all data within 5 seconds. RLS integration test passes.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T029 [P] Add session-refresh on `PGRST301` error in `store/sync.ts`: when a Supabase call returns a JWT-expired error, call `supabase.auth.refreshSession()` and retry the upsert once before falling back to the offline queue.
- [x] T030 [P] Add dead-letter notification in `lib/offline-queue.ts`: when an item hits 5 retries and is discarded, log a warning with the item's `table` and `operation`. Wire a user-visible console warning for now (push notification hook is a future task).
- [x] T031 [P] Add account-deletion data cascade stub in `supabase/migrations/0010_journal_entries.sql` notes (or a new `0011_gdpr_delete.sql`): document that `ON DELETE CASCADE` on all `auth.users` FKs satisfies the server-side deletion requirement. Add a comment block explaining the GDPR/CCPA right-to-erasure flow for the team.
- [ ] T032 Run full test suite: `npm test`. All unit tests pass. Fix any regressions.
- [ ] T033 Run `supabase db push` against the real project (requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` in environment). Confirm all five tables appear in the Supabase dashboard.

**Checkpoint**: `npm test` green. All five tables live in production Supabase. App smoke test passes on a real device.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Migrations)**: Depends on Phase 1 (T001). T004–T006, T008 are parallel. T007 depends on T006. T009 depends on T004–T008.
- **Phase 3 (US1)**: Depends on Phase 2. T010, T011 parallel. T012 depends on T010+T011. T013 depends on T012. T014 depends on T012. T015/T016 parallel and can be written alongside T010–T014.
- **Phase 4 (US2)**: Depends on Phase 3 (T011 stub). T017 extends T011. T018 extends T012.
- **Phase 5 (US4)**: Depends on Phase 3 (T010 for habit_logs fetch, T013 for TOGGLE_HABIT sync). T021–T023 parallel. T024 depends on T023.
- **Phase 6 (US3)**: Depends on Phases 3+4+5 all complete.
- **Phase 7 (Polish)**: Depends on all story phases complete.

### Parallel Opportunities per Phase

**Phase 2**: `T004 + T005 + T006 + T008` in parallel → then `T007` → then `T009`

**Phase 3**: `T010 + T011 + T015 + T016` in parallel → `T012` → `T013 + T014` in parallel

**Phase 5**: `T021 + T022` in parallel → `T023` → `T024 + T025` in parallel

**Phase 7**: `T029 + T030 + T031` in parallel → `T032` → `T033`

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup — install deps, add HYDRATE action
2. Phase 2: Migrations — create + apply all five tables
3. Phase 3: US1 — bootstrap + write-through cache + swap in `usePersistentStore`
4. **STOP and VALIDATE**: force-quit test — data persists
5. Ship internal build

### Incremental Delivery

1. Setup + Migrations → foundation ready
2. **US1** → data durability (MVP!)
3. **US2** → offline queue (reliable sync)
4. **US4** → streak accuracy (data integrity)
5. **US3** → new-device restore (cross-device trust)
6. Polish → production hardening

---

## Notes

- `store/index.tsx` is **not** modified beyond adding the `HYDRATE` action — the pure reducer stays untouched.
- `usePersistentStore` is a drop-in replacement for `useStore` — same return shape `{ state, dispatch }`.
- All Supabase calls in `syncAction` are fire-and-forget; never `await` them on the render path.
- The offline queue key is `@goalify/sync_queue`; the cache key is `@goalify/cache`.
- `habit_logs` upsert uses a deterministic ID: `uuid5(namespace, "${habitId}:${date}")` or `${habitId}:${date}` as the uuid seed — ensures idempotent replays from the queue.
