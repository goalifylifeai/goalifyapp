// Goal health: how a goal is really doing, derived from local state.
// Spec: specs/011-goal-health.
//
// Pure functions only: every surface (Goals tab, Home sphere balance, score
// screen, evening ritual, vision overlay, reminders) calls these, so they can
// never disagree (FR-003). Nothing here is stored or synced, and none of it
// touches XP or streaks (FR-015) — `Goal.progress` stays the raw subtask
// ratio that the legacy XP formula and analytics read.

import type { Goal, HabitItem } from '../store/reducer';
import { addDaysISO, localDateISO } from './date';

/** Trailing window for linked-habit consistency, in local calendar days. */
export const HABIT_WINDOW_DAYS = 7;
/** A goal due within this many days can be "at risk". */
export const AT_RISK_WINDOW_DAYS = 7;
/** At or above this health a goal is never "at risk" (FR-006 floor). */
export const AT_RISK_HEALTH_FLOOR = 0.8;

/** Whole days from `from` to `to` (YYYY-MM-DD, local). Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Local calendar day a goal was created, if known. */
export function createdDay(goal: Goal): string | null {
  if (!goal.createdAt) return null;
  const d = new Date(goal.createdAt);
  return Number.isNaN(d.getTime()) ? null : localDateISO(d);
}

/**
 * The due date that counts, or null. Before 011 the form defaulted the due
 * date to the creation day and couldn't clear it, so a goal due on the day it
 * was created is treated as undated (FR-009, display-only: the stored value
 * is untouched). The form no longer offers "today" as a due date.
 */
export function effectiveDue(goal: Goal): string | null {
  if (!goal.due) return null;
  const created = createdDay(goal);
  if (created && created === goal.due) return null;
  return goal.due;
}

/**
 * Share of the trailing window the habit was done. The window ends today if
 * today is already checked, otherwise yesterday, so health doesn't dip every
 * morning before the user has had a chance to act.
 */
export function habitConsistency(habit: HabitItem, today: string = localDateISO()): number {
  const done = new Set(habit.history ?? []);
  if (habit.doneToday) done.add(today);
  const countEnding = (end: string) => {
    let n = 0;
    for (let i = 0; i < HABIT_WINDOW_DAYS; i++) if (done.has(addDaysISO(end, -i))) n++;
    return n;
  };
  return Math.max(countEnding(today), countEnding(addDaysISO(today, -1))) / HABIT_WINDOW_DAYS;
}

export function linkedHabits(goal: Goal, habits: readonly HabitItem[]): HabitItem[] {
  return habits.filter(h => h.goalId === goal.id);
}

export type HealthParts = {
  /** Done ÷ total subtasks, or null with no subtasks. */
  subtasks: number | null;
  /** Mean consistency of linked habits, or null with none linked. */
  habits: number | null;
  /** Number of linked habits. */
  habitCount: number;
};

export function healthParts(goal: Goal, habits: readonly HabitItem[], today: string = localDateISO()): HealthParts {
  const subtasks = goal.sub.length > 0 ? goal.sub.filter(s => s.done).length / goal.sub.length : null;
  const linked = linkedHabits(goal, habits);
  const habitScore = linked.length > 0
    ? linked.reduce((sum, h) => sum + habitConsistency(h, today), 0) / linked.length
    : null;
  return { subtasks, habits: habitScore, habitCount: linked.length };
}

/**
 * Health in [0, 1], or null for "no plan yet" (no subtasks, no linked
 * habits). A completed goal is 1. With both components present, their mean.
 */
export function goalHealth(goal: Goal, habits: readonly HabitItem[], today: string = localDateISO()): number | null {
  if (goal.completedAt) return 1;
  const { subtasks, habits: h } = healthParts(goal, habits, today);
  if (subtasks === null && h === null) return null;
  if (subtasks === null) return h;
  if (h === null) return subtasks;
  return (subtasks + h) / 2;
}

export type GoalStatus =
  | { kind: 'completed' }
  | { kind: 'overdue'; days: number }
  | { kind: 'at_risk'; daysLeft: number }
  | { kind: 'no_plan' }
  | { kind: 'on_track' };

/**
 * Overdue: due date passed, not completed (FR-005, FR-007).
 * At risk: due within 7 days and health below the share of the goal's
 * lifetime already elapsed, unless health ≥ 0.8 (FR-006). A goal with no plan
 * counts as 0 here — nothing is moving it and the date is close.
 */
export function goalStatus(goal: Goal, health: number | null, today: string = localDateISO()): GoalStatus {
  if (goal.completedAt) return { kind: 'completed' };
  const due = effectiveDue(goal);
  if (due) {
    const daysLeft = daysBetween(today, due);
    if (daysLeft < 0) return { kind: 'overdue', days: -daysLeft };
    if (daysLeft <= AT_RISK_WINDOW_DAYS) {
      const h = health ?? 0;
      const created = createdDay(goal);
      const span = created ? daysBetween(created, due) : 0;
      const elapsed = span > 0 ? Math.min(1, Math.max(0, daysBetween(created!, today) / span)) : 1;
      if (h < AT_RISK_HEALTH_FLOOR && h < elapsed) return { kind: 'at_risk', daysLeft };
    }
  }
  return health === null ? { kind: 'no_plan' } : { kind: 'on_track' };
}

const URGENCY: Record<GoalStatus['kind'], number> = { overdue: 0, at_risk: 1, no_plan: 2, on_track: 2, completed: 3 };

/** Overdue first, then at risk, then everything else in its existing order (stable). FR-008. */
export function sortByUrgency<T>(items: readonly T[], statusOf: (item: T) => GoalStatus): T[] {
  return items
    .map((item, i) => ({ item, i, rank: URGENCY[statusOf(item).kind] }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(x => x.item);
}
