// ── Mocks ─────────────────────────────────────────────────────────
jest.mock('../lib/supabase', () => {
  const makeQuery = (data: unknown[]) => ({
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data, error: null }),
    gte: jest.fn().mockReturnThis(),
  });

  return {
    supabase: {
      from: jest.fn((table: string) => {
        switch (table) {
          case 'goals':        return makeQuery([]);
          case 'goal_subtasks': return makeQuery([]);
          case 'habits':       return makeQuery([]);
          case 'habit_logs':   return makeQuery([]);
          case 'journal_entries': return makeQuery([]);
          default:             return makeQuery([]);
        }
      }),
    },
  };
});

import { bootstrapUserData, computeStreak, deriveDoneToday } from '../lib/bootstrap';
import { localDateISO, addDaysISO } from '../lib/date';
import type { HabitLogRow } from '../lib/supabase';

// ── computeStreak ──────────────────────────────────────────────────
describe('computeStreak', () => {
  // Local-timezone dates so the helper agrees with production "today".
  // d(0) = today, d(1) = yesterday, ...
  const d = (offset: number) => addDaysISO(localDateISO(), -offset);

  const log = (date: string, done = true): HabitLogRow => ({
    id: date,
    habit_id: 'h1',
    user_id: 'u1',
    date,
    done,
    created_at: date,
  });

  it('returns 0 when no logs', () => {
    expect(computeStreak('h1', [])).toBe(0);
  });

  it('returns 0 when no done logs', () => {
    expect(computeStreak('h1', [log(d(1), false)])).toBe(0);
  });

  it('counts today when today is done (no drop after bootstrap)', () => {
    // Regression guard: completing a habit today shows streak 1, and reloading
    // (which re-derives via computeStreak) must not reset it to 0.
    expect(computeStreak('h1', [log(d(0))])).toBe(1);
    expect(computeStreak('h1', [log(d(0)), log(d(1)), log(d(2))])).toBe(3);
  });

  it('counts 3 consecutive days ending yesterday', () => {
    const logs = [log(d(1)), log(d(2)), log(d(3))];
    expect(computeStreak('h1', logs)).toBe(3);
  });

  it('stops at gap — streak from most recent run only', () => {
    // days 1, 2 done; day 3 skipped; day 4 done — streak = 2 (days 1+2)
    const logs = [log(d(1)), log(d(2)), log(d(4))];
    expect(computeStreak('h1', logs)).toBe(2);
  });

  it('returns 0 when yesterday was skipped', () => {
    const logs = [log(d(2)), log(d(3))];
    expect(computeStreak('h1', logs)).toBe(0);
  });

  it('ignores logs for other habits', () => {
    const foreign: HabitLogRow = { id: 'x', habit_id: 'h2', user_id: 'u1', date: d(1), done: true, created_at: '' };
    expect(computeStreak('h1', [foreign])).toBe(0);
  });
});

// ── deriveDoneToday ────────────────────────────────────────────────
describe('deriveDoneToday', () => {
  const today = localDateISO();

  const log = (date: string, done: boolean): HabitLogRow => ({
    id: date,
    habit_id: 'h1',
    user_id: 'u1',
    date,
    done,
    created_at: date,
  });

  it('returns true when log for today is done', () => {
    expect(deriveDoneToday('h1', [log(today, true)])).toBe(true);
  });

  it('returns false when log for today is not done', () => {
    expect(deriveDoneToday('h1', [log(today, false)])).toBe(false);
  });

  it('returns false when no log for today', () => {
    expect(deriveDoneToday('h1', [])).toBe(false);
  });
});

// ── bootstrapUserData ──────────────────────────────────────────────
describe('bootstrapUserData', () => {
  it('returns empty arrays when all tables are empty', async () => {
    const state = await bootstrapUserData();
    expect(state.goals).toEqual([]);
    expect(state.habits).toEqual([]);
    expect(state.journal).toEqual([]);
  });

  it('throws instead of returning no goals when the goals query errors', async () => {
    // An empty list would HYDRATE over the user's goals and overwrite the cache.
    const { supabase } = require('../lib/supabase');
    const makeQuery = (res: { data: unknown; error: unknown }) => ({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue(res),
      gte: jest.fn().mockReturnThis(),
    });
    supabase.from.mockImplementation((table: string) =>
      table === 'goals'
        ? makeQuery({ data: null, error: { message: 'permission denied for table goals' } })
        : makeQuery({ data: [], error: null }),
    );

    await expect(bootstrapUserData()).rejects.toMatchObject({ message: expect.stringContaining('goals') });
  });

  it('maps reminder and calendar fields from the habits row', async () => {
    const { supabase } = require('../lib/supabase');
    const makeQuery = (data: unknown[]) => ({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data, error: null }),
      gte: jest.fn().mockReturnThis(),
    });
    supabase.from.mockImplementation((table: string) => {
      if (table === 'habits') {
        return makeQuery([{
          id: 'h1', user_id: 'u1', label: 'Meditate', icon: '◐', sphere: 'health',
          target_description: '10 min', calendar_event_id: 'evt-1',
          reminder_hour: 8, reminder_minute: 30,
          created_at: '', updated_at: '',
        }]);
      }
      return makeQuery([]);
    });

    const state = await bootstrapUserData();
    expect(state.habits).toHaveLength(1);
    const h = state.habits![0];
    expect(h.calendarEventId).toBe('evt-1');
    expect(h.reminderHour).toBe(8);
    expect(h.reminderMinute).toBe(30);
  });

  it('fires all six queries (parallel fetch)', async () => {
    const { supabase } = require('../lib/supabase');
    await bootstrapUserData();
    // supabase.from should be called once for each of the 6 tables
    expect(supabase.from).toHaveBeenCalledWith('goals');
    expect(supabase.from).toHaveBeenCalledWith('goal_subtasks');
    expect(supabase.from).toHaveBeenCalledWith('habits');
    expect(supabase.from).toHaveBeenCalledWith('habit_logs');
    expect(supabase.from).toHaveBeenCalledWith('journal_entries');
    expect(supabase.from).toHaveBeenCalledWith('coach_messages');
  });
});

// ── coach chat history ─────────────────────────────────────────────
describe('bootstrapUserData coach history', () => {
  it('loads saved coach messages oldest-first', async () => {
    const { supabase } = require('../lib/supabase');
    const makeQuery = (data: unknown[]) => ({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data, error: null }),
      gte: jest.fn().mockReturnThis(),
    });
    supabase.from.mockImplementation((table: string) => makeQuery(table === 'coach_messages'
      // Newest first, as the query asks for.
      ? [
          { id: 'm2', role: 'coach', text: 'Start with three easy runs a week.', created_at: '2026-09-23T10:00:05Z' },
          { id: 'm1', role: 'user', text: 'How do I start running?', created_at: '2026-09-23T10:00:00Z' },
        ]
      : []));

    const state = await bootstrapUserData();
    expect(state.coachMessages).toEqual([
      { id: 'm1', role: 'user', text: 'How do I start running?' },
      { id: 'm2', role: 'coach', text: 'Start with three easy runs a week.' },
    ]);
  });
});
