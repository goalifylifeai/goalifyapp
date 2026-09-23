// RevenueCat → Goalify. RevenueCat sends the configured Authorization header
// verbatim; REVENUECAT_WEBHOOK_AUTH holds that exact value (e.g. "Bearer <secret>").
// Non-2xx makes RevenueCat retry, so only return 500 for retryable failures.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { userIdsFromEvent, type RcWebhookEvent } from '../_shared/entitlement.ts';
import { refreshSubscription } from '../_shared/revenuecat.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!expected || req.headers.get('Authorization') !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await req.json().catch(() => null) as { event?: RcWebhookEvent } | null;
  const event = body?.event;
  if (!event?.type) return new Response('Bad request', { status: 400 });
  if (event.type === 'TEST') return new Response('ok');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  for (const userId of userIdsFromEvent(event)) {
    const result = await refreshSubscription(admin, userId, event.period_type);
    if (result !== 'ok') return new Response('retry', { status: 500 });
  }
  return new Response('ok');
});
