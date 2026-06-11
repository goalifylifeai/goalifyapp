import { localDateISO, addDaysISO, streakFromDates } from '../lib/date';

// ── localDateISO ───────────────────────────────────────────────────
describe('localDateISO', () => {
  it('formats a date from local calendar components (not UTC)', () => {
    // Constructed from local components → must echo them regardless of tz.
    expect(localDateISO(new Date(2025, 0, 5))).toBe('2025-01-05');
  });

  it('uses the local day even late in the evening (no UTC rollover)', () => {
    // 23:30 local on Jan 5 is still Jan 5 locally, even though it may be
    // Jan 6 in UTC for timezones ahead of UTC.
    expect(localDateISO(new Date(2025, 0, 5, 23, 30))).toBe('2025-01-05');
  });

  it('uses the local day early in the morning (no UTC rollback)', () => {
    // 00:30 local on Jan 5 is still Jan 5 locally, even though it may be
    // Jan 4 in UTC for timezones behind UTC.
    expect(localDateISO(new Date(2025, 0, 5, 0, 30))).toBe('2025-01-05');
  });

  it('zero-pads month and day', () => {
    expect(localDateISO(new Date(2025, 2, 7))).toBe('2025-03-07');
  });
});

// ── addDaysISO ─────────────────────────────────────────────────────
describe('addDaysISO', () => {
  it('subtracts a day', () => {
    expect(addDaysISO('2025-01-05', -1)).toBe('2025-01-04');
  });

  it('adds a day', () => {
    expect(addDaysISO('2025-01-05', 1)).toBe('2025-01-06');
  });

  it('rolls back across a month boundary', () => {
    expect(addDaysISO('2025-03-01', -1)).toBe('2025-02-28');
  });

  it('rolls forward across a year boundary', () => {
    expect(addDaysISO('2025-12-31', 1)).toBe('2026-01-01');
  });
});

// ── streakFromDates ────────────────────────────────────────────────
describe('streakFromDates', () => {
  const today = '2025-01-05';

  it('returns 0 for no dates', () => {
    expect(streakFromDates([], today)).toBe(0);
  });

  it('counts today when today is present', () => {
    // The bug being fixed: completing a habit today must show streak 1,
    // and must NOT drop to 0 after a reload/bootstrap.
    expect(streakFromDates(['2025-01-05'], today)).toBe(1);
  });

  it('counts a run that ends today', () => {
    expect(streakFromDates(['2025-01-05', '2025-01-04', '2025-01-03'], today)).toBe(3);
  });

  it('counts a run that ends yesterday when today is missing', () => {
    expect(streakFromDates(['2025-01-04', '2025-01-03'], today)).toBe(2);
  });

  it('returns 0 when neither today nor yesterday is present', () => {
    expect(streakFromDates(['2025-01-03', '2025-01-02'], today)).toBe(0);
  });

  it('stops at the first gap', () => {
    // today + yesterday done, then a gap, then more — only the recent run counts.
    expect(streakFromDates(['2025-01-05', '2025-01-04', '2025-01-02'], today)).toBe(2);
  });

  it('accepts a Set and ignores duplicates', () => {
    expect(streakFromDates(new Set(['2025-01-05', '2025-01-05', '2025-01-04']), today)).toBe(2);
  });

  it('defaults today to the local current date', () => {
    expect(streakFromDates([localDateISO()])).toBe(1);
  });
});
