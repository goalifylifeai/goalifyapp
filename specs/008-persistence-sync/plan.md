# Implementation Plan: Persistence + Sync Layer

**Branch**: `008-persistence-sync` | **Date**: 2026-05-11 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-persistence-sync/spec.md`

## Summary

Add durable cloud persistence and offline-first sync to Goalify by wiring the existing in-app reducer to Supabase via a `usePersistentStore` hook. Five new Postgres tables store goals, goal subtasks, habits, habit completion logs (time-series), and journal entries — all protected by row-level security. An AsyncStorage cache provides instant offline reads; a write queue replays failed mutations when connectivity is restored. The existing `appReducer` stays pure and unit-testable; all side-effects (DB writes, cache updates, queue management) live in the hook layer. `HabitItem.doneToday` becomes a derived field computed at bootstrap from `habit_logs`.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1, React Native 0.81 (New Architecture enabled)
**Primary Dependencies**: Expo SDK 54, expo-router 6, `@supabase/supabase-js` v2 (already installed), `@react-native-async-storage/async-storage` (to add), `@react-native-community/netinfo` (to add for connectivity detection)
**Storage**: Supabase Postgres (managed, already provisioned). Five new tables: `goals`, `goal_subtasks`, `habits`, `habit_logs`, `journal_entries`. Existing tables untouched. AsyncStorage for local cache + offline write queue.
**Testing**: jest + jest-expo (already configured), `@testing-library/react-native`. Supabase client mocked for unit tests; integration tests run against local `supabase start` stack.
**Target Platform**: iOS 15+, Android 7+. Web is out of scope for sync in v1.
**Project Type**: Mobile app (Expo React Native) + managed backend (Supabase). No custom API server.
**Performance Goals**: Bootstrap from cache ≤ 200ms (cold cache from Supabase ≤ 2s). Every dispatch reflected in UI ≤ 100ms (optimistic). Background sync must not block the JS thread.
**Constraints**: All network I/O is async and non-blocking. Tokens already in secure keychain (feature 001). Conflict resolution is last-write-wins via `updated_at` timestamp. Offline queue persists across app restarts (AsyncStorage). No CRDT or operational-transform in v1.
**Scale/Scope**: ≤ 10k users (Supabase free tier). Five new tables, three new modules (`store/sync.ts`, `lib/offline-queue.ts`, `lib/bootstrap.ts`), five new migrations.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution at `.specify/memory/constitution.md` is the unfilled scaffold (placeholders only). No project-specific principles to gate against. No violations tracked.

## Project Structure

### Documentation (this feature)

```text
specs/008-persistence-sync/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md
└── contracts/
    ├── goals-api.md         # PostgREST contract for goals + goal_subtasks
    ├── habits-api.md        # PostgREST contract for habits + habit_logs
    └── journal-api.md       # PostgREST contract for journal_entries
```

### Source Code (repository root)

```text
store/
├── index.tsx              # EXISTING — pure appReducer, untouched
└── sync.ts                # NEW — usePersistentStore hook (wraps appReducer + side-effects)

lib/
├── supabase.ts            # EXISTING — typed Supabase client
├── bootstrap.ts           # NEW — load all user data from Supabase on auth
└── offline-queue.ts       # NEW — AsyncStorage-backed write queue

supabase/
└── migrations/
    ├── 0006_goals.sql           # NEW
    ├── 0007_goal_subtasks.sql   # NEW
    ├── 0008_habits.sql          # NEW
    ├── 0009_habit_logs.sql      # NEW
    └── 0010_journal_entries.sql # NEW

__tests__/
├── sync.test.ts           # NEW — usePersistentStore: optimistic update, queue, bootstrap
├── offline-queue.test.ts  # NEW — enqueue, dequeue, replay, persistence
├── bootstrap.test.ts      # NEW — hydration from Supabase, doneToday derivation
└── rls-sync.integration.test.ts  # NEW — cross-user isolation on all 5 tables
```

**Structure Decision**: Mobile + managed-backend. The existing `store/index.tsx` reducer is untouched — it stays pure and independently testable. All persistence side-effects live in `store/sync.ts` (`usePersistentStore`), which replaces direct `useReducer` calls in `app/_layout.tsx`. `lib/bootstrap.ts` and `lib/offline-queue.ts` are stateless utility modules so they can be unit-tested without rendering.

## Complexity Tracking

> No constitution violations identified — section intentionally empty.
