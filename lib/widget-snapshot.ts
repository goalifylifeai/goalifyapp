// The data the home-screen widget renders.
//
// Widgets cannot run the React Native JS bundle — they read a small snapshot
// from a shared OS container (iOS App Group / Android SharedPreferences). This
// module builds that snapshot from app state; `writeWidgetSnapshot` (native)
// persists it. Keeping the builder pure makes the widget's contents unit-testable
// without a device build.

import type { SphereId } from '../constants/theme';
import type { DailyIntention } from '../store/daily-ritual';
import { localDateISO, streakFromDates } from './date';

export type WidgetSnapshot = {
  /** Local YYYY-MM-DD this snapshot describes. */
  date: string;
  /** Today's must-do action text, or null if the morning ritual isn't set yet. */
  oneText: string | null;
  /** Whether the One is checked off. */
  oneDone: boolean;
  /** Consecutive "active" days ending today (today counts once it's active). */
  streak: number;
  /** Today's focus sphere, for the tile's accent color. */
  focusSphere: SphereId | null;
  /** ISO timestamp of when this snapshot was built. */
  updatedAt: string;
};

/**
 * Dates that count toward the daily "showing up" streak: a day is active once
 * its ritual was completed — the must-do was checked off, or the evening ritual
 * was closed. Mirrors the rule shown on the streak-info screen.
 */
export function activeDatesFromIntentions(
  rows: Pick<DailyIntention, 'date' | 'must_do_done' | 'closed_at'>[],
): string[] {
  return rows
    .filter(r => r.must_do_done || r.closed_at != null)
    .map(r => r.date);
}

export function buildWidgetSnapshot(args: {
  intention: DailyIntention | null;
  activeDates: Iterable<string>;
  today?: string;
}): WidgetSnapshot {
  const today = args.today ?? localDateISO();
  const mustDo = args.intention?.actions.find(a => a.is_must_do) ?? null;

  return {
    date: today,
    oneText: mustDo?.text ?? null,
    oneDone: mustDo?.done ?? false,
    streak: streakFromDates(args.activeDates, today),
    focusSphere: args.intention?.focus_sphere ?? null,
    updatedAt: new Date().toISOString(),
  };
}
