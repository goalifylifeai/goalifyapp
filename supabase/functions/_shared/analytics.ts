// RevenueCat webhook event → PostHog event. Pure except capture(), so the
// mapping is unit-tested from jest (see __tests__/analytics-server.test.ts).
//
// Forwarded only for users whose RevenueCat customer carries the
// `analytics_consent = granted` attribute (set by the app, lib/purchases.ts).

export type RcAnalyticsEvent = {
  id?: string;
  type: string;
  app_user_id?: string;
  event_timestamp_ms?: number;
  period_type?: string;
  product_id?: string;
  store?: string;
  price?: number | null;
  is_trial_conversion?: boolean;
  cancel_reason?: string;
  expiration_reason?: string;
  subscriber_attributes?: Record<string, { value?: string } | undefined>;
};

export type PostHogCapture = {
  event: string;
  distinct_id: string;
  timestamp?: string;
  uuid?: string;
  properties: Record<string, string | number | boolean>;
};

const EVENT_NAMES: Record<string, string> = {
  INITIAL_PURCHASE: 'subscription_started',
  RENEWAL: 'subscription_renewed',
  CANCELLATION: 'subscription_cancelled',
  UNCANCELLATION: 'subscription_uncancelled',
  EXPIRATION: 'subscription_expired',
  BILLING_ISSUE: 'billing_issue',
  PRODUCT_CHANGE: 'subscription_product_changed',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RevenueCat event ids are UUIDs; reusing them lets PostHog drop webhook retries. */
function eventUuid(id: string | undefined): string | undefined {
  return id && UUID.test(id) ? id.toLowerCase() : undefined;
}

export function hasAnalyticsConsent(event: RcAnalyticsEvent): boolean {
  return event.subscriber_attributes?.analytics_consent?.value === 'granted';
}

/** null = not an event we forward (unknown type, no consent, or no Goalify user id). */
export function posthogEventFromRc(event: RcAnalyticsEvent): PostHogCapture | null {
  const name = EVENT_NAMES[event.type];
  const userId = event.app_user_id?.toLowerCase();
  if (!name || !userId || !UUID.test(userId) || !hasAnalyticsConsent(event)) return null;

  const properties: PostHogCapture['properties'] = {};
  if (event.period_type) properties.period_type = event.period_type.toLowerCase();
  if (event.store) properties.store = event.store.toLowerCase();
  if (event.product_id) properties.product_id = event.product_id;
  if (typeof event.price === 'number') properties.price_usd = event.price;
  if (event.type === 'RENEWAL') properties.is_trial_conversion = event.is_trial_conversion === true;
  if (event.cancel_reason) properties.cancel_reason = event.cancel_reason.toLowerCase();
  if (event.expiration_reason) properties.expiration_reason = event.expiration_reason.toLowerCase();

  const capture: PostHogCapture = { event: name, distinct_id: userId, properties };
  if (event.event_timestamp_ms) capture.timestamp = new Date(event.event_timestamp_ms).toISOString();
  const uuid = eventUuid(event.id);
  if (uuid) capture.uuid = uuid;
  return capture;
}

type Env = { get(key: string): string | undefined };

/** Fire-and-forget: analytics must never make a webhook fail. */
export async function capture(env: Env, payload: PostHogCapture): Promise<void> {
  const apiKey = env.get('POSTHOG_API_KEY');
  if (!apiKey) return;
  const host = env.get('POSTHOG_HOST') || 'https://eu.i.posthog.com';
  try {
    await fetch(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, ...payload, properties: { ...payload.properties, $process_person_profile: true } }),
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* ignore */ }
}

/**
 * GDPR erasure: delete the person and their events in PostHog. Needs a personal
 * API key with person:write scope; without it the deletion must be done by hand.
 */
export async function deletePerson(env: Env, userId: string): Promise<void> {
  const key = env.get('POSTHOG_PERSONAL_API_KEY');
  const projectId = env.get('POSTHOG_PROJECT_ID');
  if (!key || !projectId) return;
  const appHost = env.get('POSTHOG_APP_HOST') || 'https://eu.posthog.com';
  try {
    await fetch(`${appHost}/api/projects/${projectId}/persons/bulk_delete/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ distinct_ids: [userId], delete_events: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* ignore */ }
}
