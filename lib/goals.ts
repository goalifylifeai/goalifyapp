import type { Goal } from '../store/reducer';

export function isCompleted(g: Goal): boolean {
  return !!g.completedAt;
}

/** Goals still being worked on, in their existing order. */
export function activeGoals(goals: Goal[]): Goal[] {
  return goals.filter(g => !isCompleted(g));
}

/** Completed goals, most recently completed first. */
export function completedGoals(goals: Goal[]): Goal[] {
  return goals
    .filter(isCompleted)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
}
