// What the level-up / achievement moment should show. Pure.
// Spec: specs/012-levels-achievements (Story 1, FR-006, FR-007).

import { knownKeys } from './achievements';

export type Seen = {
  /** Highest level already celebrated (or silently recorded), null if never recorded. */
  level: number | null;
  /** Achievement keys already celebrated (or silently recorded), null if never recorded. */
  achievements: string[] | null;
};

export type Moment = {
  /** New level to celebrate (the highest one, if several were gained), else null. */
  level: number | null;
  /** Newly unlocked, known achievement keys, in catalogue order. */
  achievements: string[];
};

/**
 * Decide what to celebrate from server-confirmed data.
 *
 * `seed` is what to record silently because this is the first time we've seen
 * this user on this device (010 FR-014 / 012 AS1.3): everything already
 * earned counts as seen. `moment` is null when there's nothing to show.
 */
export function decideMoment(
  // achievements: null = not loaded (e.g. the read failed, or migration 0030
  // isn't applied yet). Then only the level is considered, and nothing about
  // achievements is seeded, so a later successful load can't mistake every
  // existing achievement for a new one.
  current: { level: number; achievements: readonly string[] | null },
  seen: Seen,
): { seed: Partial<{ level: number; achievements: string[] }>; moment: Moment | null } {
  const seed: Partial<{ level: number; achievements: string[] }> = {};
  const seenLevel = seen.level ?? current.level;
  if (seen.level === null) seed.level = current.level;

  let achievements: string[] = [];
  if (current.achievements !== null) {
    const seenAch = new Set(seen.achievements ?? current.achievements);
    if (seen.achievements === null) seed.achievements = [...current.achievements];
    achievements = knownKeys(current.achievements.filter(k => !seenAch.has(k)));
  }

  const level = current.level > seenLevel ? current.level : null;
  return { seed, moment: level !== null || achievements.length > 0 ? { level, achievements } : null };
}

/** Seen state after the user dismisses `moment`. */
export function afterDismiss(seen: Seen, moment: Moment, allUnlocked: readonly string[]): { level: number | null; achievements: string[] } {
  const level = moment.level !== null ? Math.max(moment.level, seen.level ?? 0) : seen.level;
  // Record what was shown, plus unlocked keys this app version doesn't know,
  // so they aren't celebrated retroactively after an update. A *known* key
  // that arrived while the moment was open is left unseen, so it gets its own
  // moment instead of being swallowed.
  const known = new Set(knownKeys(allUnlocked));
  const unknown = allUnlocked.filter(k => !known.has(k));
  const achievements = [...new Set([...(seen.achievements ?? []), ...moment.achievements, ...unknown])];
  return { level, achievements };
}

/** Only interrupt on the main tabs, never mid-ritual or in onboarding (FR-007). */
export function canShowMomentOn(segments: readonly string[]): boolean {
  return segments[0] === '(tabs)';
}
