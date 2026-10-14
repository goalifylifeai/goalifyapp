import AsyncStorage from '@react-native-async-storage/async-storage';

// "Not now" on the home-screen empty-sphere nudge. One global snooze per
// device (not per sphere): the point is to stop nagging, not to track which
// sphere the user declined. Stored as an epoch-ms timestamp; absent or past
// means "show".
const KEY = '@goalify/sphere_nudge_snoozed_until';
export const SPHERE_NUDGE_SNOOZE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function getSphereNudgeSnoozedUntil(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function snoozeSphereNudge(now: number = Date.now()): Promise<number> {
  const until = now + SPHERE_NUDGE_SNOOZE_DAYS * DAY_MS;
  try {
    await AsyncStorage.setItem(KEY, String(until));
  } catch {
    // Best-effort: the in-memory state still hides it for this session.
  }
  return until;
}

export function isSphereNudgeSnoozed(until: number | null, now: number = Date.now()): boolean {
  return until !== null && until > now;
}
