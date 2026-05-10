# Phase 0 Research: Persistence + Sync Layer

## 1. Offline-First Architecture Pattern

**Decision**: Optimistic local update → async background upsert → offline queue on failure

**Rationale**: React Native apps must feel instant. Writing to Supabase synchronously on every dispatch would add 100–500ms latency per action. The optimistic pattern keeps the UI snappy: the reducer fires immediately, AsyncStorage is updated synchronously, and Supabase is written in the background. If the write fails (offline), the action is appended to a persistent queue and retried on reconnect.

**Alternatives considered**:
- *Sync-on-save only* (write to Supabase, wait for response, then dispatch): rejected — poor UX, offline unusable.
- *Event sourcing / CRDT*: rejected — significant complexity for v1 with ≤ 10k users; last-write-wins is sufficient.
- *Convex*: evaluated — reactive queries map well to the reducer shape, but adds a new managed service and requires migrating away from the already-provisioned Supabase instance.

---

## 2. Local Cache: AsyncStorage vs. expo-secure-store vs. SQLite

**Decision**: `@react-native-async-storage/async-storage` for cache + write queue

**Rationale**: AsyncStorage is the idiomatic RN key-value cache. The cached data (goals, habits, journal) is not a secret — it mirrors what the server holds — so secure storage is unnecessary overhead. SQLite (via expo-sqlite) would allow relational queries but adds schema migration complexity for what is essentially a mirror of Supabase data; AsyncStorage serialized as JSON is sufficient for the ≤ 10k user scale.

**Alternatives considered**:
- *expo-sqlite*: better query capability; rejected for v1 — AsyncStorage is simpler and the data volumes are small.
- *expo-secure-store*: appropriate for auth tokens (already used by feature 001); not for general cache — size limits (2KB per key on iOS) would break on large datasets.
- *MMKV (react-native-mmkv)*: faster than AsyncStorage but requires native build step (not compatible with Expo Go); out of scope for managed Expo workflow.

---

## 3. Write Queue Design

**Decision**: Array of `{id, action_type, payload, table, created_at, retries}` stored as a single JSON blob under `AsyncStorage` key `@goalify/sync_queue`

**Rationale**: A flat array in one AsyncStorage key is simple to read, write, and drain atomically. Each item carries enough information to reconstruct the Supabase upsert or delete call independently. The queue is drained in order (FIFO) on reconnect. Items older than 72 hours (per spec SC-002) are retried; after 5 consecutive failures they are moved to a dead-letter log and the user is notified.

**Key fields**:
```ts
type QueueItem = {
  id: string;           // uuid, deduplicate on replay
  table: string;        // 'goals' | 'habits' | 'habit_logs' | 'journal_entries' | 'goal_subtasks'
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  created_at: string;   // ISO timestamp
  retries: number;
};
```

---

## 4. Bootstrap Strategy (Auth → Hydrate Store)

**Decision**: On `SIGNED_IN` auth event, fetch all five tables in parallel, derive `doneToday` from today's `habit_logs`, dispatch `HYDRATE` action to replace store state.

**Rationale**: Parallel fetches minimise bootstrap latency. A single `HYDRATE` action keeps the reducer pure (one atomic state replacement) and avoids intermediate render cycles from partial hydration. The cache is written after hydration so subsequent cold launches load from AsyncStorage while the background fetch updates it.

**Bootstrap sequence**:
1. Auth session confirmed (feature 001 handles this).
2. Read AsyncStorage cache → dispatch `HYDRATE` immediately (≤ 200ms, satisfies SC-001 perceived speed).
3. Fetch all five tables from Supabase in parallel (background).
4. Derive `doneToday` per habit: check `habit_logs` for `date = today AND done = true`.
5. Derive `streak` per habit: count consecutive days ending yesterday with `done = true`.
6. Dispatch `HYDRATE` again with fresh server data → overwrite cache.

---

## 5. HabitItem.doneToday and Streak Derivation

**Decision**: `doneToday` and `streak` are computed fields, not stored columns on `habits`.

**Rationale**: Storing `doneToday` as a boolean (current `store/index.tsx:16`) is incorrect — it resets on app restart and can't represent history. Storing `streak` as an integer is also fragile: it must be incremented/decremented atomically and requires a daily job to detect missed days. Deriving both at bootstrap from `habit_logs` is correct, testable, and eliminates the risk of stale cached counts.

**Streak algorithm**:
```
streak = 0
day = yesterday
while habit_logs[habit_id, day].done == true:
  streak += 1
  day -= 1 day
```
Cap the lookback at 365 days. Runs client-side after bootstrap fetch.

---

## 6. Conflict Resolution

**Decision**: Last-write-wins using `updated_at` timestamp on all mutable tables.

**Rationale**: At ≤ 10k users and with single-user data (no collaborative editing), conflicts only arise when the same user edits on two offline devices simultaneously. Last-write-wins is simple, understandable, and correct for this use case. The server's `updated_at` (set by `BEFORE UPDATE` trigger) is the authoritative timestamp.

**Alternatives considered**:
- *Client-wins*: simpler but risks overwriting server data that was more recent.
- *Server-wins*: risks discarding locally-made changes.
- *CRDT / OT*: correct for collaborative editing; massively over-engineered for single-user personal goals.

---

## 7. Connectivity Detection

**Decision**: `@react-native-community/netinfo` to listen for network state changes and trigger queue drain on reconnect.

**Rationale**: Expo does not ship a built-in network listener. `@react-native-community/netinfo` is the community standard, Expo-compatible, and works without ejecting. The queue drain is triggered by the `isConnected` transition `false → true`.

---

## 8. RLS Policy Pattern (consistency with existing tables)

All five new tables follow the same pattern established by `profiles` and `onboarding_state`:

```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_select_own" ON public.<table> FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "<table>_insert_own" ON public.<table> FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "<table>_update_own" ON public.<table> FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "<table>_delete_own" ON public.<table> FOR DELETE USING (auth.uid() = user_id);
```

`goal_subtasks` adds a join check: `user_id` is denormalised onto the subtask row (redundant FK to `auth.users`) to keep RLS simple without requiring a join in the policy expression.

---

## 9. Migration Numbering

Existing migrations end at `0005_vision_assets.sql`. New migrations:

| Number | Table |
|--------|-------|
| 0006 | goals |
| 0007 | goal_subtasks |
| 0008 | habits |
| 0009 | habit_logs |
| 0010 | journal_entries |
