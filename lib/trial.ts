import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDate, type Plan, type PlanState } from './plan-state';

export type PlanSnapshot = { plan: Plan; isTrial: boolean };

const DAY_MS = 24 * 60 * 60 * 1000;
const key = (userId: string) => `plan-snapshot:${userId}`;

/** U6: the last state we saw was a trial and the user is now Free (cancelled trial ended). */
export function trialJustEnded(prev: PlanSnapshot | null, current: PlanState, loaded: boolean): boolean {
  return loaded && !!prev?.isTrial && current.plan === 'free';
}

/** Day 5 of 7: two days before the first charge, only if the trial will convert. */
export function trialReminderAt(s: PlanState, now: Date): Date | null {
  if (!s.isTrial || !s.willRenew || !s.trialEndsAt) return null;
  const at = new Date(Date.parse(s.trialEndsAt) - 2 * DAY_MS);
  return at.getTime() > now.getTime() ? at : null;
}

export function trialReminderBody(priceString: string | null, trialEndsAt: string): string {
  const charge = priceString ? `charged ${priceString}` : 'charged';
  return `Your free trial ends in 2 days. You'll be ${charge} on ${formatDate(trialEndsAt)} unless you cancel.`;
}

export async function loadSnapshot(userId: string): Promise<PlanSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as PlanSnapshot) : null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(userId: string, s: PlanSnapshot): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify(s)).catch(() => {});
}
