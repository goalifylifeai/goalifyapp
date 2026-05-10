# Quickstart: Persistence + Sync Layer

Developer setup and verification steps for the persistence + sync feature.

---

## Prerequisites

- Feature 001 (`001-user-onboarding-auth`) merged and working — a valid Supabase project with `profiles` and `onboarding_state` tables is required.
- Supabase CLI installed: `brew install supabase/tap/supabase`
- `.env` configured with `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see `.env.example`)

---

## 1. Install new dependencies

```bash
npx expo install @react-native-async-storage/async-storage @react-native-community/netinfo
```

---

## 2. Apply new migrations

```bash
# Against local Supabase dev stack
supabase start
supabase db push

# Or apply individually
supabase migration up
```

Verify the five new tables exist:

```bash
supabase db inspect
# Should show: goals, goal_subtasks, habits, habit_logs, journal_entries
```

---

## 3. Run tests

```bash
npm test
# All sync, offline-queue, and bootstrap unit tests should pass
# Integration tests require: supabase start (local stack running)
```

---

## 4. Manual smoke test

1. Start the app: `npx expo start --ios`
2. Sign in (feature 001 flow)
3. Create a goal → force-quit → relaunch → goal should appear
4. Mark a habit complete → enable airplane mode → toggle again → disable airplane mode → both changes should sync
5. Check habit streak: complete habit on 3 consecutive days, verify streak = 3

---

## 5. Verify RLS isolation

```bash
npm test -- --testPathPattern=rls-sync.integration
```

This test signs in as User A, creates a goal, signs in as User B, and asserts User B cannot read User A's goal.

---

## Key files

| File | Purpose |
|------|---------|
| `store/sync.ts` | `usePersistentStore` — drop-in replacement for `useReducer(appReducer, initialState)` |
| `lib/bootstrap.ts` | Fetch all user data from Supabase on sign-in |
| `lib/offline-queue.ts` | Enqueue, dequeue, drain, and persist failed writes |
| `supabase/migrations/0006_goals.sql` | goals table + RLS |
| `supabase/migrations/0007_goal_subtasks.sql` | goal_subtasks table + RLS |
| `supabase/migrations/0008_habits.sql` | habits table + RLS |
| `supabase/migrations/0009_habit_logs.sql` | habit_logs table + RLS + UNIQUE constraint |
| `supabase/migrations/0010_journal_entries.sql` | journal_entries table + RLS |
