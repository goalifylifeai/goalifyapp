import { addDaysISO } from './date';

type Entry = { date: string; sentiment: number };

export type SentimentSummary = {
  /** Mean sentiment of entries in the window, or null if there are none. */
  avg: number | null;
  /** avg minus the previous window's mean, or null if either window is empty. */
  delta: number | null;
  /** One point per day that has entries (daily mean), oldest first. */
  series: { date: string; value: number }[];
};

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/**
 * Summarises journal sentiment over the `days`-day window ending `today`
 * (inclusive), compared with the equally long window before it.
 */
export function sentimentSummary(entries: Entry[], today: string, days = 30): SentimentSummary {
  const start = addDaysISO(today, -(days - 1));
  const prevStart = addDaysISO(start, -days);

  const current = entries.filter(e => e.date >= start && e.date <= today);
  const previous = entries.filter(e => e.date >= prevStart && e.date < start);

  const byDay = new Map<string, number[]>();
  for (const e of current) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e.sentiment]);
  const series = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, value: mean(vals)! }));

  const avg = mean(current.map(e => e.sentiment));
  const prevAvg = mean(previous.map(e => e.sentiment));
  return { avg, delta: avg !== null && prevAvg !== null ? avg - prevAvg : null, series };
}
