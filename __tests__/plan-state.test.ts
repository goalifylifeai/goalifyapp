import {
  FREE_STATE, planStateFromCustomerInfo, planStateFromServer, resolvePlanState,
  productHasFreeTrial, isTrialEligible, trialDaysLeft, storeLabel, planTitle, planDetail, deleteAccountMessage,
  type CustomerInfoLike, type PlanState,
} from '../lib/plan-state';

const NOW = new Date('2026-10-01T12:00:00Z');

const trialInfo: CustomerInfoLike = {
  managementURL: 'https://apps.apple.com/account/subscriptions',
  entitlements: { active: { beyond: {
    periodType: 'TRIAL', expirationDate: '2026-10-08T12:00:00Z', willRenew: true,
    store: 'APP_STORE', productIdentifier: 'beyond_monthly',
  } } },
};

describe('planStateFromCustomerInfo', () => {
  it('reads an active trial', () => {
    expect(planStateFromCustomerInfo(trialInfo)).toEqual({
      plan: 'beyond', isTrial: true, trialEndsAt: '2026-10-08T12:00:00Z', expiresAt: '2026-10-08T12:00:00Z',
      willRenew: true, store: 'APP_STORE', productId: 'beyond_monthly',
      managementURL: 'https://apps.apple.com/account/subscriptions',
    });
  });
  it('is free with no active beyond entitlement', () => {
    expect(planStateFromCustomerInfo({ managementURL: null, entitlements: { active: {} } })).toEqual(FREE_STATE);
  });
});

describe('planStateFromServer / resolvePlanState', () => {
  const row = {
    has_entitlement: true, expires_at: '2026-11-01T00:00:00Z', grace_expires_at: null,
    period_type: 'normal' as const, store: 'stripe', product_id: 'beyond_annual', will_renew: true, had_trial: true,
  };
  it('maps an active server row', () => {
    expect(planStateFromServer(row, NOW)).toMatchObject({ plan: 'beyond', isTrial: false, store: 'stripe' });
  });
  it('is free for an expired row', () => {
    expect(planStateFromServer({ ...row, expires_at: '2026-09-01T00:00:00Z' }, NOW)).toEqual(FREE_STATE);
  });
  it('uses the server row when RevenueCat is unavailable', () => {
    expect(resolvePlanState(null, planStateFromServer(row, NOW)).plan).toBe('beyond');
  });
  it('prefers RevenueCat when it says beyond', () => {
    const rc = planStateFromCustomerInfo(trialInfo);
    expect(resolvePlanState(rc, planStateFromServer(row, NOW))).toBe(rc);
  });
  it('trusts a server beyond row over an RC free state (web purchase not yet synced to the SDK)', () => {
    const rc: PlanState = { ...FREE_STATE, managementURL: 'x' };
    expect(resolvePlanState(rc, planStateFromServer(row, NOW))).toMatchObject({ plan: 'beyond', managementURL: 'x' });
  });
  it('is free when both say free', () => {
    expect(resolvePlanState(null, FREE_STATE)).toEqual(FREE_STATE);
  });
});

describe('trial eligibility', () => {
  it('detects an iOS/web free intro price and an Android free phase', () => {
    expect(productHasFreeTrial({ introPrice: { price: 0 } })).toBe(true);
    expect(productHasFreeTrial({ introPrice: null, defaultOption: { freePhase: {} } })).toBe(true);
    expect(productHasFreeTrial({ introPrice: { price: 0.99 } })).toBe(false);
    expect(productHasFreeTrial({ introPrice: null, defaultOption: null })).toBe(false);
  });
  const ok = { plan: 'free' as const, productHasTrial: true, storeEligibility: 'unknown' as const, hadTrial: false };
  it('is eligible on free with a trial product', () => expect(isTrialEligible(ok)).toBe(true));
  it('is not eligible once had_trial is set on any channel', () => expect(isTrialEligible({ ...ok, hadTrial: true })).toBe(false));
  it('is not eligible when the store says ineligible', () => expect(isTrialEligible({ ...ok, storeEligibility: 'ineligible' })).toBe(false));
  it('is not eligible when already beyond', () => expect(isTrialEligible({ ...ok, plan: 'beyond' })).toBe(false));
});

describe('labels', () => {
  it('counts trial days left, rounding up, never negative', () => {
    expect(trialDaysLeft('2026-10-08T12:00:00Z', NOW)).toBe(7);
    expect(trialDaysLeft('2026-10-02T00:00:00Z', NOW)).toBe(1);
    expect(trialDaysLeft('2026-09-30T00:00:00Z', NOW)).toBe(0);
    expect(trialDaysLeft(null, NOW)).toBe(0);
  });
  it('names the billing store', () => {
    expect(storeLabel('APP_STORE')).toBe('the App Store');
    expect(storeLabel('play_store')).toBe('Google Play');
    expect(storeLabel('RC_BILLING')).toBe('the web');
    expect(storeLabel('stripe')).toBe('the web');
    expect(storeLabel(null)).toBeNull();
  });
  it('titles each plan state', () => {
    expect(planTitle(FREE_STATE, NOW)).toBe('Free plan');
    expect(planTitle(planStateFromCustomerInfo(trialInfo), NOW)).toBe('Beyond trial · 7 days left');
    expect(planTitle({ ...planStateFromCustomerInfo(trialInfo), trialEndsAt: '2026-10-02T00:00:00Z' }, NOW)).toBe('Beyond trial · 1 day left');
    expect(planTitle({ ...planStateFromCustomerInfo(trialInfo), isTrial: false }, NOW)).toBe('Goalify Beyond');
  });
  it('describes renewal and billing store', () => {
    const s = planStateFromCustomerInfo(trialInfo);
    expect(planDetail(s)).toBe('Renews Oct 8, 2026 · billed through the App Store');
    expect(planDetail({ ...s, willRenew: false })).toBe('Ends Oct 8, 2026 · billed through the App Store');
    expect(planDetail(FREE_STATE)).toBe('Go Beyond: your coach, your vision, no limits.');
  });
});

describe('deleteAccountMessage (I6)', () => {
  const base = 'This permanently removes your account and all data.';
  it('is the plain warning on Free', () => {
    expect(deleteAccountMessage('free', null)).toBe(base);
  });
  it('warns a Beyond user that the store keeps billing', () => {
    expect(deleteAccountMessage('beyond', 'APP_STORE')).toBe(
      `${base} Your Goalify Beyond subscription keeps billing until you cancel it in the App Store.`);
  });
  it('falls back to a generic store name', () => {
    expect(deleteAccountMessage('beyond', null)).toBe(
      `${base} Your Goalify Beyond subscription keeps billing until you cancel it in the store you subscribed with.`);
  });
});
