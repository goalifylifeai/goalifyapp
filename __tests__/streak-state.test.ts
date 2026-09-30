import { streakState, streakFromDates, STREAK_HISTORY_DAYS } from '../lib/date';
import cases from './fixtures/streak-cases.json';

// Shared fixtures: the SQL mirror (public.compute_streak_state) is checked
// against the same file by supabase/tests/streak_parity.sql. Change both or neither.
describe('streakState (shared fixtures)', () => {
  it.each(cases.map(c => [c.name, c]))('%s', (_name, c: any) => {
    expect(streakState(c.dates, c.today)).toEqual({
      streak: c.streak,
      restDaysHeld: c.restDaysHeld,
      restDates: c.restDates,
    });
  });
});

describe('streakState vs streakFromDates', () => {
  it('matches the old rule when there are no gaps', () => {
    const dates = ['2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28', '2026-06-29'];
    expect(streakState(dates, '2026-06-30').streak).toBe(streakFromDates(dates, '2026-06-30'));
  });

  it('uses a 400-day window', () => {
    expect(STREAK_HISTORY_DAYS).toBe(400);
  });
});
