import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSphereNudgeSnoozedUntil, snoozeSphereNudge, isSphereNudgeSnoozed, SPHERE_NUDGE_SNOOZE_DAYS,
} from '../lib/sphere-nudge-snooze';

const KEY = '@goalify/sphere_nudge_snoozed_until';
const DAY = 86_400_000;

beforeEach(async () => { await AsyncStorage.clear(); });

describe('sphere nudge snooze', () => {
  it('is not snoozed when nothing is stored', async () => {
    expect(await getSphereNudgeSnoozedUntil()).toBeNull();
    expect(isSphereNudgeSnoozed(null)).toBe(false);
  });

  it('snoozes for 7 days from now and persists it', async () => {
    const now = 1_700_000_000_000;
    const until = await snoozeSphereNudge(now);
    expect(until).toBe(now + SPHERE_NUDGE_SNOOZE_DAYS * DAY);
    expect(await AsyncStorage.getItem(KEY)).toBe(String(until));
    expect(await getSphereNudgeSnoozedUntil()).toBe(until);
  });

  it('expires once the stored time has passed', () => {
    const now = 1_700_000_000_000;
    expect(isSphereNudgeSnoozed(now + 1, now)).toBe(true);
    expect(isSphereNudgeSnoozed(now, now)).toBe(false);
    expect(isSphereNudgeSnoozed(now - 1, now)).toBe(false);
  });

  it('treats a corrupt stored value as not snoozed', async () => {
    await AsyncStorage.setItem(KEY, 'nope');
    expect(await getSphereNudgeSnoozedUntil()).toBeNull();
  });
});
