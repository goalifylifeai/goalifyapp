// Pulls a user's current RevenueCat state and stores it in public.subscriptions.
// Always refetches from the REST API rather than trusting the webhook body,
// so out-of-order webhook deliveries can't leave a stale row.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { subscriptionFromSubscriber, type RcSubscriber } from './entitlement.ts';

const FK_VIOLATION = '23503'; // user deleted since the purchase

export async function refreshSubscription(
  admin: SupabaseClient, userId: string, eventPeriodType?: string,
): Promise<'ok' | 'rc_error' | 'db_error'> {
  const key = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!key) {
    console.error('REVENUECAT_SECRET_API_KEY is not set');
    return 'rc_error';
  }
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    console.error('revenuecat subscriber fetch failed', res.status);
    return 'rc_error';
  }
  const body = await res.json() as { subscriber: RcSubscriber };

  const { data: prev } = await admin
    .from('subscriptions').select('had_trial').eq('user_id', userId).maybeSingle();
  const row = subscriptionFromSubscriber(userId, body.subscriber, prev?.had_trial === true, eventPeriodType);

  const { error } = await admin
    .from('subscriptions')
    .upsert({ ...row, updated_at: new Date().toISOString() });
  if (error) {
    if (error.code === FK_VIOLATION) return 'ok';
    console.error('subscriptions upsert failed', error.message);
    return 'db_error';
  }
  return 'ok';
}
