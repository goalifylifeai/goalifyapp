import { sentimentSummary } from '../lib/journal-stats';

describe('sentimentSummary', () => {
  const today = '2026-09-23';

  it('returns nulls and an empty series with no entries', () => {
    expect(sentimentSummary([], today)).toEqual({ avg: null, delta: null, series: [] });
  });

  it('averages only entries inside the 30-day window', () => {
    const s = sentimentSummary([
      { date: '2026-09-23', sentiment: 0.5 },
      { date: '2026-08-25', sentiment: -0.1 }, // first day of window
      { date: '2026-08-24', sentiment: -0.9 }, // previous window
    ], today);
    expect(s.avg).toBeCloseTo(0.2);
    expect(s.delta).toBeCloseTo(0.2 - -0.9);
  });

  it('has no delta when the previous window is empty', () => {
    expect(sentimentSummary([{ date: today, sentiment: 0.4 }], today).delta).toBeNull();
  });

  it('builds a sorted daily-mean series', () => {
    const s = sentimentSummary([
      { date: '2026-09-22', sentiment: 0.6 },
      { date: '2026-09-20', sentiment: -0.2 },
      { date: '2026-09-22', sentiment: 0.2 },
    ], today);
    expect(s.series.map(p => p.date)).toEqual(['2026-09-20', '2026-09-22']);
    expect(s.series[1].value).toBeCloseTo(0.4);
  });
});
