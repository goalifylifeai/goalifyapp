// Shared date + streak helpers.
//
// All "what day is it" logic in the app must go through here so that a single,
// consistent definition of a calendar day is used everywhere. We deliberately
// use the device's LOCAL timezone (not UTC): a user closing their evening
// ritual at 9pm in UTC-8 should write to today, not tomorrow.

/** YYYY-MM-DD for the given date in the device's local timezone. */
export function localDateISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DISPLAY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Human-readable form of a YYYY-MM-DD string, e.g. "Jan 5, 2026". */
export function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${DISPLAY_MONTHS[month - 1]} ${day}, ${year}`;
}

/** Returns the YYYY-MM-DD `delta` days from the given local-date string. */
export function addDaysISO(iso: string, delta: number): string {
  // Parse as local midnight (no trailing 'Z') so arithmetic stays in local time.
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return localDateISO(d);
}

/**
 * Length of the consecutive-day streak ending today.
 *
 * Today counts if it is present; otherwise the streak is measured ending
 * yesterday (so a streak survives until a full day is actually missed).
 * This is the single source of truth shared by the reducer, the bootstrap
 * loader, and the habits dashboard.
 */
export function streakFromDates(
  dates: Iterable<string>,
  today: string = localDateISO(),
): number {
  const set = dates instanceof Set ? dates : new Set(dates);
  let cursor = set.has(today) ? today : addDaysISO(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}

// ── Daily ritual streak with rest days ──────────────────────────────
//
// Spec: specs/010-gamification-foundation (FR-011 – FR-013).
//
// Every 7 consecutive active days earns one rest day (hold at most
// REST_DAYS_MAX). A single missed day consumes a held rest day
// automatically: the streak survives but the rest day doesn't add to the
// count. A miss with no rest day held resets the streak. Today being
// not-yet-active never consumes anything — the streak is measured through
// yesterday until today is done.
//
// Rest days are *derived* from the date history (a forward pass), never
// stored, so there is no state to sync and devices can't disagree.
//
// MUST stay in lockstep with public.compute_streak_state() in
// supabase/migrations/0025_streak_rest_days.sql. Both are tested against
// __tests__/fixtures/streak-cases.json.

/** Active days needed to earn one rest day. */
export const REST_DAY_EVERY = 7;
/** Maximum rest days a user can hold at once. */
export const REST_DAYS_MAX = 1;
/** How far back the streak looks. The SQL mirror uses the same window. */
export const STREAK_HISTORY_DAYS = 400;

export type StreakState = {
  /** Active days in the current run (rest days don't add to it). */
  streak: number;
  /** Rest days currently held (0..REST_DAYS_MAX). */
  restDaysHeld: number;
  /** Local dates inside the history window that were covered by a rest day. */
  restDates: string[];
};

export function streakState(
  dates: Iterable<string>,
  today: string = localDateISO(),
): StreakState {
  const set = dates instanceof Set ? dates : new Set(dates);
  let streak = 0;
  let held = 0;
  const restDates: string[] = [];

  const step = (day: string) => {
    streak++;
    if (streak % REST_DAY_EVERY === 0) held = Math.min(REST_DAYS_MAX, held + 1);
  };

  // Forward pass over the window, up to and including yesterday.
  let cursor = addDaysISO(today, -STREAK_HISTORY_DAYS);
  while (cursor < today) {
    if (set.has(cursor)) {
      step(cursor);
    } else if (streak > 0 && held > 0) {
      held--;
      restDates.push(cursor);
    } else {
      streak = 0;
      held = 0;
    }
    cursor = addDaysISO(cursor, 1);
  }
  // Today only ever adds; it never breaks or consumes.
  if (set.has(today)) step(today);

  return { streak, restDaysHeld: held, restDates };
}
