// ── Mocks ─────────────────────────────────────────────────────────
jest.mock('../lib/supabase', () => {
  const makeQuery = (data: unknown[]) => ({
    select: jest.fn().mockReturnThis(),
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
import type { HabitLogRow } from '../lib/supabase';

// ── computeStreak ──────────────────────────────────────────────────
describe('computeStreak', () => {
  const d = (offset: number) => {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    return day.toISOString().slice(0, 10);
  };

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
  const today = new Date().toISOString().slice(0, 10);

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

  it('fires all five queries (parallel fetch)', async () => {
    const { supabase } = require('../lib/supabase');
    await bootstrapUserData();
    // supabase.from should be called once for each of the 5 tables
    expect(supabase.from).toHaveBeenCalledWith('goals');
    expect(supabase.from).toHaveBeenCalledWith('goal_subtasks');
    expect(supabase.from).toHaveBeenCalledWith('habits');
    expect(supabase.from).toHaveBeenCalledWith('habit_logs');
    expect(supabase.from).toHaveBeenCalledWith('journal_entries');
  });
});
