import { buildWidgetSnapshot, activeDatesFromIntentions } from '../lib/widget-snapshot';
import type { DailyIntention, RitualAction } from '../store/daily-ritual';

const action = (over: Partial<RitualAction> = {}): RitualAction => ({
  id: 'a1',
  text: 'Move $850 to savings',
  sphere: 'finance',
  is_must_do: false,
  done: false,
  source: 'free',
  ...over,
});

const intention = (over: Partial<DailyIntention> = {}): DailyIntention => ({
  id: 'i1',
  user_id: 'u1',
  date: '2025-01-05',
  focus_sphere: 'finance',
  actions: [],
  must_do_done: false,
  journal_line: null,
  next_sphere: null,
  closed_at: null,
  created_at: '2025-01-05T08:00:00Z',
  ...over,
});

const TODAY = '2025-01-05';

describe('buildWidgetSnapshot', () => {
  it('is empty when there is no intention for today (morning ritual not done)', () => {
    const snap = buildWidgetSnapshot({ intention: null, activeDates: [], today: TODAY });
    expect(snap.oneText).toBeNull();
    expect(snap.oneDone).toBe(false);
    expect(snap.focusSphere).toBeNull();
    expect(snap.streak).toBe(0);
    expect(snap.date).toBe(TODAY);
  });

  it("surfaces today's must-do as the One", () => {
    const snap = buildWidgetSnapshot({
      intention: intention({
        focus_sphere: 'health',
        actions: [
          action({ id: 'a1', text: 'Easy 5k run', sphere: 'health', is_must_do: true }),
          action({ id: 'a2', text: 'Drink water' }),
        ],
      }),
      activeDates: [TODAY],
      today: TODAY,
    });
    expect(snap.oneText).toBe('Easy 5k run');
    expect(snap.oneDone).toBe(false);
    expect(snap.focusSphere).toBe('health');
  });

  it('reflects the One being completed', () => {
    const snap = buildWidgetSnapshot({
      intention: intention({
        actions: [action({ is_must_do: true, done: true })],
      }),
      activeDates: [TODAY],
      today: TODAY,
    });
    expect(snap.oneDone).toBe(true);
  });

  it('falls back to null One when no action is flagged must-do', () => {
    const snap = buildWidgetSnapshot({
      intention: intention({ actions: [action(), action({ id: 'a2' })] }),
      activeDates: [TODAY],
      today: TODAY,
    });
    expect(snap.oneText).toBeNull();
  });

  it('computes the streak from active days (today counts)', () => {
    const snap = buildWidgetSnapshot({
      intention: intention({ actions: [action({ is_must_do: true })] }),
      activeDates: ['2025-01-05', '2025-01-04', '2025-01-03'],
      today: TODAY,
    });
    expect(snap.streak).toBe(3);
  });

  it('keeps the streak when today is not yet active but yesterday was', () => {
    const snap = buildWidgetSnapshot({
      intention: null,
      activeDates: ['2025-01-04', '2025-01-03'],
      today: TODAY,
    });
    expect(snap.streak).toBe(2);
  });

  it('always stamps updatedAt', () => {
    const snap = buildWidgetSnapshot({ intention: null, activeDates: [], today: TODAY });
    expect(typeof snap.updatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(snap.updatedAt))).toBe(false);
  });
});

describe('activeDatesFromIntentions', () => {
  it('counts a day where the must-do was completed', () => {
    const dates = activeDatesFromIntentions([
      intention({ date: '2025-01-05', must_do_done: true }),
    ]);
    expect(dates).toEqual(['2025-01-05']);
  });

  it('counts a day where the evening ritual was closed', () => {
    const dates = activeDatesFromIntentions([
      intention({ date: '2025-01-04', must_do_done: false, closed_at: '2025-01-04T21:00:00Z' }),
    ]);
    expect(dates).toEqual(['2025-01-04']);
  });

  it('excludes a day that was started but neither closed nor must-do-done', () => {
    const dates = activeDatesFromIntentions([
      intention({ date: '2025-01-05', must_do_done: false, closed_at: null }),
    ]);
    expect(dates).toEqual([]);
  });

  it('feeds straight into the streak', () => {
    const rows = [
      intention({ date: '2025-01-05', must_do_done: true }),
      intention({ date: '2025-01-04', closed_at: '2025-01-04T21:00:00Z' }),
      intention({ date: '2025-01-02', must_do_done: true }), // gap on the 3rd
    ];
    const snap = buildWidgetSnapshot({
      intention: rows[0],
      activeDates: activeDatesFromIntentions(rows),
      today: TODAY,
    });
    expect(snap.streak).toBe(2);
  });
});
