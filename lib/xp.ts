// Earned XP: the client-side mirror of the server ledger.
//
// Spec: specs/010-gamification-foundation (FR-002, FR-010).
// The database (supabase/migrations/0027_xp_events.sql) awards XP and is the
// source of truth. This file only estimates the XP of local changes that
// haven't been confirmed by a server fetch yet, so progress feels instant
// (and works offline). The estimate ignores daily caps and first-time
// bonuses; the next fetch corrects it.
//
// MUST stay in lockstep with the XP amounts in 0027_xp_events.sql.

import type { AppState } from '../store/reducer';

export const XP = {
  subtask_done: 10,
  goal_completed: 100,
  ritual_locked: 15,
  must_do_done: 15,
  ritual_closed: 20,
  habit_done: 5,
  journal_entry: 10,
  first_bonus: 50,
} as const;

/** Daily caps (per local day), mirrored from the SQL triggers. */
export const XP_DAILY_CAP = {
  subtask_done: 10,
  goal_completed: 3,
  habit_done: 10,
} as const;

/** Streak milestones: days in a row → XP, once ever each. */
export const STREAK_MILESTONES: ReadonlyArray<readonly [days: number, xp: number]> = [
  [7, 50], [30, 200], [100, 500], [365, 1500],
];

type StoreSlice = Pick<AppState, 'goals' | 'habits' | 'journal'>;

/** Estimated XP change between two store states (can be negative). */
export function xpDeltaForStore(prev: StoreSlice, next: StoreSlice): number {
  let delta = 0;

  const prevGoals = new Map(prev.goals.map(g => [g.id, g]));
  for (const g of next.goals) {
    const before = prevGoals.get(g.id);
    const wasDone = new Set(before?.sub.filter(s => s.done).map(s => s.id) ?? []);
    const isDone = new Set(g.sub.filter(s => s.done).map(s => s.id));
    // Only changes to subtasks that exist in both states: a subtask that
    // disappears (goal/subtask deleted) keeps its XP, per FR-006.
    const beforeIds = new Set(before?.sub.map(s => s.id) ?? []);
    for (const s of g.sub) {
      if (isDone.has(s.id) && !wasDone.has(s.id)) delta += XP.subtask_done;
      if (!isDone.has(s.id) && wasDone.has(s.id) && beforeIds.has(s.id)) delta -= XP.subtask_done;
    }
    if (before) {
      if (g.completedAt && !before.completedAt) delta += XP.goal_completed;
      if (!g.completedAt && before.completedAt) delta -= XP.goal_completed;
    } else if (g.completedAt) {
      delta += XP.goal_completed;
    }
  }

  const prevHabits = new Map(prev.habits.map(h => [h.id, h]));
  for (const h of next.habits) {
    const before = prevHabits.get(h.id);
    if (!before) continue;
    if (h.doneToday && !before.doneToday) delta += XP.habit_done;
    if (!h.doneToday && before.doneToday) delta -= XP.habit_done;
  }

  // Journal: one award per local day.
  const prevDays = new Set(prev.journal.map(e => e.date));
  const newDays = new Set(next.journal.filter(e => !prevDays.has(e.date)).map(e => e.date));
  delta += newDays.size * XP.journal_entry;

  return delta;
}

// ── Local change bus ────────────────────────────────────────────────
// store/sync.ts emits estimated deltas for store actions; the ritual store
// asks for a refresh after its (online-only) writes land. store/xp.tsx listens.

type Listener = (event: { delta: number } | { refresh: true }) => void;
const listeners = new Set<Listener>();

export function onXpChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitLocalXp(delta: number): void {
  if (delta === 0) return;
  listeners.forEach(l => l({ delta }));
}

export function requestXpRefresh(): void {
  listeners.forEach(l => l({ refresh: true }));
}
