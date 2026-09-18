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
