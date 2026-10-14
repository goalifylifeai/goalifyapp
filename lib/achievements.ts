// Achievement catalogue: display copy for the keys the database awards.
// Spec: specs/012-levels-achievements (FR-005).
//
// The database decides what is unlocked (supabase/migrations/0030_achievements.sql,
// evaluate_achievements()). This file only names and describes the keys, and
// MUST stay in lockstep with them. A key the server sends that isn't listed
// here is ignored, so new server-side achievements never break old apps.

export type AchievementFamily = 'firsts' | 'streak' | 'volume' | 'balance';

export type Achievement = {
  key: string;
  family: AchievementFamily;
  title: string;
  /** How it's earned; shown on locked achievements too. */
  howTo: string;
};

export const ACHIEVEMENT_FAMILIES: { id: AchievementFamily; label: string }[] = [
  { id: 'firsts',  label: 'Firsts' },
  { id: 'streak',  label: 'Streaks' },
  { id: 'volume',  label: 'Keep going' },
  { id: 'balance', label: 'Balance' },
];

export const ACHIEVEMENTS: Achievement[] = [
  { key: 'first:subtask_done',   family: 'firsts', title: 'First step',          howTo: 'Finish a subtask.' },
  { key: 'first:goal_completed', family: 'firsts', title: 'Done is done',        howTo: 'Complete a goal.' },
  { key: 'first:ritual_locked',  family: 'firsts', title: 'Morning person',      howTo: 'Lock your morning ritual.' },
  { key: 'first:must_do_done',   family: 'firsts', title: 'The One',             howTo: "Check off the day's must-do." },
  { key: 'first:ritual_closed',  family: 'firsts', title: 'Closing time',        howTo: 'Close the day in the evening ritual.' },
  { key: 'first:habit_done',     family: 'firsts', title: 'Habit formed',        howTo: 'Check off a habit.' },
  { key: 'first:journal_entry',  family: 'firsts', title: 'Dear diary',          howTo: 'Write a journal entry.' },

  { key: 'streak:7',   family: 'streak', title: 'One week',   howTo: 'Show up 7 days in a row.' },
  { key: 'streak:30',  family: 'streak', title: 'One month',  howTo: 'Show up 30 days in a row.' },
  { key: 'streak:100', family: 'streak', title: 'Hundred',    howTo: 'Show up 100 days in a row.' },
  { key: 'streak:365', family: 'streak', title: 'Full orbit', howTo: 'Show up 365 days in a row.' },

  { key: 'goals:5',     family: 'volume', title: 'Five goals down',  howTo: 'Complete 5 goals.' },
  { key: 'goals:25',    family: 'volume', title: 'Goal getter',      howTo: 'Complete 25 goals.' },
  { key: 'habits:50',   family: 'volume', title: 'Fifty checks',     howTo: 'Check off habits 50 times.' },
  { key: 'habits:250',  family: 'volume', title: 'Second nature',    howTo: 'Check off habits 250 times.' },
  { key: 'evenings:10', family: 'volume', title: 'Ten evenings',     howTo: 'Close the day 10 times.' },
  { key: 'evenings:50', family: 'volume', title: 'Night owl',        howTo: 'Close the day 50 times.' },

  { key: 'balanced_week', family: 'balance', title: 'Balanced week', howTo: 'Make progress in all four spheres in one week (Mon–Sun).' },
];

const BY_KEY = new Map(ACHIEVEMENTS.map(a => [a.key, a]));

export function achievementFor(key: string): Achievement | undefined {
  return BY_KEY.get(key);
}

/** Server keys the app knows about, in catalogue order. */
export function knownKeys(keys: Iterable<string>): string[] {
  const have = new Set(keys);
  return ACHIEVEMENTS.filter(a => have.has(a.key)).map(a => a.key);
}
