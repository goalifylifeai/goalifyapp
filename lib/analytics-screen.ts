// Pure helpers for screen and notification tracking.

/**
 * expo-router segments → a screen name. Segments hold route templates, so a
 * dynamic id stays `[goalid]` and never reaches analytics. Groups are dropped:
 * ['(tabs)', 'journal'] → 'journal'; [] or ['(tabs)'] → 'home'. Lowercased so
 * it passes the analytics sanitizer.
 */
export function screenName(segments: readonly string[]): string {
  const parts = segments.filter(s => !(s.startsWith('(') && s.endsWith(')')));
  if (parts.length === 0) return segments[0] === '(auth)' ? 'auth' : 'home';
  if (parts[parts.length - 1] === 'index') parts.pop();
  if (parts.length === 0) return segments[0] === '(auth)' ? 'auth' : 'home';
  return parts.join('/').toLowerCase();
}

/** A scheduled notification's identifier → what kind of nudge it was (no habit ids). */
export function notificationKind(identifier: string): string {
  if (identifier === 'ritual-morning') return 'morning';
  if (identifier === 'ritual-lunch') return 'lunch';
  if (identifier === 'ritual-evening') return 'evening';
  if (identifier === 'sentiment-check-in') return 'sentiment';
  if (identifier === 'trial-ending') return 'trial_ending';
  if (identifier.startsWith('habit-reminder-')) return 'habit_reminder';
  return 'other';
}
