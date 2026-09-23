// Pure subscription rules shared by the edge functions (Deno) and the app
// (Metro/Jest). Keep this file free of imports so both runtimes can load it.

export type PeriodType = 'trial' | 'intro' | 'normal';

export type SubscriptionRow = {
  user_id: string;
  has_entitlement: boolean;
  expires_at: string | null;
  grace_expires_at: string | null;
  period_type: PeriodType | null;
  store: string | null;
  product_id: string | null;
  will_renew: boolean;
  /** Sticky: true once the user has ever started a trial, on any channel. */
  had_trial: boolean;
};

// Subset of GET https://api.revenuecat.com/v1/subscribers/{id} → subscriber.
export type RcEntitlement = {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier: string;
};
export type RcSubscription = {
  expires_date: string | null;
  period_type: string;
  store: string;
  unsubscribe_detected_at: string | null;
  billing_issues_detected_at: string | null;
};
export type RcSubscriber = {
  entitlements: Record<string, RcEntitlement | undefined>;
  subscriptions: Record<string, RcSubscription | undefined>;
};

// Subset of a RevenueCat webhook `event`.
export type RcWebhookEvent = {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  period_type?: string;
};

export const ENTITLEMENT_ID = 'beyond';

export function subscriptionFromSubscriber(
  userId: string, subscriber: RcSubscriber, prevHadTrial: boolean, eventPeriodType?: string,
): SubscriptionRow {
  const ent = subscriber.entitlements[ENTITLEMENT_ID];
  const anyTrial = Object.values(subscriber.subscriptions).some(s => s?.period_type === 'trial');
  const hadTrial = prevHadTrial || anyTrial || eventPeriodType === 'TRIAL';
  if (!ent) {
    return {
      user_id: userId, has_entitlement: false, expires_at: null, grace_expires_at: null,
      period_type: null, store: null, product_id: null, will_renew: false, had_trial: hadTrial,
    };
  }
  const sub = subscriber.subscriptions[ent.product_identifier];
  const period = sub?.period_type;
  return {
    user_id: userId,
    has_entitlement: true,
    expires_at: ent.expires_date,
    grace_expires_at: ent.grace_period_expires_date ?? null,
    period_type: period === 'trial' || period === 'intro' || period === 'normal' ? period : null,
    store: sub?.store ?? null,
    product_id: ent.product_identifier,
    will_renew: !!sub && !sub.unsubscribe_detected_at && !sub.billing_issues_detected_at,
    had_trial: hadTrial,
  };
}

/** RevenueCat keeps expired entitlements in the payload, so check the dates. */
export function planFromRow(
  row: Pick<SubscriptionRow, 'has_entitlement' | 'expires_at' | 'grace_expires_at'> | null,
  now: Date,
): 'free' | 'beyond' {
  if (!row?.has_entitlement) return 'free';
  if (row.expires_at === null) return 'beyond';
  const end = Math.max(
    Date.parse(row.expires_at),
    row.grace_expires_at ? Date.parse(row.grace_expires_at) : 0,
  );
  return end > now.getTime() ? 'beyond' : 'free';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Supabase user ids named by a webhook event. Anonymous RevenueCat ids are skipped. */
export function userIdsFromEvent(event: RcWebhookEvent): string[] {
  const all = [
    event.app_user_id, event.original_app_user_id,
    ...(event.aliases ?? []), ...(event.transferred_from ?? []), ...(event.transferred_to ?? []),
  ];
  const ids = all
    .filter((id): id is string => !!id && UUID.test(id))
    .map(id => id.toLowerCase());
  return [...new Set(ids)];
}
