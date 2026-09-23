import {
  subscriptionFromSubscriber, planFromRow, userIdsFromEvent,
  type RcSubscriber,
} from '../supabase/functions/_shared/entitlement';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-01T12:00:00Z');

function subscriber(over: Partial<RcSubscriber> = {}): RcSubscriber {
  return {
    entitlements: {
      beyond: { expires_date: '2026-10-08T12:00:00Z', grace_period_expires_date: null, product_identifier: 'beyond_monthly' },
    },
    subscriptions: {
      beyond_monthly: {
        expires_date: '2026-10-08T12:00:00Z', period_type: 'trial', store: 'app_store',
        unsubscribe_detected_at: null, billing_issues_detected_at: null,
      },
    },
    ...over,
  };
}

describe('subscriptionFromSubscriber', () => {
  it('maps an active trial', () => {
    expect(subscriptionFromSubscriber(U1, subscriber(), false)).toEqual({
      user_id: U1, has_entitlement: true,
      expires_at: '2026-10-08T12:00:00Z', grace_expires_at: null,
      period_type: 'trial', store: 'app_store', product_id: 'beyond_monthly',
      will_renew: true, had_trial: true,
    });
  });

  it('marks will_renew false when the user unsubscribed', () => {
    const s = subscriber();
    s.subscriptions.beyond_monthly!.unsubscribe_detected_at = '2026-10-02T00:00:00Z';
    expect(subscriptionFromSubscriber(U1, s, false).will_renew).toBe(false);
  });

  it('returns an empty row with no entitlement, keeping had_trial sticky', () => {
    const row = subscriptionFromSubscriber(U1, { entitlements: {}, subscriptions: {} }, true);
    expect(row).toEqual({
      user_id: U1, has_entitlement: false, expires_at: null, grace_expires_at: null,
      period_type: null, store: null, product_id: null, will_renew: false, had_trial: true,
    });
  });

  it('records had_trial from a TRIAL webhook event even after conversion', () => {
    const s = subscriber();
    s.subscriptions.beyond_monthly!.period_type = 'normal';
    expect(subscriptionFromSubscriber(U1, s, false, 'TRIAL').had_trial).toBe(true);
    expect(subscriptionFromSubscriber(U1, s, false, 'NORMAL').had_trial).toBe(false);
  });
});

describe('planFromRow', () => {
  const base = { has_entitlement: true, expires_at: '2026-10-08T12:00:00Z', grace_expires_at: null };
  it('is free with no row', () => expect(planFromRow(null, NOW)).toBe('free'));
  it('is beyond before expiry', () => expect(planFromRow(base, NOW)).toBe('beyond'));
  it('is free after expiry', () =>
    expect(planFromRow({ ...base, expires_at: '2026-09-30T00:00:00Z' }, NOW)).toBe('free'));
  it('stays beyond during a billing grace period', () =>
    expect(planFromRow({ ...base, expires_at: '2026-09-30T00:00:00Z', grace_expires_at: '2026-10-05T00:00:00Z' }, NOW)).toBe('beyond'));
  it('treats a null expiry (lifetime/promotional) as beyond', () =>
    expect(planFromRow({ ...base, expires_at: null }, NOW)).toBe('beyond'));
  it('is free when has_entitlement is false', () =>
    expect(planFromRow({ ...base, has_entitlement: false }, NOW)).toBe('free'));
});

describe('userIdsFromEvent', () => {
  it('keeps UUIDs from every id field, deduped and lower-cased', () => {
    expect(userIdsFromEvent({
      type: 'RENEWAL', app_user_id: U1.toUpperCase(), original_app_user_id: U1, aliases: [U1, '$RCAnonymousID:abc'],
    })).toEqual([U1]);
  });
  it('ignores anonymous ids', () => {
    expect(userIdsFromEvent({ type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:abc' })).toEqual([]);
  });
  it('returns both sides of a transfer', () => {
    expect(userIdsFromEvent({ type: 'TRANSFER', transferred_from: [U1], transferred_to: [U2] })).toEqual([U1, U2]);
  });
});
