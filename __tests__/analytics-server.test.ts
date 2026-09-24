import { posthogEventFromRc, type RcAnalyticsEvent } from '../supabase/functions/_shared/analytics';

const USER = '0F8B2C1E-1111-4222-8333-444455556666';
const base: RcAnalyticsEvent = {
  id: 'A1B2C3D4-0000-4000-8000-000000000001',
  type: 'RENEWAL',
  app_user_id: USER,
  event_timestamp_ms: Date.UTC(2026, 9, 8, 12),
  period_type: 'NORMAL',
  store: 'APP_STORE',
  product_id: 'beyond_monthly',
  price: 3.99,
  is_trial_conversion: true,
  subscriber_attributes: { analytics_consent: { value: 'granted' } },
};

describe('posthogEventFromRc', () => {
  it('maps a trial conversion renewal', () => {
    expect(posthogEventFromRc(base)).toEqual({
      event: 'subscription_renewed',
      distinct_id: USER.toLowerCase(),
      timestamp: '2026-10-08T12:00:00.000Z',
      uuid: base.id!.toLowerCase(),
      properties: {
        period_type: 'normal', store: 'app_store', product_id: 'beyond_monthly', price_usd: 3.99, is_trial_conversion: true,
      },
    });
  });

  it('skips users without analytics consent', () => {
    expect(posthogEventFromRc({ ...base, subscriber_attributes: {} })).toBeNull();
    expect(posthogEventFromRc({ ...base, subscriber_attributes: { analytics_consent: { value: 'denied' } } })).toBeNull();
  });

  it('skips unknown types and anonymous RevenueCat ids', () => {
    expect(posthogEventFromRc({ ...base, type: 'TEST' })).toBeNull();
    expect(posthogEventFromRc({ ...base, app_user_id: '$RCAnonymousID:abc' })).toBeNull();
  });

  it('adds the cancel reason on cancellations', () => {
    const e = posthogEventFromRc({ ...base, type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE', is_trial_conversion: undefined });
    expect(e?.event).toBe('subscription_cancelled');
    expect(e?.properties.cancel_reason).toBe('unsubscribe');
    expect(e?.properties).not.toHaveProperty('is_trial_conversion');
  });
});
