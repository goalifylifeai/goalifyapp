// Plan lookup + quota enforcement shared by the AI edge functions.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type Plan = 'free' | 'beyond';

export type QuotaWindow = 'day' | 'week' | 'month' | 'total';
export type Limit = { limit: number; window: QuotaWindow };

/**
 * The user's plan. This is the single place to wire in the real subscription
 * check once billing exists (e.g. a table kept in sync by the RevenueCat
 * webhook). Until then everyone is on Free.
 */
export async function getPlan(_admin: SupabaseClient, _userId: string): Promise<Plan> {
  return 'free';
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
