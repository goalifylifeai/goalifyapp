// Plan lookup + quota enforcement shared by the AI edge functions.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { planFromRow } from './entitlement.ts';

export type Plan = 'free' | 'beyond';

export type QuotaWindow = 'day' | 'week' | 'month' | 'total';
export type Limit = { limit: number; window: QuotaWindow };

/**
 * The user's plan, from public.subscriptions (kept in sync with RevenueCat by
 * revenuecat-webhook and sync-subscription). A failed lookup falls back to
 * Free: the user briefly gets Free limits rather than the call failing.
 */
export async function getPlan(admin: SupabaseClient, userId: string): Promise<Plan> {
  const { data, error } = await admin
    .from('subscriptions')
    .select('has_entitlement, expires_at, grace_expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('getPlan lookup failed', error.message);
    return 'free';
  }
  return planFromRow(data, new Date());
}

/**
 * Atomically takes one unit from every limit (consume_ai_quotas, migration
 * 0020). Returns null if allowed, otherwise the window that blocked the call.
 * Fails closed: if the check itself errors, the paid call doesn't happen.
 */
export async function consumeQuotas(
  admin: SupabaseClient, userId: string, kind: string, limits: Limit[],
): Promise<QuotaWindow | 'error' | null> {
  const { data, error } = await admin.rpc('consume_ai_quotas', {
    p_user_id: userId, p_kind: kind, p_limits: limits,
  });
  if (error) {
    console.error('consume_ai_quotas failed', error.message);
    return 'error';
  }
  return (data as QuotaWindow | null) ?? null;
}
