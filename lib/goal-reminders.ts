// Which goal-due reminders should exist right now. Pure: the reconciler in
// lib/notifications.ts diffs this plan against what's scheduled, so every
// change (create, move, clear, complete, delete, habit check) goes through
// one path (spec 011 FR-010/FR-011).

import type { Goal, HabitItem } from '../store/reducer';
import type { SphereId } from '../constants/theme';
import { addDaysISO, localDateISO } from './date';
import { effectiveDue, goalHealth, goalStatus } from './goal-health';

/** Remind this many days before the due date. */
export const GOAL_REMINDER_LEAD_DAYS = 2;
/**
 * Max reminder days scheduled ahead. iOS keeps at most 64 pending local
 * notifications per app and rituals + habit reminders already use some.
 */
export const GOAL_REMINDER_MAX_DAYS = 10;
export const GOAL_REMINDER_PREFIX = 'goal-due-';

export type PlannedGoalReminder = {
  /** Notification identifier: one per fire day (FR-011). */
  id: string;
  fireAt: Date;
  title: string;
  body: string;
  data: { screen: 'goals'; sphere: SphereId };
};

function at(dayISO: string, hour: number, minute: number): Date {
  const d = new Date(`${dayISO}T00:00:00`);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function dueInWords(fireDay: string, due: string): string {
  const n = Math.round((new Date(`${due}T00:00:00`).getTime() - new Date(`${fireDay}T00:00:00`).getTime()) / 86_400_000);
  return n === 1 ? 'tomorrow' : `in ${n} days`;
}

/**
 * One reminder per goal, at the evening time GOAL_REMINDER_LEAD_DAYS before
 * the due date, or the latest evening still ahead that is before the due day.
 * Goals sharing a fire day are folded into one notification naming the most
 * urgent (at risk first, then lowest health, then soonest due).
 */
export function planGoalReminders(
  goals: readonly Goal[],
  habits: readonly HabitItem[],
  now: Date,
  eveningHour: number,
  eveningMinute: number,
): PlannedGoalReminder[] {
  const today = localDateISO(now);
  type Candidate = { goal: Goal; due: string; fireDay: string; health: number | null; atRisk: boolean };
  const byDay = new Map<string, Candidate[]>();

  for (const goal of goals) {
    if (goal.completedAt) continue;
    const due = effectiveDue(goal);
    if (!due) continue;
    let fireDay: string | null = null;
    for (let lead = GOAL_REMINDER_LEAD_DAYS; lead >= 1; lead--) {
      const day = addDaysISO(due, -lead);
      if (at(day, eveningHour, eveningMinute).getTime() > now.getTime()) { fireDay = day; break; }
    }
    if (!fireDay) continue;
    const health = goalHealth(goal, habits, today);
    const atRisk = goalStatus(goal, health, fireDay).kind === 'at_risk';
    const list = byDay.get(fireDay) ?? [];
    list.push({ goal, due, fireDay, health, atRisk });
    byDay.set(fireDay, list);
  }

  return [...byDay.keys()]
    .sort()
    .slice(0, GOAL_REMINDER_MAX_DAYS)
    .map(day => {
      const list = byDay.get(day)!.sort((a, b) =>
        Number(b.atRisk) - Number(a.atRisk)
        || (a.health ?? 0) - (b.health ?? 0)
        || a.due.localeCompare(b.due));
      const top = list[0];
      const where = top.health === null ? 'no plan yet' : `${Math.round(top.health * 100)}% there`;
      const more = list.length > 1 ? ` (and ${list.length - 1} more)` : '';
      return {
        id: `${GOAL_REMINDER_PREFIX}${day}`,
        fireAt: at(day, eveningHour, eveningMinute),
        title: 'A goal is due soon',
        body: `"${top.goal.title}" is due ${dueInWords(day, top.due)}: ${where}.${more}`,
        data: { screen: 'goals' as const, sphere: top.goal.sphere },
      };
    });
}
