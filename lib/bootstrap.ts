import type { SphereId } from '../constants/theme';
import { supabase, type CoachMessageRow, type GoalRow, type GoalSubtaskRow, type HabitRow, type HabitLogRow, type JournalEntryRow } from './supabase';
import type { AppState, ChatMessage, Goal, HabitItem, JournalEntry } from '../store/index';
import { localDateISO, streakFromDates } from './date';

export function computeStreak(habitId: string, logs: HabitLogRow[]): number {
  const doneDates = logs
    .filter(l => l.habit_id === habitId && l.done)
    .map(l => l.date);
  return streakFromDates(doneDates);
}

export function deriveDoneToday(habitId: string, logs: HabitLogRow[]): boolean {
  const today = localDateISO();
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
    completedAt: row.completed_at ?? undefined,
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
    calendarEventId: row.calendar_event_id ?? undefined,
    reminderHour: row.reminder_hour,
    reminderMinute: row.reminder_minute,
  };
}

function toJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    date: row.date,
    sentiment: row.sentiment,
    excerpt: row.excerpt,
    body: row.body ?? undefined,
  };
}

// Saved coach chat, most recent last. Only the latest turns are loaded.
const COACH_HISTORY_LIMIT = 100;

function toChatMessage(row: CoachMessageRow): ChatMessage {
  return { id: row.id, role: row.role, text: row.text };
}

export async function bootstrapUserData(): Promise<Partial<AppState>> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceDate = localDateISO(since);

  const [goalsRes, subtasksRes, habitsRes, logsRes, journalRes, coachRes] = await Promise.all([
    supabase.from('goals').select('*').order('created_at', { ascending: true }),
    supabase.from('goal_subtasks').select('*').order('sort_order', { ascending: true }),
    supabase.from('habits').select('*').order('created_at', { ascending: true }),
    supabase.from('habit_logs').select('habit_id, user_id, date, done, id, created_at').gte('date', sinceDate).order('date', { ascending: false }),
    supabase.from('journal_entries').select('*').order('date', { ascending: false }),
    supabase.from('coach_messages').select('id, role, text, created_at').limit(COACH_HISTORY_LIMIT).order('created_at', { ascending: false }),
  ]);

  // A failed read must not look like an empty account: the caller HYDRATEs
  // this over local state and the cache. Throw so the cached data stays.
  const core = { goals: goalsRes, goal_subtasks: subtasksRes, habits: habitsRes, habit_logs: logsRes, journal_entries: journalRes };
  for (const [table, res] of Object.entries(core)) {
    if (res.error) throw new Error(`${table}: ${res.error.message}`);
  }

  const goalRows: GoalRow[] = goalsRes.data ?? [];
  const subtaskRows: GoalSubtaskRow[] = subtasksRes.data ?? [];
  const habitRows: HabitRow[] = habitsRes.data ?? [];
  const logRows: HabitLogRow[] = logsRes.data ?? [];
  const journalRows: JournalEntryRow[] = journalRes.data ?? [];
  const coachRows: CoachMessageRow[] = coachRes.data ?? [];

  const goals = goalRows.map(r => toGoal(r, subtaskRows));
  const habits = habitRows.map(r => toHabitItem(r, logRows));
  const journal = journalRows.map(toJournalEntry);

  const coachMessages = [...coachRows].reverse().map(toChatMessage);

  return { goals, habits, journal, coachMessages };
}
