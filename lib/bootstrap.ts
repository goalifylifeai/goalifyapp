import type { SphereId } from '../constants/theme';
import { supabase, type GoalRow, type GoalSubtaskRow, type HabitRow, type HabitLogRow, type JournalEntryRow } from './supabase';
import type { AppState, Goal, HabitItem, JournalEntry } from '../store/index';

export function computeStreak(habitId: string, logs: HabitLogRow[]): number {
  const doneDates = logs
    .filter(l => l.habit_id === habitId && l.done)
    .map(l => l.date)
    .sort()
    .reverse();

  let streak = 0;
  const day = new Date();
  day.setDate(day.getDate() - 1); // start from yesterday

  for (const date of doneDates) {
    const expected = day.toISOString().slice(0, 10);
    if (date === expected) {
      streak++;
      day.setDate(day.getDate() - 1);
    } else if (date < expected) {
      break;
    }
  }
  return streak;
}

export function deriveDoneToday(habitId: string, logs: HabitLogRow[]): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return logs.some(l => l.habit_id === habitId && l.date === today && l.done);
}

function toGoal(row: GoalRow, subtasks: GoalSubtaskRow[]): Goal {
  const sub = subtasks
    .filter(s => s.goal_id === row.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(s => ({ id: s.id, t: s.text, done: s.done }));
  const progress = sub.length > 0 ? sub.filter(s => s.done).length / sub.length : 0;
  return {
    id: row.id,
    sphere: row.sphere as SphereId,
    title: row.title,
    due: row.due_date ?? '',
    progress,
    sub,
  };
}

function toHabitItem(row: HabitRow, logs: HabitLogRow[]): HabitItem {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    sphere: row.sphere as SphereId,
    streak: computeStreak(row.id, logs),
    target: row.target_description,
    doneToday: deriveDoneToday(row.id, logs),
  };
}

function toJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    date: row.date,
    sphere: row.sphere as SphereId,
    sentiment: row.sentiment,
    excerpt: row.excerpt,
  };
}

export async function bootstrapUserData(): Promise<Partial<AppState>> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceDate = since.toISOString().slice(0, 10);

  const [goalsRes, subtasksRes, habitsRes, logsRes, journalRes] = await Promise.all([
    supabase.from('goals').select('*').order('created_at', { ascending: true }),
    supabase.from('goal_subtasks').select('*').order('sort_order', { ascending: true }),
    supabase.from('habits').select('*').order('created_at', { ascending: true }),
    supabase.from('habit_logs').select('habit_id, user_id, date, done, id, created_at').gte('date', sinceDate).order('date', { ascending: false }),
    supabase.from('journal_entries').select('*').order('date', { ascending: false }),
  ]);

  const goalRows: GoalRow[] = goalsRes.data ?? [];
  const subtaskRows: GoalSubtaskRow[] = subtasksRes.data ?? [];
  const habitRows: HabitRow[] = habitsRes.data ?? [];
  const logRows: HabitLogRow[] = logsRes.data ?? [];
  const journalRows: JournalEntryRow[] = journalRes.data ?? [];

  const goals = goalRows.map(r => toGoal(r, subtaskRows));
  const habits = habitRows.map(r => toHabitItem(r, logRows));
  const journal = journalRows.map(toJournalEntry);

  return { goals, habits, journal };
}
