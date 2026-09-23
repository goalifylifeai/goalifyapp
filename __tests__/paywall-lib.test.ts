jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { router } from 'expo-router';
import {
  openPaywall, takePendingAction, dropPendingAction, paywallHeadline, primaryLabel,
  annualSavingsPercent, renewalTerms,
} from '../lib/paywall';
import type { PaywallPackage } from '../lib/purchases';

const monthly: PaywallPackage = { period: 'monthly', productId: 'beyond_monthly', priceString: '$3.99', price: 3.99, hasFreeTrial: true, raw: {} };
const annual: PaywallPackage = { period: 'annual', productId: 'beyond_annual', priceString: '$29.99', price: 29.99, hasFreeTrial: true, raw: {} };
const push = router.push as jest.Mock;

beforeEach(() => push.mockClear());

describe('openPaywall and pending actions', () => {
  it('opens with just the source when there is nothing to continue', () => {
    openPaywall('profile');
    expect(push).toHaveBeenCalledWith({ pathname: '/paywall', params: { source: 'profile' } });
  });
  it('stores the continuation under a token, handed out once', () => {
    const action = jest.fn();
    openPaywall('vision_regen', action);
    const token = push.mock.calls[0][0].params.token as string;
    expect(token).toBeTruthy();
    expect(takePendingAction(token)).toBe(action);
    expect(takePendingAction(token)).toBeUndefined();
  });
  it('drops a continuation when the paywall is dismissed', () => {
    openPaywall('insights', jest.fn());
    const token = push.mock.calls[0][0].params.token as string;
    dropPendingAction(token);
    expect(takePendingAction(token)).toBeUndefined();
  });
});

describe('copy', () => {
  it('picks the headline per source', () => {
    expect(paywallHeadline('vision_regen')).toBe('See it. Build it. Become it.');
    expect(paywallHeadline('welcome')).toBe('Try Goalify Beyond free for 7 days');
    expect(paywallHeadline('chat_limit')).toBe('Go Beyond: your coach, your vision, no limits.');
  });
  it('labels the main button by trial eligibility and period', () => {
    expect(primaryLabel(monthly, true)).toBe('Start 7-day free trial');
    expect(primaryLabel(monthly, false)).toBe('Subscribe · $3.99/month');
    expect(primaryLabel(annual, false)).toBe('Subscribe · $29.99/year');
  });
  it('computes the annual saving', () => {
    expect(annualSavingsPercent(monthly, annual)).toBe(37);
    expect(annualSavingsPercent(null, annual)).toBeNull();
  });
  it('states the renewal terms and the first charge date for a trial', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    expect(renewalTerms('ios', monthly, true, now)).toBe(
      "Free for 7 days, then $3.99/month starting Oct 8, 2026. Payment is charged to your Apple ID. " +
      'Renews automatically unless cancelled at least 24 hours before the end of the current period. ' +
      'Manage or cancel any time in your account settings.',
    );
    expect(renewalTerms('android', annual, false, now)).toBe(
      '$29.99/year. Payment is charged to your Google Play account. ' +
      'Renews automatically unless cancelled at least 24 hours before the end of the current period. ' +
      'Manage or cancel any time in your account settings.',
    );
    expect(renewalTerms('web', monthly, false, now)).toContain('Payment is charged to your card.');
  });
});
