jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import {
  trialJustEnded, trialReminderAt, trialReminderBody, loadSnapshot, saveSnapshot,
} from '../lib/trial';
import { FREE_STATE, type PlanState } from '../lib/plan-state';

const NOW = new Date('2026-10-01T12:00:00Z');
const trial: PlanState = {
  ...FREE_STATE, plan: 'beyond', isTrial: true, willRenew: true,
  trialEndsAt: '2026-10-08T12:00:00Z', expiresAt: '2026-10-08T12:00:00Z',
};

describe('trialJustEnded', () => {
  it('fires when the last seen state was a trial and the user is now Free', () => {
    expect(trialJustEnded({ plan: 'beyond', isTrial: true }, FREE_STATE, true)).toBe(true);
  });
  it('does not fire before the plan has loaded (cold start placeholder is Free)', () => {
    expect(trialJustEnded({ plan: 'beyond', isTrial: true }, FREE_STATE, false)).toBe(false);
  });
  it('does not fire when the trial converted to paid', () => {
    expect(trialJustEnded({ plan: 'beyond', isTrial: true }, { ...trial, isTrial: false }, true)).toBe(false);
  });
  it('does not fire for a paid subscription that lapsed', () => {
    expect(trialJustEnded({ plan: 'beyond', isTrial: false }, FREE_STATE, true)).toBe(false);
  });
});

describe('trial reminder', () => {
  it('is due two days before the trial ends', () => {
    expect(trialReminderAt(trial, NOW)?.toISOString()).toBe('2026-10-06T12:00:00.000Z');
  });
  it('is not scheduled once the user has cancelled the trial', () => {
    expect(trialReminderAt({ ...trial, willRenew: false }, NOW)).toBeNull();
  });
  it('is not scheduled when the reminder time has passed', () => {
    expect(trialReminderAt(trial, new Date('2026-10-07T00:00:00Z'))).toBeNull();
  });
  it('is not scheduled outside a trial', () => {
    expect(trialReminderAt(FREE_STATE, NOW)).toBeNull();
  });
  it('names the charge and the date', () => {
    expect(trialReminderBody('$3.99', '2026-10-08T12:00:00Z')).toBe(
      "Your free trial ends in 2 days. You'll be charged $3.99 on Oct 8, 2026 unless you cancel.");
    expect(trialReminderBody(null, '2026-10-08T12:00:00Z')).toBe(
      "Your free trial ends in 2 days. You'll be charged on Oct 8, 2026 unless you cancel.");
  });
});

describe('snapshot storage', () => {
  it('round-trips per user', async () => {
    await saveSnapshot('u1', { plan: 'beyond', isTrial: true });
    expect(await loadSnapshot('u1')).toEqual({ plan: 'beyond', isTrial: true });
    expect(await loadSnapshot('u2')).toBeNull();
  });
});
