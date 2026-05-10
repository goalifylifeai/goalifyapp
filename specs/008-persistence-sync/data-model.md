# Phase 1 Data Model: Persistence + Sync Layer

All tables live in the `public` schema. All reference `auth.users(id)` ON DELETE CASCADE and have RLS enabled. All mutable tables carry `created_at` and `updated_at` (touched by `set_updated_at()` trigger, already defined in migration 0001).

---

## New Tables

### `goals`

One row per user goal.

| Column       | Type          | Constraints                                  | Notes |
|--------------|---------------|----------------------------------------------|-------|
| `id`         | `uuid`        | PK DEFAULT `gen_random_uuid()`               | |
| `user_id`    | `uuid`        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | |
| `sphere`     | `text`        | NOT NULL, CHECK IN ('finance','health','career','relationships') | Maps to `SphereId` |
| `title`      | `text`        | NOT NULL, CHECK `length BETWEEN 1 AND 200`   | |
| `due_date`   | `date`        | NULL allowed                                 | Optional deadline |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()`                     | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT `now()`                     | Touched by trigger |

Indexes: PK + `(user_id)`.

---

### `goal_subtasks`

One row per subtask, ordered within a goal. `user_id` is denormalised for simple RLS.

| Column       | Type          | Constraints                                  | Notes |
|--------------|---------------|----------------------------------------------|-------|
| `id`         | `uuid`        | PK DEFAULT `gen_random_uuid()`               | |
| `goal_id`    | `uuid`        | NOT NULL, FK → `public.goals(id)` ON DELETE CASCADE | |
| `user_id`    | `uuid`        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Denormalised for RLS |
| `text`       | `text`        | NOT NULL, CHECK `length BETWEEN 1 AND 500`   | |
| `done`       | `boolean`     | NOT NULL DEFAULT false                       | |
| `sort_order` | `integer`     | NOT NULL DEFAULT 0                           | Client-assigned ordering |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()`                     | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT `now()`                     | |

Indexes: PK + `(goal_id)` + `(user_id)`.

---

### `habits`

One row per recurring habit definition. No `doneToday` or `streak` — both are derived at runtime from `habit_logs`.

| Column               | Type          | Constraints                                  | Notes |
|----------------------|---------------|----------------------------------------------|-------|
| `id`                 | `uuid`        | PK DEFAULT `gen_random_uuid()`               | |
| `user_id`            | `uuid`        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | |
| `label`              | `text`        | NOT NULL, CHECK `length BETWEEN 1 AND 100`   | Display name |
| `icon`               | `text`        | NOT NULL                                     | Emoji or icon key |
| `sphere`             | `text`        | NOT NULL, CHECK IN ('finance','health','career','relationships') | |
| `target_description` | `text`        | NOT NULL                                     | e.g. "3× per week" |
| `created_at`         | `timestamptz` | NOT NULL DEFAULT `now()`                     | |
| `updated_at`         | `timestamptz` | NOT NULL DEFAULT `now()`                     | |

Indexes: PK + `(user_id)`.

---

### `habit_logs`

Time-series completion record. One row per habit per calendar date. This is the source of truth for streaks and `doneToday`.

| Column       | Type          | Constraints                                      | Notes |
|--------------|---------------|--------------------------------------------------|-------|
| `id`         | `uuid`        | PK DEFAULT `gen_random_uuid()`                   | |
| `habit_id`   | `uuid`        | NOT NULL, FK → `public.habits(id)` ON DELETE CASCADE | |
| `user_id`    | `uuid`        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Denormalised for RLS |
| `date`       | `date`        | NOT NULL                                         | User's local calendar date |
| `done`       | `boolean`     | NOT NULL DEFAULT false                           | |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()`                         | |

Unique constraint: `(habit_id, date)`.
Indexes: PK + `(habit_id, date)` + `(user_id, date)`.

---

### `journal_entries`

One row per journal entry.

| Column       | Type          | Constraints                                  | Notes |
|--------------|---------------|----------------------------------------------|-------|
| `id`         | `uuid`        | PK DEFAULT `gen_random_uuid()`               | |
| `user_id`    | `uuid`        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | |
| `date`       | `date`        | NOT NULL                                     | Entry date (user's local date) |
| `sphere`     | `text`        | NOT NULL, CHECK IN ('finance','health','career','relationships') | |
| `sentiment`  | `smallint`    | NOT NULL, CHECK `BETWEEN -2 AND 2`           | -2 (very low) to +2 (very high) |
| `excerpt`    | `text`        | NOT NULL, CHECK `length BETWEEN 1 AND 1000`  | Full text or summary |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()`                     | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT `now()`                     | |

Indexes: PK + `(user_id)` + `(user_id, date)`.

---

## Relationships

```
auth.users (1) ──┬──< goals (N)
                 │      └──< goal_subtasks (N)
                 ├──< habits (N)
                 │      └──< habit_logs (N)  [UNIQUE per habit+date]
                 └──< journal_entries (N)
```

All cascades: deleting `auth.users` removes all child rows across all five tables.

---

## Row-Level Security (all tables follow this pattern)

```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_select_own"
  ON public.<table> FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "<table>_insert_own"
  ON public.<table> FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "<table>_update_own"
  ON public.<table> FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "<table>_delete_own"
  ON public.<table> FOR DELETE USING (auth.uid() = user_id);
```

`goal_subtasks` and `habit_logs` carry a denormalised `user_id` so this single-column policy works without a subquery join.

---

## TypeScript Type Changes

### `store/index.tsx` — minimal changes required

`HabitItem.doneToday` and `HabitItem.streak` remain in the TypeScript type (they drive the UI). They become **derived fields** populated at bootstrap, not persisted columns.

```ts
// Before (current)
export type HabitItem = {
  id: string; label: string; icon: string; sphere: SphereId;
  streak: number; target: string; doneToday: boolean;
};

// After (no structural change to the type — doneToday and streak are still present,
// but populated by bootstrap from habit_logs, not stored in the habits table)
```

Add a `HYDRATE` action to the reducer to support atomic state replacement at bootstrap:

```ts
| { type: 'HYDRATE'; state: Partial<AppState> }
```

### New AsyncStorage cache shape

```ts
// @goalify/cache key
type CacheSnapshot = {
  goals: Goal[];
  habits: HabitItem[];   // doneToday and streak pre-derived
  journal: JournalEntry[];
  todayActions: TodayAction[];
  snapshot_at: string;   // ISO timestamp
};
```

### Offline queue item

```ts
// @goalify/sync_queue key
type QueueItem = {
  id: string;
  table: 'goals' | 'goal_subtasks' | 'habits' | 'habit_logs' | 'journal_entries';
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  created_at: string;
  retries: number;
};
```

---

## Trigger Reuse

The `set_updated_at()` function and its trigger pattern are already defined in migration 0001. New tables apply the same pattern:

```sql
CREATE TRIGGER goals_touch BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- (repeated for goal_subtasks, habits, journal_entries)
-- habit_logs has no updated_at (immutable after insert; delete+reinsert on toggle)
```
