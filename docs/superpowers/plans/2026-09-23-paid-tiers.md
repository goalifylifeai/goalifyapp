# Goalify Beyond (Paid Tiers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Free / Goalify Beyond subscription: RevenueCat billing (Apple, Google, Stripe web) with a 7-day trial, a server-side plan check, a `usePlan()` hook, one paywall, and the upgrade moments U0–U7.

**Architecture:** RevenueCat is the source of truth. The app reads the `beyond` entitlement from the RevenueCat SDK (`react-native-purchases`, which covers iOS, Android and web). The server keeps a `subscriptions` table updated by a RevenueCat webhook, plus a `sync-subscription` function the app calls right after a purchase so the AI functions see Beyond immediately. `getPlan()` reads that table. All subscription rules live in one dependency-free file (`supabase/functions/_shared/entitlement.ts`) that both Deno and the app import, so the two sides can't drift.

**Tech Stack:** Expo 54 / React Native 0.81 / expo-router 6, `react-native-purchases` 10.x, Supabase (Postgres + Deno edge functions), Jest (`jest-expo`) + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-09-23-paid-tiers-user-behaviour.md`

## Global Constraints

- Plan names: "Free" and **"Goalify Beyond"** ("Beyond" for short). Never show "Pro" to users. Copy comes from `constants/brand.ts` (`PAID_PLAN_NAME`, `PAID_PLAN_SHORT`, `PAID_PLAN_PITCH`, `TAGLINE`).
- Price: **$3.99/month** (`beyond_monthly`) and **$29.99/year** (`beyond_annual`). Both have a **7-day free trial**, and both attach to entitlement **`beyond`**. Always show the store's localized `priceString`, never a hard-coded price.
- RevenueCat App User ID = Supabase `user.id`.
- Paywall main button: **"Start 7-day free trial"** if trial-eligible, otherwise **"Subscribe · {price}/month"** or **"Subscribe · {price}/year"**.
- Every paywall can be dismissed, and dismissing returns the user to where they were. After a purchase, the action that opened the paywall carries on.
- The paywall must show **Restore purchases**, price and period, auto-renew terms, and links to Terms of Use and Privacy Policy.
- Upgrade prompts appear only when the user tries a Beyond feature, never on a timer. The exceptions are U0 (welcome) and U6 (trial reminder / trial ended).
- No lock icons on core features, no ads, no blocking pop-ups on Free.
- Nothing a user created is deleted when they drop to Free.
- Server limits stay as they are (`LIMITS`, `IMAGE_LIMITS`, migration 0020). This plan only makes `getPlan()` return the real plan.
- Launch scope: built features only (spec 3.1). Ambient audio, vision from goal titles, AI ritual actions and the branded share card are **out of scope**.
- Tests: `npx jest <path>`. Existing typecheck baseline: `npx tsc --noEmit` reports 18 pre-existing errors, all in `__tests__/tabs-layout.test.tsx` and similar test files. Don't add to them.

## Review Focus

1. **Purchase succeeds but the server still says Free.** The webhook can arrive seconds late, so the continued action (e.g. regenerate) would get `403 pro_required`. The paywall must wait for `sync-subscription` before running the continuation. Pinned in Task 4 (provider test) and Task 5 (paywall test).
2. **Cold start while RevenueCat is still loading.** The app briefly reports Free before `CustomerInfo` arrives. The "trial ended" sheet must not fire from that placeholder state. Pinned in Task 10 (`trialJustEnded` requires `loaded`).
3. **RevenueCat unavailable** (Expo Go, jest, web without a key, network down). The app must stay usable on Free, honour a server-side Beyond row, and show the paywall as unavailable instead of crashing. Pinned in Task 3 (`resolvePlanState`), Task 4 (provider test) and Task 5 (paywall test).
4. **Webhook payloads with anonymous IDs or transfers.** `$RCAnonymousID:…` must be ignored, and transfers must refresh both users. Pinned in Task 1 (`userIdsFromEvent`).
5. **User cancels the store payment sheet.** No error alert, the user stays on the paywall, and the pending action doesn't run. Pinned in Task 5.

Also covered: billing grace period keeps Beyond (Task 1), trial reminder not scheduled after the user cancels the trial (Task 10), and the image-cap state not shimmering forever (Task 8).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0021_subscriptions.sql` (new) | `subscriptions` table, read-own RLS |
| `supabase/functions/_shared/entitlement.ts` (new) | Pure rules: RevenueCat subscriber → row, row → plan, webhook event → user IDs. No imports. |
| `supabase/functions/_shared/revenuecat.ts` (new) | Deno: fetch subscriber from RevenueCat REST, upsert the row |
| `supabase/functions/_shared/plan.ts` | `getPlan()` reads `subscriptions` |
| `supabase/functions/revenuecat-webhook/index.ts` (new) | Webhook receiver (no JWT, shared-secret header) |
| `supabase/functions/sync-subscription/index.ts` (new) | Signed-in user asks the server to refresh their row now |
| `supabase/config.toml` | JWT settings for the two new functions |
| `lib/plan-state.ts` (new) | Pure client rules: `PlanState`, merging RevenueCat + server, trial eligibility, labels |
| `lib/purchases.ts` (new) | Thin wrapper over `react-native-purchases`, the only file that imports the SDK |
| `store/plan.tsx` (new) | `PlanProvider` / `usePlan()` |
| `lib/paywall.ts` (new) | `openPaywall()`, pending-action registry, paywall copy helpers |
| `app/paywall.tsx` (new) | The one paywall screen |
| `app/trial-ended.tsx` (new) | "Your trial has ended" sheet |
| `lib/trial.ts` (new) | Trial reminder timing and copy, trial-ended detection, snapshot storage |
| `components/TrialWatcher.tsx` (new) | Schedules the day-5 reminder and opens the trial-ended sheet |
| `constants/brand.ts` | Adds `VISION_PITCH`, `BEYOND_FEATURES`, `TERMS_URL`, `PRIVACY_URL` |
| `constants/flags.ts` | Drops the `PRO_*` flags; keeps `VISION_AUDIO_AVAILABLE` |
| `docs/billing-setup.md` (new) | Manual runbook: RevenueCat, App Store Connect, Play Console, Stripe, secrets |

---

### Task 1: Subscription rules and the `subscriptions` table

**Files:**
- Create: `supabase/functions/_shared/entitlement.ts`
- Create: `supabase/migrations/0021_subscriptions.sql`
- Test: `__tests__/entitlement.test.ts`

**Interfaces:**
- Produces:
  - `type PeriodType = 'trial' | 'intro' | 'normal'`
  - `type SubscriptionRow = { user_id: string; has_entitlement: boolean; expires_at: string | null; grace_expires_at: string | null; period_type: PeriodType | null; store: string | null; product_id: string | null; will_renew: boolean; had_trial: boolean }`
  - `type RcSubscriber`, `type RcWebhookEvent`
  - `const ENTITLEMENT_ID = 'beyond'`
  - `subscriptionFromSubscriber(userId: string, subscriber: RcSubscriber, prevHadTrial: boolean, eventPeriodType?: string): SubscriptionRow`
  - `planFromRow(row: Pick<SubscriptionRow, 'has_entitlement' | 'expires_at' | 'grace_expires_at'> | null, now: Date): 'free' | 'beyond'`
  - `userIdsFromEvent(event: RcWebhookEvent): string[]`

- [ ] **Step 1: Write the failing test**

`__tests__/entitlement.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/entitlement.test.ts`
Expected: FAIL with "Cannot find module '../supabase/functions/_shared/entitlement'"

- [ ] **Step 3: Write the implementation**

`supabase/functions/_shared/entitlement.ts`:

```ts
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
```

`supabase/migrations/0021_subscriptions.sql`:

```sql
-- Goalify Beyond subscription state, one row per user, written only by the
-- revenuecat-webhook and sync-subscription edge functions (service role).
-- getPlan() reads it; the app reads its own row (had_trial, dates).

create table public.subscriptions (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  has_entitlement  boolean not null default false,
  expires_at       timestamptz,
  grace_expires_at timestamptz,
  period_type      text check (period_type in ('trial', 'intro', 'normal')),
  store            text,
  product_id       text,
  will_renew       boolean not null default false,
  had_trial        boolean not null default false,
  updated_at       timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions: read own"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/entitlement.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/entitlement.ts supabase/migrations/0021_subscriptions.sql __tests__/entitlement.test.ts
git commit -m "feat(billing): subscription rules and subscriptions table"
```

---

### Task 2: Keep the server in sync with RevenueCat

**Files:**
- Create: `supabase/functions/_shared/revenuecat.ts`
- Create: `supabase/functions/revenuecat-webhook/index.ts`
- Create: `supabase/functions/sync-subscription/index.ts`
- Modify: `supabase/functions/_shared/plan.ts` (`getPlan`)
- Modify: `supabase/config.toml` (append)

**Interfaces:**
- Consumes: `subscriptionFromSubscriber`, `planFromRow`, `userIdsFromEvent`, `RcSubscriber`, `RcWebhookEvent` (Task 1)
- Produces:
  - `refreshSubscription(admin: SupabaseClient, userId: string, eventPeriodType?: string): Promise<'ok' | 'rc_error' | 'db_error'>`
  - Edge function `sync-subscription`: POST, user JWT, returns `{ ok: true }` (200) or `{ error }` (502)
  - Edge function `revenuecat-webhook`: POST, header `Authorization` must equal secret `REVENUECAT_WEBHOOK_AUTH`
  - Secrets: `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`

There's no Deno toolchain or server test harness in this repo. The logic is covered by Task 1's tests, and these files are thin glue that gets verified in Step 5.

- [ ] **Step 1: Write `_shared/revenuecat.ts`**

```ts
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
```

- [ ] **Step 2: Write `revenuecat-webhook/index.ts`**

```ts
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
```

- [ ] **Step 3: Write `sync-subscription/index.ts`**

```ts
// Called by the app right after a purchase or restore, so getPlan() sees
// Beyond before the webhook arrives.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { refreshSubscription } from '../_shared/revenuecat.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const result = await refreshSubscription(admin, user.id);
  return result === 'ok' ? json({ ok: true }) : json({ error: result }, 502);
});
```

- [ ] **Step 4: Make `getPlan()` real and register the functions**

Replace `getPlan` in `supabase/functions/_shared/plan.ts` (keep the rest of the file):

```ts
import { planFromRow } from './entitlement.ts';

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
```

Put the `import { planFromRow } …` line next to the existing `import type { SupabaseClient } …` at the top.

Append to `supabase/config.toml`:

```toml
[functions.revenuecat-webhook]
verify_jwt = false

[functions.sync-subscription]
verify_jwt = true
```

- [ ] **Step 5: Verify**

Run: `npx jest __tests__/entitlement.test.ts` → PASS (the shared rules are unchanged).
Run: `grep -n "getPlan\|planFromRow" supabase/functions/_shared/plan.ts` → shows the new import and body.
If `supabase` CLI is available: `supabase functions serve --no-verify-jwt` then
`curl -s -X POST localhost:54321/functions/v1/revenuecat-webhook -H 'Authorization: wrong' -d '{}' -o /dev/null -w '%{http_code}'` → `401`.
If the CLI isn't available, record in the task report that the functions were not run locally.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/revenuecat.ts supabase/functions/_shared/plan.ts \
  supabase/functions/revenuecat-webhook supabase/functions/sync-subscription supabase/config.toml
git commit -m "feat(billing): RevenueCat webhook, sync-subscription, real getPlan()"
```

---

### Task 3: Client plan rules

**Files:**
- Create: `lib/plan-state.ts`
- Test: `__tests__/plan-state.test.ts`

**Interfaces:**
- Consumes: `planFromRow`, `SubscriptionRow`, `ENTITLEMENT_ID` (Task 1)
- Produces:
  - `type Plan = 'free' | 'beyond'`
  - `type PlanState = { plan: Plan; isTrial: boolean; trialEndsAt: string | null; expiresAt: string | null; willRenew: boolean; store: string | null; productId: string | null; managementURL: string | null }`
  - `const FREE_STATE: PlanState`
  - `type PaywallSource = 'welcome' | 'chat_limit' | 'vision_regen' | 'insights' | 'vision_limit' | 'ambient_audio' | 'trial_ended' | 'profile'`
  - `type ServerSubscription = Pick<SubscriptionRow, 'has_entitlement' | 'expires_at' | 'grace_expires_at' | 'period_type' | 'store' | 'product_id' | 'will_renew' | 'had_trial'>`
  - `type CustomerInfoLike`, `type ProductLike`, `type StoreEligibility = 'eligible' | 'ineligible' | 'unknown'`
  - `planStateFromCustomerInfo(info: CustomerInfoLike): PlanState`
  - `planStateFromServer(row: ServerSubscription | null, now: Date): PlanState`
  - `resolvePlanState(rc: PlanState | null, server: PlanState): PlanState`
  - `productHasFreeTrial(p: ProductLike): boolean`
  - `isTrialEligible(a: { plan: Plan; productHasTrial: boolean; storeEligibility: StoreEligibility; hadTrial: boolean }): boolean`
  - `trialDaysLeft(trialEndsAt: string | null, now: Date): number`
  - `storeLabel(store: string | null): string | null`
  - `formatDate(iso: string): string` (e.g. `"Oct 8, 2026"`)
  - `planTitle(s: PlanState, now: Date): string`, `planDetail(s: PlanState): string`

- [ ] **Step 1: Write the failing test**

`__tests__/plan-state.test.ts`:

```ts
import {
  FREE_STATE, planStateFromCustomerInfo, planStateFromServer, resolvePlanState,
  productHasFreeTrial, isTrialEligible, trialDaysLeft, storeLabel, planTitle, planDetail,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/plan-state.test.ts`
Expected: FAIL with "Cannot find module '../lib/plan-state'"

- [ ] **Step 3: Write the implementation**

`lib/plan-state.ts`:

```ts
// Pure plan rules for the app. The RevenueCat SDK and Supabase are read in
// lib/purchases.ts and store/plan.tsx; this file only turns their data into a
// PlanState, so it can be tested without either.

import { planFromRow, ENTITLEMENT_ID, type SubscriptionRow } from '../supabase/functions/_shared/entitlement';
import { PAID_PLAN_NAME, PAID_PLAN_PITCH } from '../constants/brand';

export type Plan = 'free' | 'beyond';

export type PlanState = {
  plan: Plan;
  isTrial: boolean;
  trialEndsAt: string | null;
  expiresAt: string | null;
  willRenew: boolean;
  store: string | null;
  productId: string | null;
  managementURL: string | null;
};

export const FREE_STATE: PlanState = {
  plan: 'free', isTrial: false, trialEndsAt: null, expiresAt: null,
  willRenew: false, store: null, productId: null, managementURL: null,
};

/** Where a paywall was opened from; stored on the RevenueCat customer as `paywall_source`. */
export type PaywallSource =
  | 'welcome' | 'chat_limit' | 'vision_regen' | 'insights'
  | 'vision_limit' | 'ambient_audio' | 'trial_ended' | 'profile';

export type ServerSubscription = Pick<SubscriptionRow,
  'has_entitlement' | 'expires_at' | 'grace_expires_at' | 'period_type' | 'store' | 'product_id' | 'will_renew' | 'had_trial'>;

// Structural subsets of react-native-purchases types.
export type EntitlementInfoLike = {
  periodType: string; expirationDate: string | null; willRenew: boolean; store: string; productIdentifier: string;
};
export type CustomerInfoLike = {
  entitlements: { active: Record<string, EntitlementInfoLike | undefined> };
  managementURL: string | null;
};
export type ProductLike = {
  introPrice: { price: number } | null;
  defaultOption?: { freePhase: unknown | null } | null;
};
export type StoreEligibility = 'eligible' | 'ineligible' | 'unknown';

const DAY_MS = 24 * 60 * 60 * 1000;

export function planStateFromCustomerInfo(info: CustomerInfoLike): PlanState {
  const e = info.entitlements.active[ENTITLEMENT_ID];
  if (!e) return { ...FREE_STATE, managementURL: info.managementURL };
  const isTrial = e.periodType === 'TRIAL';
  return {
    plan: 'beyond', isTrial,
    trialEndsAt: isTrial ? e.expirationDate : null,
    expiresAt: e.expirationDate,
    willRenew: e.willRenew,
    store: e.store,
    productId: e.productIdentifier,
    managementURL: info.managementURL,
  };
}

export function planStateFromServer(row: ServerSubscription | null, now: Date): PlanState {
  if (!row || planFromRow(row, now) !== 'beyond') return FREE_STATE;
  const isTrial = row.period_type === 'trial';
  return {
    plan: 'beyond', isTrial,
    trialEndsAt: isTrial ? row.expires_at : null,
    expiresAt: row.expires_at,
    willRenew: row.will_renew,
    store: row.store,
    productId: row.product_id,
    managementURL: null,
  };
}

/** Beyond if either source says so; RevenueCat's details win when it does. */
export function resolvePlanState(rc: PlanState | null, server: PlanState): PlanState {
  if (rc?.plan === 'beyond') return rc;
  if (server.plan === 'beyond') return { ...server, managementURL: rc?.managementURL ?? null };
  return rc ?? FREE_STATE;
}

/** iOS/web expose a $0 intro price; Android exposes a free phase only when the user is eligible. */
export function productHasFreeTrial(p: ProductLike): boolean {
  return p.introPrice?.price === 0 || !!p.defaultOption?.freePhase;
}

export function isTrialEligible(a: {
  plan: Plan; productHasTrial: boolean; storeEligibility: StoreEligibility; hadTrial: boolean;
}): boolean {
  return a.plan === 'free' && a.productHasTrial && a.storeEligibility !== 'ineligible' && !a.hadTrial;
}

export function trialDaysLeft(trialEndsAt: string | null, now: Date): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(trialEndsAt) - now.getTime()) / DAY_MS));
}

export function storeLabel(store: string | null): string | null {
  switch ((store ?? '').toUpperCase()) {
    case 'APP_STORE':
    case 'MAC_APP_STORE': return 'the App Store';
    case 'PLAY_STORE': return 'Google Play';
    case 'STRIPE':
    case 'RC_BILLING': return 'the web';
    default: return null;
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function planTitle(s: PlanState, now: Date): string {
  if (s.plan === 'free') return 'Free plan';
  if (s.isTrial) {
    const n = trialDaysLeft(s.trialEndsAt, now);
    return `Beyond trial · ${n} ${n === 1 ? 'day' : 'days'} left`;
  }
  return PAID_PLAN_NAME;
}

export function planDetail(s: PlanState): string {
  if (s.plan === 'free') return PAID_PLAN_PITCH;
  const when = s.expiresAt ? `${s.willRenew ? 'Renews' : 'Ends'} ${formatDate(s.expiresAt)}` : 'Active';
  const via = storeLabel(s.store);
  return via ? `${when} · billed through ${via}` : when;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/plan-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/plan-state.ts __tests__/plan-state.test.ts
git commit -m "feat(billing): client plan-state rules"
```

---

### Task 4: RevenueCat SDK and `usePlan()`

**Files:**
- Modify: `package.json` (via `npx expo install react-native-purchases`)
- Modify: `app.config.js` (`extra`), `.env.example`
- Create: `lib/purchases.ts`
- Create: `store/plan.tsx`
- Modify: `app/_layout.tsx` (wrap in `PlanProvider`)
- Test: `__tests__/purchases.test.ts`, `__tests__/plan-provider.test.tsx`

**Interfaces:**
- Consumes: everything exported by `lib/plan-state.ts` (Task 3)
- Produces:
  - `lib/purchases.ts`:
    - `type PaywallPackage = { period: 'monthly' | 'annual'; productId: string; priceString: string; price: number; hasFreeTrial: boolean; raw: unknown }`
    - `type Packages = { monthly: PaywallPackage | null; annual: PaywallPackage | null }`
    - `revenueCatApiKey(os: string): string`
    - `configurePurchases(appUserID: string): Promise<boolean>`
    - `logOutPurchases(): Promise<void>`
    - `fetchPlanState(): Promise<PlanState>`
    - `onPlanStateChange(cb: (s: PlanState) => void): () => void`
    - `fetchPackages(): Promise<Packages>`
    - `checkTrialEligibility(productId: string): Promise<StoreEligibility>`
    - `purchase(pkg: PaywallPackage, source: PaywallSource): Promise<{ status: 'purchased'; state: PlanState } | { status: 'cancelled' }>`
    - `restore(): Promise<PlanState>`
  - `store/plan.tsx`:
    - `PlanProvider`
    - `usePlan(): PlanContextValue` where `PlanContextValue = PlanState & { loaded: boolean; available: boolean; packages: Packages; isTrialEligible: boolean; trialEligibleFor: (pkg: PaywallPackage | null) => boolean; purchase: (pkg: PaywallPackage, source: PaywallSource) => Promise<'purchased' | 'cancelled'>; restore: () => Promise<Plan>; refresh: () => Promise<void> }`
  - `extra` keys: `revenuecatIosKey`, `revenuecatAndroidKey`, `revenuecatWebKey`

- [ ] **Step 1: Install and configure**

Run: `npx expo install react-native-purchases`
Expected: adds `react-native-purchases` (10.x) to `dependencies`.

In `app.config.js`, add to `extra` after `googleOAuthWebClientId`:

```js
      revenuecatIosKey: process.env.REVENUECAT_IOS_KEY ?? '',
      revenuecatAndroidKey: process.env.REVENUECAT_ANDROID_KEY ?? '',
      revenuecatWebKey: process.env.REVENUECAT_WEB_KEY ?? '',
```

Append to `.env.example`:

```
# RevenueCat public SDK keys (Project settings → API keys). Empty = billing off, everyone Free.
REVENUECAT_IOS_KEY=
REVENUECAT_ANDROID_KEY=
REVENUECAT_WEB_KEY=
```

Real purchases need an EAS development build (`eas build --profile development`). In Expo Go the SDK runs in preview mode with mock purchases.

- [ ] **Step 2: Write the failing tests**

`__tests__/purchases.test.ts`:

```ts
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { revenuecatIosKey: 'appl_x', revenuecatAndroidKey: 'goog_x', revenuecatWebKey: '' } },
}));

const mockPurchasePackage = jest.fn();
const mockSetAttributes = jest.fn().mockResolvedValue(undefined);
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    purchasePackage: (...a: unknown[]) => mockPurchasePackage(...a),
    setAttributes: (...a: unknown[]) => mockSetAttributes(...a),
  },
  INTRO_ELIGIBILITY_STATUS: {},
}));

import { revenueCatApiKey, purchase, type PaywallPackage } from '../lib/purchases';

const pkg: PaywallPackage = {
  period: 'monthly', productId: 'beyond_monthly', priceString: '$3.99', price: 3.99, hasFreeTrial: true, raw: {},
};

describe('revenueCatApiKey', () => {
  it('picks the key for each platform', () => {
    expect(revenueCatApiKey('ios')).toBe('appl_x');
    expect(revenueCatApiKey('android')).toBe('goog_x');
    expect(revenueCatApiKey('web')).toBe('');
  });
});

describe('purchase', () => {
  it('tags the paywall source and returns the new plan state', async () => {
    mockPurchasePackage.mockResolvedValue({
      customerInfo: { managementURL: null, entitlements: { active: { beyond: {
        periodType: 'TRIAL', expirationDate: '2026-10-08T00:00:00Z', willRenew: true, store: 'APP_STORE', productIdentifier: 'beyond_monthly',
      } } } },
    });
    const r = await purchase(pkg, 'vision_regen');
    expect(mockSetAttributes).toHaveBeenCalledWith({ paywall_source: 'vision_regen' });
    expect(r).toMatchObject({ status: 'purchased', state: { plan: 'beyond', isTrial: true } });
  });
  it('reports a cancelled payment sheet without throwing', async () => {
    mockPurchasePackage.mockRejectedValue({ userCancelled: true });
    await expect(purchase(pkg, 'profile')).resolves.toEqual({ status: 'cancelled' });
  });
  it('rethrows real errors', async () => {
    mockPurchasePackage.mockRejectedValue(new Error('network'));
    await expect(purchase(pkg, 'profile')).rejects.toThrow('network');
  });
});
```

`__tests__/plan-provider.test.tsx`:

```tsx
jest.mock('../lib/purchases', () => ({
  configurePurchases: jest.fn(),
  logOutPurchases: jest.fn().mockResolvedValue(undefined),
  fetchPlanState: jest.fn(),
  onPlanStateChange: jest.fn(() => () => {}),
  fetchPackages: jest.fn(),
  checkTrialEligibility: jest.fn().mockResolvedValue('unknown'),
  purchase: jest.fn(),
  restore: jest.fn(),
}));

const mockInvoke = jest.fn();
const mockMaybeSingle = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
  },
}));

jest.mock('../store/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { PlanProvider, usePlan } from '../store/plan';
import * as purchases from '../lib/purchases';
import { FREE_STATE } from '../lib/plan-state';

const P = purchases as jest.Mocked<typeof purchases>;
const wrapper = ({ children }: { children: React.ReactNode }) => <PlanProvider>{children}</PlanProvider>;
const monthly = { period: 'monthly' as const, productId: 'beyond_monthly', priceString: '$3.99', price: 3.99, hasFreeTrial: true, raw: {} };

beforeEach(() => {
  jest.clearAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
});

it('stays usable when RevenueCat is unavailable, honouring an active server row', async () => {
  P.configurePurchases.mockResolvedValue(false);
  mockMaybeSingle.mockResolvedValue({ data: {
    has_entitlement: true, expires_at: '2999-01-01T00:00:00Z', grace_expires_at: null,
    period_type: 'normal', store: 'stripe', product_id: 'beyond_monthly', will_renew: true, had_trial: true,
  }, error: null });
  const { result } = renderHook(() => usePlan(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.available).toBe(false);
  expect(result.current.plan).toBe('beyond');
});

it('is trial-eligible on Free with a trial product and no prior trial', async () => {
  P.configurePurchases.mockResolvedValue(true);
  P.fetchPlanState.mockResolvedValue(FREE_STATE);
  P.fetchPackages.mockResolvedValue({ monthly, annual: null });
  const { result } = renderHook(() => usePlan(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.isTrialEligible).toBe(true);
});

it('syncs the server before a purchase resolves', async () => {
  P.configurePurchases.mockResolvedValue(true);
  P.fetchPlanState.mockResolvedValue(FREE_STATE);
  P.fetchPackages.mockResolvedValue({ monthly, annual: null });
  P.purchase.mockResolvedValue({ status: 'purchased', state: { ...FREE_STATE, plan: 'beyond', isTrial: true } });
  const { result } = renderHook(() => usePlan(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));

  let outcome: string | undefined;
  await act(async () => { outcome = await result.current.purchase(monthly, 'profile'); });
  expect(outcome).toBe('purchased');
  expect(mockInvoke).toHaveBeenCalledWith('sync-subscription');
  expect(result.current.plan).toBe('beyond');
});

it('does not sync when the payment sheet is cancelled', async () => {
  P.configurePurchases.mockResolvedValue(true);
  P.fetchPlanState.mockResolvedValue(FREE_STATE);
  P.fetchPackages.mockResolvedValue({ monthly, annual: null });
  P.purchase.mockResolvedValue({ status: 'cancelled' });
  const { result } = renderHook(() => usePlan(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  let outcome: string | undefined;
  await act(async () => { outcome = await result.current.purchase(monthly, 'profile'); });
  expect(outcome).toBe('cancelled');
  expect(mockInvoke).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest __tests__/purchases.test.ts __tests__/plan-provider.test.tsx`
Expected: FAIL with "Cannot find module '../lib/purchases'" / "'../store/plan'"

- [ ] **Step 4: Write `lib/purchases.ts`**

```ts
// The only file that talks to the RevenueCat SDK. Everything it returns is in
// our own shapes (PlanState, PaywallPackage) so the rest of the app never
// imports react-native-purchases.

import Purchases, {
  INTRO_ELIGIBILITY_STATUS, type CustomerInfo, type PurchasesPackage,
} from 'react-native-purchases';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  planStateFromCustomerInfo, productHasFreeTrial,
  type CustomerInfoLike, type PaywallSource, type PlanState, type ProductLike, type StoreEligibility,
} from './plan-state';

export type PaywallPackage = {
  period: 'monthly' | 'annual';
  productId: string;
  priceString: string;
  price: number;
  hasFreeTrial: boolean;
  raw: unknown;
};
export type Packages = { monthly: PaywallPackage | null; annual: PaywallPackage | null };

const extra = (Constants.expoConfig?.extra ?? {}) as {
  revenuecatIosKey?: string; revenuecatAndroidKey?: string; revenuecatWebKey?: string;
};

export function revenueCatApiKey(os: string): string {
  if (os === 'ios') return extra.revenuecatIosKey ?? '';
  if (os === 'android') return extra.revenuecatAndroidKey ?? '';
  if (os === 'web') return extra.revenuecatWebKey ?? '';
  return '';
}

let configured = false;

/** Configures the SDK for this user (or switches user). False = billing unavailable. */
export async function configurePurchases(appUserID: string): Promise<boolean> {
  const apiKey = revenueCatApiKey(Platform.OS);
  if (!apiKey) {
    console.warn('[purchases] No RevenueCat key for', Platform.OS, '— billing is off.');
    return false;
  }
  try {
    if (!configured) {
      Purchases.configure({ apiKey, appUserID });
      configured = true;
    } else {
      await Purchases.logIn(appUserID);
    }
    return true;
  } catch (e) {
    console.warn('[purchases] configure failed', e);
    return false;
  }
}

export async function logOutPurchases(): Promise<void> {
  if (!configured) return;
  await Purchases.logOut().catch(() => {});
}

const toState = (info: CustomerInfo) => planStateFromCustomerInfo(info as unknown as CustomerInfoLike);

export async function fetchPlanState(): Promise<PlanState> {
  return toState(await Purchases.getCustomerInfo());
}

export function onPlanStateChange(cb: (s: PlanState) => void): () => void {
  const listener = (info: CustomerInfo) => cb(toState(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => { Purchases.removeCustomerInfoUpdateListener(listener); };
}

function toPaywallPackage(p: PurchasesPackage | null | undefined, period: PaywallPackage['period']): PaywallPackage | null {
  if (!p) return null;
  return {
    period,
    productId: p.product.identifier,
    priceString: p.product.priceString,
    price: p.product.price,
    hasFreeTrial: productHasFreeTrial(p.product as unknown as ProductLike),
    raw: p,
  };
}

/** The current offering's $rc_monthly and $rc_annual packages. */
export async function fetchPackages(): Promise<Packages> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  return {
    monthly: toPaywallPackage(current?.monthly, 'monthly'),
    annual: toPaywallPackage(current?.annual, 'annual'),
  };
}

/** Only iOS answers this; elsewhere the product itself only carries a trial when eligible. */
export async function checkTrialEligibility(productId: string): Promise<StoreEligibility> {
  if (Platform.OS !== 'ios') return 'unknown';
  const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([productId]);
  const status = result[productId]?.status;
  if (status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE) return 'eligible';
  if (status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE) return 'ineligible';
  return 'unknown';
}

export async function purchase(
  pkg: PaywallPackage, source: PaywallSource,
): Promise<{ status: 'purchased'; state: PlanState } | { status: 'cancelled' }> {
  await Purchases.setAttributes({ paywall_source: source }).catch(() => {});
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg.raw as PurchasesPackage);
    return { status: 'purchased', state: toState(customerInfo) };
  } catch (e) {
    if ((e as { userCancelled?: boolean } | null)?.userCancelled) return { status: 'cancelled' };
    throw e;
  }
}

export async function restore(): Promise<PlanState> {
  return toState(await Purchases.restorePurchases());
}
```

- [ ] **Step 5: Write `store/plan.tsx`**

```tsx
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';
import {
  configurePurchases, logOutPurchases, fetchPlanState, onPlanStateChange, fetchPackages,
  checkTrialEligibility, purchase as purchasePackage, restore as restorePurchases,
  type PaywallPackage, type Packages,
} from '../lib/purchases';
import {
  FREE_STATE, planStateFromServer, resolvePlanState, isTrialEligible,
  type Plan, type PlanState, type PaywallSource, type ServerSubscription, type StoreEligibility,
} from '../lib/plan-state';

type PlanContextValue = PlanState & {
  /** RevenueCat (if available) and the server row have both been read. */
  loaded: boolean;
  /** RevenueCat is configured, so purchases are possible on this device. */
  available: boolean;
  packages: Packages;
  isTrialEligible: boolean;
  trialEligibleFor: (pkg: PaywallPackage | null) => boolean;
  purchase: (pkg: PaywallPackage, source: PaywallSource) => Promise<'purchased' | 'cancelled'>;
  restore: () => Promise<Plan>;
  refresh: () => Promise<void>;
};

const NO_PACKAGES: Packages = { monthly: null, annual: null };
const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [rcState, setRcState] = useState<PlanState | null>(null);
  const [serverRow, setServerRow] = useState<ServerSubscription | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(false);
  const [packages, setPackages] = useState<Packages>(NO_PACKAGES);
  const [storeEligibility, setStoreEligibility] = useState<StoreEligibility>('unknown');

  const loadServer = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('subscriptions')
      .select('has_entitlement, expires_at, grace_expires_at, period_type, store, product_id, will_renew, had_trial')
      .eq('user_id', id)
      .maybeSingle();
    setServerRow((data as ServerSubscription | null) ?? null);
  }, []);

  /** Ask the server to re-read RevenueCat now, then reload our row. */
  const syncServer = useCallback(async () => {
    if (!userId) return;
    await supabase.functions.invoke('sync-subscription').catch(() => {});
    await loadServer(userId).catch(() => {});
  }, [userId, loadServer]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setLoaded(false);
    setRcState(null);
    setServerRow(null);
    setPackages(NO_PACKAGES);
    if (!userId) {
      logOutPurchases();
      setAvailable(false);
      return;
    }
    (async () => {
      const ok = await configurePurchases(userId);
      if (cancelled) return;
      setAvailable(ok);
      const work: Promise<unknown>[] = [loadServer(userId)];
      if (ok) {
        unsubscribe = onPlanStateChange(s => { if (!cancelled) setRcState(s); });
        work.push(fetchPlanState().then(s => { if (!cancelled) setRcState(s); }));
        work.push(fetchPackages().then(async p => {
          if (cancelled) return;
          setPackages(p);
          const id = (p.monthly ?? p.annual)?.productId;
          if (id) {
            const e = await checkTrialEligibility(id).catch(() => 'unknown' as const);
            if (!cancelled) setStoreEligibility(e);
          }
        }));
      }
      await Promise.allSettled(work);
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [userId, loadServer]);

  const state = useMemo(
    () => resolvePlanState(rcState, planStateFromServer(serverRow, new Date())),
    [rcState, serverRow],
  );

  const trialEligibleFor = useCallback((pkg: PaywallPackage | null) => isTrialEligible({
    plan: state.plan,
    productHasTrial: !!pkg?.hasFreeTrial,
    storeEligibility,
    hadTrial: !!serverRow?.had_trial,
  }), [state.plan, storeEligibility, serverRow?.had_trial]);

  const purchase = useCallback(async (pkg: PaywallPackage, source: PaywallSource) => {
    const result = await purchasePackage(pkg, source);
    if (result.status === 'cancelled') return 'cancelled';
    setRcState(result.state);
    await syncServer();
    return 'purchased';
  }, [syncServer]);

  const restore = useCallback(async () => {
    const s = await restorePurchases();
    setRcState(s);
    await syncServer();
    return s.plan;
  }, [syncServer]);

  const refresh = useCallback(async () => {
    if (available) setRcState(await fetchPlanState().catch(() => rcState));
    await syncServer();
  }, [available, rcState, syncServer]);

  const value = useMemo<PlanContextValue>(() => ({
    ...state,
    loaded, available, packages,
    isTrialEligible: trialEligibleFor(packages.monthly ?? packages.annual),
    trialEligibleFor, purchase, restore, refresh,
  }), [state, loaded, available, packages, trialEligibleFor, purchase, restore, refresh]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be called inside <PlanProvider>');
  return ctx;
}
```

- [ ] **Step 6: Wire the provider**

In `app/_layout.tsx`, add `import { PlanProvider } from '../store/plan';` next to the other store imports, and wrap it directly inside `<ProfileProvider>` so every later provider and screen can call `usePlan()`:

```tsx
          <ProfileProvider>
            <PlanProvider>
            <OnboardingProvider>
              …existing tree unchanged…
            </OnboardingProvider>
            </PlanProvider>
          </ProfileProvider>
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest __tests__/purchases.test.ts __tests__/plan-provider.test.tsx`
Expected: PASS
Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → `18` (unchanged baseline)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json app.config.js .env.example lib/purchases.ts store/plan.tsx app/_layout.tsx \
  __tests__/purchases.test.ts __tests__/plan-provider.test.tsx
git commit -m "feat(billing): RevenueCat SDK wrapper and usePlan()"
```

---

### Task 5: The paywall

**Files:**
- Modify: `constants/brand.ts`
- Create: `lib/paywall.ts`
- Create: `app/paywall.tsx`
- Modify: `app/_layout.tsx` (register route)
- Test: `__tests__/paywall-lib.test.ts`, `__tests__/paywall-screen.test.tsx`

**Interfaces:**
- Consumes: `usePlan()` (Task 4), `PaywallPackage` (Task 4), `PaywallSource`, `formatDate` (Task 3)
- Produces:
  - `constants/brand.ts`: `VISION_PITCH`, `WELCOME_OFFER`, `BEYOND_FEATURES: { title: string; detail: string }[]`, `TERMS_URL`, `PRIVACY_URL`
  - `lib/paywall.ts`:
    - `openPaywall(source: PaywallSource, onUnlocked?: () => void): void`
    - `takePendingAction(token: string | undefined): (() => void) | undefined`
    - `dropPendingAction(token: string | undefined): void`
    - `paywallHeadline(source: PaywallSource): string`
    - `primaryLabel(pkg: PaywallPackage, trialEligible: boolean): string`
    - `annualSavingsPercent(monthly: PaywallPackage | null, annual: PaywallPackage | null): number | null`
    - `renewalTerms(os: string, pkg: PaywallPackage, trialEligible: boolean, now: Date): string`
  - Route `/paywall?source=<PaywallSource>&token=<string?>`

- [ ] **Step 1: Add the copy**

Append to `constants/brand.ts`:

```ts
export const VISION_PITCH = 'See it. Build it. Become it.';
export const WELCOME_OFFER = 'Try Goalify Beyond free for 7 days';

export const BEYOND_FEATURES = [
  { title: 'Keep talking to your coach', detail: 'Up to 150 messages a month' },
  { title: 'Fresh insights every day', detail: 'Instead of 3 a month' },
  { title: 'Regenerate your vision', detail: 'A new image for any goal, once a week' },
  { title: '30 vision images a month', detail: 'Instead of 10' },
];

export const TERMS_URL = 'https://goalify.life/terms';
export const PRIVACY_URL = 'https://goalify.life/privacy';
```

- [ ] **Step 2: Write the failing tests**

`__tests__/paywall-lib.test.ts`:

```ts
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
```

`__tests__/paywall-screen.test.tsx`:

```tsx
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('../store/plan', () => ({ usePlan: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import PaywallScreen from '../app/paywall';
import { usePlan } from '../store/plan';
import { openPaywall } from '../lib/paywall';

const monthly = { period: 'monthly' as const, productId: 'beyond_monthly', priceString: '$3.99', price: 3.99, hasFreeTrial: true, raw: {} };
const annual = { period: 'annual' as const, productId: 'beyond_annual', priceString: '$29.99', price: 29.99, hasFreeTrial: true, raw: {} };

function plan(over: Record<string, unknown> = {}) {
  return {
    plan: 'free', loaded: true, available: true, packages: { monthly, annual },
    trialEligibleFor: () => true, purchase: jest.fn(), restore: jest.fn(), ...over,
  };
}

function openWith(action?: () => void) {
  (router.push as jest.Mock).mockClear();
  openPaywall('vision_regen', action);
  const params = (router.push as jest.Mock).mock.calls[0][0].params;
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
}

beforeEach(() => jest.clearAllMocks());

it('shows the trial button for eligible users and runs the continuation after purchase', async () => {
  const action = jest.fn();
  openWith(action);
  const p = plan({ purchase: jest.fn().mockResolvedValue('purchased') });
  (usePlan as jest.Mock).mockReturnValue(p);
  const { getByText } = render(<PaywallScreen />);
  fireEvent.press(getByText('Start 7-day free trial'));
  await waitFor(() => expect(action).toHaveBeenCalled());
  expect(p.purchase).toHaveBeenCalledWith(monthly, 'vision_regen');
  expect(router.back).toHaveBeenCalled();
});

it('stays open and skips the continuation when the payment sheet is cancelled', async () => {
  const action = jest.fn();
  openWith(action);
  const alert = jest.spyOn(Alert, 'alert');
  const p = plan({ purchase: jest.fn().mockResolvedValue('cancelled') });
  (usePlan as jest.Mock).mockReturnValue(p);
  const { getByText } = render(<PaywallScreen />);
  fireEvent.press(getByText('Start 7-day free trial'));
  await waitFor(() => expect(p.purchase).toHaveBeenCalled());
  expect(action).not.toHaveBeenCalled();
  expect(router.back).not.toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
});

it('switches to the annual price when annual is picked and the user is not trial-eligible', () => {
  openWith();
  (usePlan as jest.Mock).mockReturnValue(plan({ trialEligibleFor: () => false }));
  const { getByText } = render(<PaywallScreen />);
  fireEvent.press(getByText('Yearly'));
  expect(getByText('Subscribe · $29.99/year')).toBeTruthy();
});

it('explains when billing is unavailable instead of offering a button', () => {
  openWith();
  (usePlan as jest.Mock).mockReturnValue(plan({ available: false, packages: { monthly: null, annual: null } }));
  const { getByText, queryByText } = render(<PaywallScreen />);
  expect(getByText("Subscriptions aren't available on this device right now.")).toBeTruthy();
  expect(queryByText('Start 7-day free trial')).toBeNull();
});

it('shows Restore purchases and the legal links', () => {
  openWith();
  (usePlan as jest.Mock).mockReturnValue(plan());
  const { getByText } = render(<PaywallScreen />);
  expect(getByText('Restore purchases')).toBeTruthy();
  expect(getByText('Terms of Use')).toBeTruthy();
  expect(getByText('Privacy Policy')).toBeTruthy();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest __tests__/paywall-lib.test.ts __tests__/paywall-screen.test.tsx`
Expected: FAIL with "Cannot find module '../lib/paywall'"

- [ ] **Step 4: Write `lib/paywall.ts`**

```ts
// One paywall for every upgrade moment. Callers pass the moment (`source`)
// and, optionally, what to do once the user is on Beyond; the paywall screen
// runs it after a successful purchase or restore.

import { router } from 'expo-router';
import { PAID_PLAN_PITCH, VISION_PITCH, WELCOME_OFFER } from '../constants/brand';
import { formatDate, type PaywallSource } from './plan-state';
import type { PaywallPackage } from './purchases';

const pending = new Map<string, () => void>();
let seq = 0;

export function openPaywall(source: PaywallSource, onUnlocked?: () => void): void {
  if (!onUnlocked) {
    router.push({ pathname: '/paywall', params: { source } });
    return;
  }
  const token = String(++seq);
  pending.set(token, onUnlocked);
  router.push({ pathname: '/paywall', params: { source, token } });
}

export function takePendingAction(token: string | undefined): (() => void) | undefined {
  if (!token) return undefined;
  const action = pending.get(token);
  pending.delete(token);
  return action;
}

export function dropPendingAction(token: string | undefined): void {
  if (token) pending.delete(token);
}

export function paywallHeadline(source: PaywallSource): string {
  if (source === 'vision_regen') return VISION_PITCH;
  if (source === 'welcome') return WELCOME_OFFER;
  return PAID_PLAN_PITCH;
}

const per = (pkg: PaywallPackage) => (pkg.period === 'annual' ? 'year' : 'month');

export function primaryLabel(pkg: PaywallPackage, trialEligible: boolean): string {
  if (trialEligible) return 'Start 7-day free trial';
  return `Subscribe · ${pkg.priceString}/${per(pkg)}`;
}

export function annualSavingsPercent(monthly: PaywallPackage | null, annual: PaywallPackage | null): number | null {
  if (!monthly || !annual || monthly.price <= 0) return null;
  return Math.round((1 - annual.price / (monthly.price * 12)) * 100);
}

const TRIAL_DAYS = 7;

export function renewalTerms(os: string, pkg: PaywallPackage, trialEligible: boolean, now: Date): string {
  const price = `${pkg.priceString}/${per(pkg)}`;
  const firstCharge = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const lead = trialEligible ? `Free for 7 days, then ${price} starting ${formatDate(firstCharge)}.` : `${price}.`;
  const payer = os === 'ios' ? 'your Apple ID' : os === 'android' ? 'your Google Play account' : 'your card';
  return `${lead} Payment is charged to ${payer}. ` +
    'Renews automatically unless cancelled at least 24 hours before the end of the current period. ' +
    'Manage or cancel any time in your account settings.';
}
```

- [ ] **Step 5: Write `app/paywall.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { F } from '../components/ui';
import { BEYOND_FEATURES, PAID_PLAN_NAME, PRIVACY_URL, TERMS_URL } from '../constants/brand';
import { usePlan } from '../store/plan';
import {
  annualSavingsPercent, dropPendingAction, paywallHeadline, primaryLabel, renewalTerms, takePendingAction,
} from '../lib/paywall';
import type { PaywallSource } from '../lib/plan-state';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ source?: string; token?: string }>();
  const source = (params.source ?? 'profile') as PaywallSource;
  const token = params.token;
  const { loaded, available, packages, trialEligibleFor, purchase, restore } = usePlan();
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState(false);
  const finished = useRef(false);

  // A swipe-down dismiss unmounts without pressing a button: drop the continuation.
  useEffect(() => () => { if (!finished.current) dropPendingAction(token); }, [token]);

  const pkg = (period === 'annual' ? packages.annual : packages.monthly) ?? packages.monthly ?? packages.annual;
  const eligible = trialEligibleFor(pkg);
  const savings = annualSavingsPercent(packages.monthly, packages.annual);

  const unlocked = () => {
    finished.current = true;
    const action = takePendingAction(token);
    router.back();
    action?.();
  };

  const close = () => {
    finished.current = true;
    dropPendingAction(token);
    router.back();
  };

  const onBuy = async () => {
    if (!pkg || busy) return;
    setBusy(true);
    try {
      if (await purchase(pkg, source) === 'purchased') unlocked();
    } catch (e) {
      Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await restore() === 'beyond') unlocked();
      else Alert.alert('No subscription found', `We couldn't find a ${PAID_PLAN_NAME} subscription for this account.`);
    } catch {
      Alert.alert('Restore failed', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}>
      <TouchableOpacity onPress={close} style={s.close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={s.closeText}>{source === 'welcome' ? 'Maybe later' : 'Not now'}</Text>
      </TouchableOpacity>

      <Text style={s.kicker}>{PAID_PLAN_NAME}</Text>
      <Text style={s.headline}>{paywallHeadline(source)}</Text>

      <View style={s.features}>
        {BEYOND_FEATURES.map(f => (
          <View key={f.title} style={s.feature}>
            <Text style={s.featureTitle}>✦ {f.title}</Text>
            <Text style={s.featureDetail}>{f.detail}</Text>
          </View>
        ))}
      </View>

      {!loaded ? (
        <ActivityIndicator color={COLORS.ink1} style={{ marginTop: 24 }} />
      ) : !available || !pkg ? (
        <Text style={s.unavailable}>Subscriptions aren't available on this device right now.</Text>
      ) : (
        <>
          {packages.monthly && packages.annual && (
            <View style={s.periods}>
              {(['monthly', 'annual'] as const).map(p => {
                const option = packages[p]!;
                const selected = period === p;
                return (
                  <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={[s.period, selected && s.periodSelected]}>
                    <Text style={[s.periodName, selected && s.periodNameSelected]}>{p === 'annual' ? 'Yearly' : 'Monthly'}</Text>
                    <Text style={[s.periodPrice, selected && s.periodNameSelected]}>
                      {option.priceString}/{p === 'annual' ? 'year' : 'month'}
                    </Text>
                    {p === 'annual' && savings ? <Text style={s.save}>Save {savings}%</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity onPress={onBuy} disabled={busy} style={[s.cta, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color={COLORS.paper} /> : <Text style={s.ctaText}>{primaryLabel(pkg, eligible)}</Text>}
          </TouchableOpacity>

          <Text style={s.terms}>{renewalTerms(Platform.OS, pkg, eligible, new Date())}</Text>
        </>
      )}

      <TouchableOpacity onPress={onRestore} disabled={busy} style={s.restore}>
        <Text style={s.link}>Restore purchases</Text>
      </TouchableOpacity>
      <View style={s.legal}>
        <Text style={s.link} onPress={() => Linking.openURL(TERMS_URL)}>Terms of Use</Text>
        <Text style={s.link}> · </Text>
        <Text style={s.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper, paddingHorizontal: 24 },
  close: { alignSelf: 'flex-end', paddingVertical: 4 },
  closeText: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.ink3 },
  kicker: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: COLORS.accentWarm, marginTop: 24 },
  headline: { fontFamily: F.display, fontSize: 34, lineHeight: 38, color: COLORS.ink1, marginTop: 10, letterSpacing: -0.4 },
  features: { marginTop: 28, gap: 14 },
  feature: {},
  featureTitle: { fontSize: 15, fontWeight: '500', color: COLORS.ink1 },
  featureDetail: { fontSize: 13, color: COLORS.ink3, marginTop: 2, marginLeft: 18 },
  unavailable: { marginTop: 28, fontSize: 14, color: COLORS.ink3, textAlign: 'center' },
  periods: { flexDirection: 'row', gap: 10, marginTop: 32 },
  period: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: COLORS.ink6, padding: 14, backgroundColor: COLORS.surface },
  periodSelected: { borderColor: COLORS.ink1, backgroundColor: COLORS.ink1 },
  periodName: { fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3 },
  periodNameSelected: { color: COLORS.paper },
  periodPrice: { fontSize: 16, color: COLORS.ink1, marginTop: 6 },
  save: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.accentWarm, marginTop: 6 },
  cta: { marginTop: 20, backgroundColor: COLORS.ink1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: COLORS.paper, fontSize: 15, fontWeight: '600' },
  terms: { marginTop: 14, fontSize: 11, lineHeight: 16, color: COLORS.ink3, textAlign: 'center' },
  restore: { marginTop: 24, alignItems: 'center' },
  legal: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  link: { fontSize: 12, color: COLORS.ink3, textDecorationLine: 'underline' },
});
```

In `app/_layout.tsx`, register the route next to the other modal screens:

```tsx
                    <Stack.Screen name="paywall" options={{ presentation: 'modal', gestureEnabled: true }} />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest __tests__/paywall-lib.test.ts __tests__/paywall-screen.test.tsx`
Expected: PASS
Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → `18`

- [ ] **Step 7: Commit**

```bash
git add constants/brand.ts lib/paywall.ts app/paywall.tsx app/_layout.tsx \
  __tests__/paywall-lib.test.ts __tests__/paywall-screen.test.tsx
git commit -m "feat(billing): Goalify Beyond paywall"
```

---

### Task 6: Vision upgrade moments (U2 regenerate, U5 ambient audio)

**Files:**
- Modify: `constants/flags.ts`
- Modify: `store/vision.tsx:15,185-189` (`canRegenAsset`)
- Modify: `components/vision/FilmOverlay.tsx`
- Modify: `app/vision/[goalId].tsx:14-15,52-55,119-125,156-164`
- Test: `__tests__/film-overlay.test.tsx`

**Interfaces:**
- Consumes: `usePlan()` (Task 4), `openPaywall` (Task 5)
- Produces: `constants/flags.ts` exports only `VISION_AUDIO_AVAILABLE = false`. `useVisionAssets().canRegen` now checks only the 7-day cooldown; plan gating happens in the UI and on the server.

- [ ] **Step 1: Write the failing test**

`__tests__/film-overlay.test.tsx`:

```tsx
jest.mock('../store/plan', () => ({ usePlan: jest.fn() }));
jest.mock('../lib/paywall', () => ({ openPaywall: jest.fn() }));
jest.mock('../store/vision', () => ({ useVisionAssets: jest.fn() }));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Path: View };
});

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { FilmOverlay } from '../components/vision/FilmOverlay';
import { usePlan } from '../store/plan';
import { openPaywall } from '../lib/paywall';
import { useVisionAssets } from '../store/vision';

const requestRegen = jest.fn();
const props = { goalId: 'g1', goalTitle: 'Run a marathon', sphere: 'health' as const, caption: 'c', progress: 0.4 };

beforeEach(() => {
  jest.clearAllMocks();
  (useVisionAssets as jest.Mock).mockReturnValue({
    requestRegen, canRegen: () => true, getAsset: () => ({ status: 'ready' }),
  });
});

it('shows a locked regenerate button on Free that opens the paywall and regenerates after purchase', () => {
  (usePlan as jest.Mock).mockReturnValue({ plan: 'free' });
  const { getByLabelText } = render(<FilmOverlay {...props} />);
  fireEvent.press(getByLabelText('Regenerate vision (Goalify Beyond)'));
  expect(openPaywall).toHaveBeenCalledWith('vision_regen', expect.any(Function));
  (openPaywall as jest.Mock).mock.calls[0][1]();
  expect(requestRegen).toHaveBeenCalledWith('g1', 3, 'Run a marathon', 'health');
});

it('asks for confirmation on Beyond instead of opening the paywall', () => {
  (usePlan as jest.Mock).mockReturnValue({ plan: 'beyond' });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { getByLabelText } = render(<FilmOverlay {...props} />);
  fireEvent.press(getByLabelText('Regenerate vision'));
  expect(openPaywall).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith('Regenerate vision?', expect.any(String), expect.any(Array));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/film-overlay.test.tsx`
Expected: FAIL (no element with that accessibility label; the button is hidden behind `PRO_VISION_REGEN`)

- [ ] **Step 3: Implement**

`constants/flags.ts`, replacing the whole file:

```ts
// Ambient audio needs assets/audio/ambient_*.m4a, which aren't bundled yet.
// When they are, flip this; Beyond users then hear it in the vision view.
export const VISION_AUDIO_AVAILABLE = false;
```

`store/vision.tsx`: delete the `import { PRO_VISION_REGEN } …` line, and change `canRegenAsset` to check only the cooldown:

```ts
  // Cooldown only. Whether the user may regenerate at all (Beyond) is decided
  // by the UI (FilmOverlay opens the paywall on Free) and enforced by the server.
  const canRegenAsset = (asset: VisionAsset | undefined): boolean => {
    if (!asset) return false;
    if (!asset.last_regen_at) return true;
    return Date.now() - new Date(asset.last_regen_at).getTime() > REGEN_COOLDOWN_MS;
  };
```

`components/vision/FilmOverlay.tsx`: replace the `PRO_VISION_REGEN` import with

```ts
import { usePlan } from '../../store/plan';
import { openPaywall } from '../../lib/paywall';
```

In the component body, add `const { plan } = usePlan();` and `const locked = plan !== 'beyond';` and put this at the top of `handleRegen` (after the `isGenerating` guard):

```ts
    if (locked) {
      openPaywall('vision_regen', () => requestRegen(goalId, FINAL_STAGE, goalTitle, sphere));
      return;
    }
```

Replace the `{PRO_VISION_REGEN && ( … )}` block and its comment with an always-rendered button that shows a small lock on Free:

```tsx
      {/* Progress + regen row. Free: tapping opens the paywall (U2). */}
      <View style={s.stageRow}>
        <Text style={s.stageLabel}>{Math.round(progress * 100)}% of the way there</Text>

        <TouchableOpacity
          onPress={handleRegen}
          style={[s.regenBtn, isGenerating && s.regenBtnDisabled]}
          disabled={isGenerating}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={locked ? 'Regenerate vision (Goalify Beyond)' : 'Regenerate vision'}
        >
          {isGenerating ? (
            <Text style={s.regenText}>…</Text>
          ) : (
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Path
                d="M13.5 8a5.5 5.5 0 1 1-1.5-3.79M13.5 2v3.5H10"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
          {locked && !isGenerating && <Text style={s.lock}>🔒</Text>}
        </TouchableOpacity>
      </View>
```

Add to the `StyleSheet`:

```ts
  lock: { position: 'absolute', right: -2, bottom: -2, fontSize: 8 },
```

`app/vision/[goalId].tsx`:
- Replace `import { PRO_VISION_AUDIO } from '../../constants/flags';` with
  `import { VISION_AUDIO_AVAILABLE } from '../../constants/flags';`, and add `import { usePlan } from '../../store/plan';` and `import { openPaywall } from '../../lib/paywall';`.
- Add `TouchableOpacity` to the `react-native` import.
- In the component add `const { plan } = usePlan();`.
- Change the audio effect guard `if (!PRO_VISION_AUDIO || !goal) return;` to
  `if (!VISION_AUDIO_AVAILABLE || plan !== 'beyond' || !goal) return;` and add `plan` to that effect's dependency array.
- Replace the badge block with (Beyond users see no badge until audio ships):

```tsx
      {/* Ambient audio teaser on Free (U5) */}
      {plan === 'free' && (
        <TouchableOpacity
          style={s.audioBadge}
          onPress={() => openPaywall('ambient_audio')}
          accessibilityRole="button"
          accessibilityLabel="Ambient audio with Goalify Beyond"
        >
          <Text style={s.audioBadgeText}>♩ Ambient · {PAID_PLAN_SHORT}</Text>
        </TouchableOpacity>
      )}
```

Check nothing else references the old flags:
Run: `grep -rn "PRO_VISION\|PRO_RITUAL" app components store lib constants` → no output.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/film-overlay.test.tsx __tests__/vision-regen.test.ts`
Expected: PASS
Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → `18`

- [ ] **Step 5: Commit**

```bash
git add constants/flags.ts store/vision.tsx components/vision/FilmOverlay.tsx "app/vision/[goalId].tsx" __tests__/film-overlay.test.tsx
git commit -m "feat(billing): vision regenerate and ambient audio open the paywall on Free"
```

---

### Task 7: Coach upgrade moments (U1 chat limit, U3 insights)

**Files:**
- Modify: `store/reducer.ts:34-36,61,162-165`
- Modify: `app/(tabs)/coach.tsx` (`CoachInsights`)
- Create: `lib/coach-upsell.ts`
- Test: `__tests__/coach-upsell.test.ts`, add a case to `__tests__/store.test.ts`

**Interfaces:**
- Consumes: `usePlan()` (Task 4), `openPaywall` (Task 5), `CoachLimitError.upgrade` (existing)
- Produces:
  - `ChatMessage = { id: string; role: 'user' | 'coach'; text: string; upgrade?: boolean }`
  - Action `{ type: 'ADD_COACH_REPLY'; text: string; upgrade?: boolean }`
  - `showInsightsUpsell(plan: Plan, insightsUpdatedAt: string | null, now: Date): boolean`

- [ ] **Step 1: Write the failing tests**

`__tests__/coach-upsell.test.ts`:

```ts
import { showInsightsUpsell } from '../lib/coach-upsell';

const NOW = new Date('2026-10-01T12:00:00Z');

describe('showInsightsUpsell', () => {
  it('shows on Free once insights are more than a day old', () => {
    expect(showInsightsUpsell('free', '2026-09-30T11:00:00Z', NOW)).toBe(true);
  });
  it('hides while insights are fresh', () => {
    expect(showInsightsUpsell('free', '2026-10-01T02:00:00Z', NOW)).toBe(false);
  });
  it('hides on Beyond and when there are no insights', () => {
    expect(showInsightsUpsell('beyond', '2026-09-01T00:00:00Z', NOW)).toBe(false);
    expect(showInsightsUpsell('free', null, NOW)).toBe(false);
  });
});
```

Add to `__tests__/store.test.ts`, inside `describe('ADD_USER_MESSAGE / ADD_COACH_REPLY', …)` (it already imports `appReducer` and has the `state()` helper):

```ts
  it('keeps the upgrade flag on a coach reply', () => {
    const next = appReducer(state(), { type: 'ADD_COACH_REPLY', text: 'limit', upgrade: true });
    expect(next.coachMessages[next.coachMessages.length - 1]).toMatchObject({ role: 'coach', text: 'limit', upgrade: true });
  });

  it('leaves the upgrade flag off ordinary replies', () => {
    const next = appReducer(state(), { type: 'ADD_COACH_REPLY', text: 'hi' });
    expect(next.coachMessages[next.coachMessages.length - 1].upgrade).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/coach-upsell.test.ts __tests__/store.test.ts`
Expected: FAIL ("Cannot find module '../lib/coach-upsell'", and `upgrade` missing from the message)

- [ ] **Step 3: Implement**

`lib/coach-upsell.ts`:

```ts
import type { Plan } from './plan-state';

const DAY_MS = 24 * 60 * 60 * 1000;

/** U3: a quiet line under Free users' insights once they're over a day old. */
export function showInsightsUpsell(plan: Plan, insightsUpdatedAt: string | null, now: Date): boolean {
  if (plan !== 'free' || !insightsUpdatedAt) return false;
  return now.getTime() - Date.parse(insightsUpdatedAt) > DAY_MS;
}
```

`store/reducer.ts`:

```ts
export type ChatMessage = {
  id: string; role: 'user' | 'coach'; text: string;
  /** The Free chat allowance is used up: show the "Get Goalify Beyond" button (U1). */
  upgrade?: boolean;
};
```

```ts
  | { type: 'ADD_COACH_REPLY'; text: string; upgrade?: boolean }
```

```ts
    case 'ADD_COACH_REPLY': {
      const coachMsg: ChatMessage = {
        id: newId(), role: 'coach', text: action.text,
        ...(action.upgrade ? { upgrade: true } : {}),
      };
      return { ...state, coachMessages: [...state.coachMessages, coachMsg] };
    }
```

`app/(tabs)/coach.tsx`, in `CoachInsights`:
- Add imports: `import { usePlan } from '../../store/plan';`, `import { openPaywall } from '../../lib/paywall';`, `import { showInsightsUpsell } from '../../lib/coach-upsell';`, `import { PAID_PLAN_NAME } from '../../constants/brand';`.
- Change `const { insights, insightsLoading, askCoach } = useCoachAi();` to
  `const { insights, insightsLoading, insightsUpdatedAt, refreshInsights, askCoach } = useCoachAi();` and add `const { plan } = usePlan();`.
- In `send`, pass the flag through:

```ts
      .catch(err => dispatch({
        type: 'ADD_COACH_REPLY',
        text: err instanceof CoachLimitError ? err.message : "I couldn't reach your coach just now — try again in a moment.",
        upgrade: err instanceof CoachLimitError && err.upgrade,
      }))
```

- After the `(insights ?? []).map(…)` block, still inside the insights `<View>`:

```tsx
        {showInsightsUpsell(plan, insightsUpdatedAt, new Date()) && (
          <TouchableOpacity onPress={() => openPaywall('insights', () => refreshInsights())}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.ink3, textAlign: 'center', paddingVertical: 6 }}>
              New insights every day with Beyond →
            </Text>
          </TouchableOpacity>
        )}
```

- Inside the `state.coachMessages.map(msg => …)` callback, wrap the returned bubble in a fragment and add the button after it:

```tsx
              {state.coachMessages.map(msg => (
                <React.Fragment key={msg.id}>
                  <View style={{ /* existing bubble style, unchanged; remove key from here */ }}>
                    {/* existing Text, unchanged */}
                  </View>
                  {msg.upgrade && plan === 'free' && (
                    <TouchableOpacity
                      onPress={() => openPaywall('chat_limit')}
                      style={{ alignSelf: 'flex-start', backgroundColor: COLORS.ink1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}
                    >
                      <Text style={{ color: COLORS.paper, fontSize: 13, fontWeight: '600' }}>Get {PAID_PLAN_NAME}</Text>
                    </TouchableOpacity>
                  )}
                </React.Fragment>
              ))}
```

Keep the bubble's existing style object exactly as it is; only move `key` to the fragment. Make sure `TouchableOpacity` and `React` are imported in `coach.tsx` (add them to the existing imports if missing).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/coach-upsell.test.ts __tests__/store.test.ts`
Expected: PASS
Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → `18`

- [ ] **Step 5: Commit**

```bash
git add lib/coach-upsell.ts store/reducer.ts "app/(tabs)/coach.tsx" __tests__/coach-upsell.test.ts __tests__/store.test.ts
git commit -m "feat(billing): coach chat limit and stale insights open the paywall"
```

---

### Task 8: Vision image cap (U4)

**Files:**
- Modify: `store/vision.tsx` (merge of `generate-vision` results, context value)
- Modify: `components/vision/VisionBanner.tsx`
- Create: `lib/vision-limit.ts`
- Test: `__tests__/vision-limit.test.ts`, `__tests__/vision-banner.test.tsx`

**Interfaces:**
- Consumes: `usePlan()` (Task 4), `openPaywall` (Task 5)
- Produces:
  - `lib/vision-limit.ts`: `splitGenerationResults(rows: Array<VisionAsset & { error?: string }>): { assets: VisionAsset[]; limitedGoalIds: string[] }`, and `imageLimitCaption(plan: Plan): string`
  - `useVisionAssets()` gains `isImageLimited(goalId: string): boolean` and `retryGeneration(goalId: string, goalTitle: string, sphere: SphereId): void`

Today, when the server answers `error: 'image_limit'`, the store saves a `pending` row with no id, so the banner shimmers forever. This task shows the gradient with a caption instead.

- [ ] **Step 1: Write the failing tests**

`__tests__/vision-limit.test.ts`:

```ts
import { splitGenerationResults, imageLimitCaption } from '../lib/vision-limit';
import type { VisionAsset } from '../store/vision';

const ready: VisionAsset = {
  id: 'a1', goal_id: 'g1', stage: 3, storage_path: 'p', prompt_hash: 'h', seed: 1, status: 'ready',
  error_msg: null, generated_at: null, last_regen_at: null, regen_count: 0,
};

describe('splitGenerationResults', () => {
  it('separates image_limit results from real assets', () => {
    const limited = { ...ready, id: '', goal_id: 'g2', status: 'pending' as const, error: 'image_limit' };
    expect(splitGenerationResults([ready, limited])).toEqual({ assets: [ready], limitedGoalIds: ['g2'] });
  });
});

describe('imageLimitCaption', () => {
  it('invites Free users to Beyond', () =>
    expect(imageLimitCaption('free')).toBe('Vision images for every goal with Beyond'));
  it('tells Beyond users when it resets', () =>
    expect(imageLimitCaption('beyond')).toBe("This month's vision images are used up. More on the 1st."));
});
```

`__tests__/vision-banner.test.tsx`:

```tsx
jest.mock('../store/plan', () => ({ usePlan: jest.fn() }));
jest.mock('../lib/paywall', () => ({ openPaywall: jest.fn() }));
jest.mock('../store/vision', () => ({ useVisionAssets: jest.fn() }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VisionBanner } from '../components/vision/VisionBanner';
import { usePlan } from '../store/plan';
import { openPaywall } from '../lib/paywall';
import { useVisionAssets } from '../store/vision';

const retryGeneration = jest.fn();
const props = {
  goalId: 'g1', goalTitle: 'Learn Spanish', sphere: 'career' as const, caption: 'c',
  fallbackColors: ['#000', '#111'] as [string, string], onPress: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (useVisionAssets as jest.Mock).mockReturnValue({
    getAsset: () => undefined, getSignedUrl: () => undefined, requestGeneration: jest.fn(),
    isGenerating: () => false, isImageLimited: () => true, retryGeneration,
  });
});

it('shows the Beyond caption on Free and retries generation after purchase', () => {
  (usePlan as jest.Mock).mockReturnValue({ plan: 'free' });
  const { getByText } = render(<VisionBanner {...props} />);
  fireEvent.press(getByText('Vision images for every goal with Beyond'));
  expect(openPaywall).toHaveBeenCalledWith('vision_limit', expect.any(Function));
  (openPaywall as jest.Mock).mock.calls[0][1]();
  expect(retryGeneration).toHaveBeenCalledWith('g1', 'Learn Spanish', 'career');
});

it('does not request generation again while limited', () => {
  (usePlan as jest.Mock).mockReturnValue({ plan: 'beyond' });
  const requestGeneration = jest.fn();
  (useVisionAssets as jest.Mock).mockReturnValue({
    getAsset: () => undefined, getSignedUrl: () => undefined, requestGeneration,
    isGenerating: () => false, isImageLimited: () => true, retryGeneration,
  });
  const { getByText } = render(<VisionBanner {...props} />);
  expect(getByText("This month's vision images are used up. More on the 1st.")).toBeTruthy();
  expect(requestGeneration).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/vision-limit.test.ts __tests__/vision-banner.test.tsx`
Expected: FAIL ("Cannot find module '../lib/vision-limit'")

- [ ] **Step 3: Implement**

`lib/vision-limit.ts`:

```ts
import type { VisionAsset } from '../store/vision';
import type { Plan } from './plan-state';

/** generate-vision returns `error: 'image_limit'` rows for goals it refused to draw. */
export function splitGenerationResults(
  rows: Array<VisionAsset & { error?: string }>,
): { assets: VisionAsset[]; limitedGoalIds: string[] } {
  const assets: VisionAsset[] = [];
  const limitedGoalIds: string[] = [];
  for (const row of rows) {
    if (row.error === 'image_limit') limitedGoalIds.push(row.goal_id);
    else assets.push(row);
  }
  return { assets, limitedGoalIds };
}

export function imageLimitCaption(plan: Plan): string {
  return plan === 'free'
    ? 'Vision images for every goal with Beyond'
    : "This month's vision images are used up. More on the 1st.";
}
```

`store/vision.tsx`:
- Import `splitGenerationResults` from `'../lib/vision-limit'`.
- Add state: `const [limited, setLimited] = useState<Record<string, true>>({});` and clear it wherever `setAssets({})` runs on sign-out.
- In `requestGeneration`'s success branch, replace the "Merge returned assets into state" block with:

```ts
        const { assets: rows, limitedGoalIds } = splitGenerationResults(data as Array<VisionAsset & { error?: string }>);
        setAssets(prev => {
          const next = { ...prev };
          for (const row of rows) next[assetKey(row.goal_id, row.stage)] = row;
          // Refused for the image cap: drop the local placeholder so nothing shimmers.
          for (const id of limitedGoalIds) delete next[assetKey(id, FINAL_STAGE)];
          return next;
        });
        if (limitedGoalIds.length) {
          setLimited(prev => ({ ...prev, ...Object.fromEntries(limitedGoalIds.map(id => [id, true as const])) }));
        }
```

- Add `retryGeneration` after `requestGeneration`:

```ts
  const retryGeneration = useCallback((goalId: string, goalTitle: string, sphere: SphereId) => {
    setLimited(prev => { const next = { ...prev }; delete next[goalId]; return next; });
    requestGeneration(goalId, goalTitle, sphere);
  }, [requestGeneration]);
```

- Add to `VisionContextValue`: `isImageLimited: (goalId: string) => boolean;` and `retryGeneration: (goalId: string, goalTitle: string, sphere: SphereId) => void;`. Add to the `value` memo: `isImageLimited: (goalId) => !!limited[goalId], retryGeneration,` and add `limited, retryGeneration` to its dependency list.

`components/vision/VisionBanner.tsx`:
- Imports: `import { usePlan } from '../../store/plan';`, `import { openPaywall } from '../../lib/paywall';`, `import { imageLimitCaption } from '../../lib/vision-limit';`.
- Destructure `isImageLimited, retryGeneration` from `useVisionAssets()`, add `const { plan } = usePlan();` and `const limited = isImageLimited(goalId);`.
- Change the generation effect so it doesn't loop on a refused goal:

```ts
  useEffect(() => {
    if (!asset && !limited) requestGeneration(goalId, goalTitle, sphere);
  }, [goalId]); // eslint-disable-line react-hooks/exhaustive-deps
```

- Replace the caption block with:

```tsx
        {/* Caption, or the image-cap note (U4) */}
        <View style={s.captionWrap}>
          {limited ? (
            <TouchableOpacity
              disabled={plan !== 'free'}
              onPress={() => openPaywall('vision_limit', () => retryGeneration(goalId, goalTitle, sphere))}
            >
              <Text style={s.limitText}>{imageLimitCaption(plan)}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={s.caption} numberOfLines={2}>{caption}</Text>
          )}
        </View>
```

- Add the style:

```ts
  limitText: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(20,15,10,0.8)',
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/vision-limit.test.ts __tests__/vision-banner.test.tsx __tests__/vision-regen.test.ts`
Expected: PASS
Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → `18`

- [ ] **Step 5: Commit**

```bash
git add lib/vision-limit.ts store/vision.tsx components/vision/VisionBanner.tsx \
  __tests__/vision-limit.test.ts __tests__/vision-banner.test.tsx
git commit -m "feat(billing): show the image cap instead of an endless shimmer (U4)"
```

---

### Task 9: Profile plan section (U7)

**Files:**
- Modify: `app/profile.tsx` (new section before "Personal details", line ~214)
- Create: `components/PlanSection.tsx`
- Test: `__tests__/plan-section.test.tsx`

**Interfaces:**
- Consumes: `usePlan()` (Task 4), `openPaywall` (Task 5), `planTitle`, `planDetail`, `storeLabel` (Task 3)
- Produces: `<PlanSection />`

- [ ] **Step 1: Write the failing test**

`__tests__/plan-section.test.tsx`:

```tsx
jest.mock('../store/plan', () => ({ usePlan: jest.fn() }));
jest.mock('../lib/paywall', () => ({ openPaywall: jest.fn() }));

import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PlanSection } from '../components/PlanSection';
import { usePlan } from '../store/plan';
import { openPaywall } from '../lib/paywall';
import { FREE_STATE } from '../lib/plan-state';

beforeEach(() => jest.clearAllMocks());

it('offers Upgrade on Free', () => {
  (usePlan as jest.Mock).mockReturnValue({ ...FREE_STATE, restore: jest.fn() });
  const { getByText } = render(<PlanSection />);
  expect(getByText('Free plan')).toBeTruthy();
  fireEvent.press(getByText('Upgrade'));
  expect(openPaywall).toHaveBeenCalledWith('profile');
});

it('shows trial days left and opens the store management page', () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  (usePlan as jest.Mock).mockReturnValue({
    ...FREE_STATE, plan: 'beyond', isTrial: true, willRenew: true, store: 'APP_STORE',
    trialEndsAt: new Date(Date.now() + 3 * 86400000 - 60000).toISOString(),
    expiresAt: new Date(Date.now() + 3 * 86400000 - 60000).toISOString(),
    managementURL: 'https://apps.apple.com/account/subscriptions', restore: jest.fn(),
  });
  const { getByText } = render(<PlanSection />);
  expect(getByText('Beyond trial · 3 days left')).toBeTruthy();
  fireEvent.press(getByText('Manage subscription'));
  expect(open).toHaveBeenCalledWith('https://apps.apple.com/account/subscriptions');
});

it('tells the user where to manage when there is no management URL', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (usePlan as jest.Mock).mockReturnValue({
    ...FREE_STATE, plan: 'beyond', store: 'PLAY_STORE', expiresAt: '2999-01-01T00:00:00Z', willRenew: true, restore: jest.fn(),
  });
  const { getByText } = render(<PlanSection />);
  fireEvent.press(getByText('Manage subscription'));
  expect(alert).toHaveBeenCalledWith('Manage subscription', 'Manage or cancel your subscription in Google Play.');
});

it('restores purchases and reports when nothing is found', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const restore = jest.fn().mockResolvedValue('free');
  (usePlan as jest.Mock).mockReturnValue({ ...FREE_STATE, restore });
  const { getByText } = render(<PlanSection />);
  fireEvent.press(getByText('Restore purchases'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('No subscription found', expect.any(String)));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/plan-section.test.tsx`
Expected: FAIL ("Cannot find module '../components/PlanSection'")

- [ ] **Step 3: Implement**

`components/PlanSection.tsx`:

```tsx
import React from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/theme';
import { PAID_PLAN_NAME } from '../constants/brand';
import { Card, SectionLabel, F } from './ui';
import { usePlan } from '../store/plan';
import { openPaywall } from '../lib/paywall';
import { planDetail, planTitle, storeLabel } from '../lib/plan-state';

const rowStyle = (last: boolean) => ({
  flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
  paddingHorizontal: 14, paddingVertical: 14,
  borderBottomWidth: last ? 0 : 0.5, borderBottomColor: COLORS.ink7,
});

export function PlanSection() {
  const plan = usePlan();

  const onManage = () => {
    if (plan.managementURL) {
      Linking.openURL(plan.managementURL);
      return;
    }
    Alert.alert('Manage subscription', `Manage or cancel your subscription in ${storeLabel(plan.store) ?? 'the store you subscribed with'}.`);
  };

  const onRestore = async () => {
    try {
      const restored = await plan.restore();
      if (restored === 'beyond') Alert.alert('Restored', `${PAID_PLAN_NAME} is active on this account.`);
      else Alert.alert('No subscription found', `We couldn't find a ${PAID_PLAN_NAME} subscription for this account.`);
    } catch {
      Alert.alert('Restore failed', 'Please try again.');
    }
  };

  return (
    <>
      <SectionLabel>{PAID_PLAN_NAME}</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={4}>
          <View style={rowStyle(false)}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: COLORS.ink1, fontWeight: '500' }}>{planTitle(plan, new Date())}</Text>
              <Text style={{ fontSize: 12, color: COLORS.ink3, marginTop: 3, lineHeight: 17 }}>{planDetail(plan)}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={plan.plan === 'free' ? () => openPaywall('profile') : onManage}
            style={rowStyle(false)}
          >
            <Text style={{ fontSize: 14, color: COLORS.ink1 }}>{plan.plan === 'free' ? 'Upgrade' : 'Manage subscription'}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRestore} style={rowStyle(true)}>
            <Text style={{ fontSize: 14, color: COLORS.ink1 }}>Restore purchases</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>↺</Text>
          </TouchableOpacity>
        </Card>
      </View>
    </>
  );
}
```

`app/profile.tsx`: `import { PlanSection } from '../components/PlanSection';` and render `<PlanSection />` directly before `<SectionLabel>Personal details</SectionLabel>`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/plan-section.test.tsx`
Expected: PASS
Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → `18`

- [ ] **Step 5: Commit**

```bash
git add components/PlanSection.tsx app/profile.tsx __tests__/plan-section.test.tsx
git commit -m "feat(billing): Goalify Beyond section in Profile (U7)"
```

---

### Task 10: Trial lifecycle (U0 welcome offer, U6 reminder and trial-ended sheet)

**Files:**
- Create: `lib/trial.ts`
- Modify: `lib/notifications.ts` (reminder schedule/cancel)
- Create: `components/TrialWatcher.tsx`
- Create: `app/trial-ended.tsx`
- Modify: `app/_layout.tsx` (route, watcher, notification routing)
- Modify: `app/(welcome)/add-task.tsx` (U0)
- Modify: `lib/paywall.ts` (add `finishWelcome`)
- Test: `__tests__/trial.test.ts`, add cases to `__tests__/paywall-lib.test.ts`

**Interfaces:**
- Consumes: `usePlan()` (Task 4), `openPaywall` (Task 5), `PlanState`, `formatDate`, `Plan` (Task 3)
- Produces:
  - `lib/trial.ts`:
    - `type PlanSnapshot = { plan: Plan; isTrial: boolean }`
    - `trialJustEnded(prev: PlanSnapshot | null, current: PlanState, loaded: boolean): boolean`
    - `trialReminderAt(s: PlanState, now: Date): Date | null`
    - `trialReminderBody(priceString: string | null, trialEndsAt: string): string`
    - `loadSnapshot(userId: string): Promise<PlanSnapshot | null>`, `saveSnapshot(userId: string, s: PlanSnapshot): Promise<void>`
  - `lib/notifications.ts`: `scheduleTrialEndingReminder(at: Date, body: string): Promise<void>`, `cancelTrialEndingReminder(): Promise<void>`
  - `lib/paywall.ts`: `finishWelcome(showOffer: boolean): void`
  - Route `/trial-ended`; notification `data.screen === 'profile'` opens `/profile`

- [ ] **Step 1: Write the failing tests**

`__tests__/trial.test.ts`:

```ts
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import {
  trialJustEnded, trialReminderAt, trialReminderBody, loadSnapshot, saveSnapshot,
} from '../lib/trial';
import { FREE_STATE, type PlanState } from '../lib/plan-state';

const NOW = new Date('2026-10-01T12:00:00Z');
const trial: PlanState = {
  ...FREE_STATE, plan: 'beyond', isTrial: true, willRenew: true,
  trialEndsAt: '2026-10-08T12:00:00Z', expiresAt: '2026-10-08T12:00:00Z',
};

describe('trialJustEnded', () => {
  it('fires when the last seen state was a trial and the user is now Free', () => {
    expect(trialJustEnded({ plan: 'beyond', isTrial: true }, FREE_STATE, true)).toBe(true);
  });
  it('does not fire before the plan has loaded (cold start placeholder is Free)', () => {
    expect(trialJustEnded({ plan: 'beyond', isTrial: true }, FREE_STATE, false)).toBe(false);
  });
  it('does not fire when the trial converted to paid', () => {
    expect(trialJustEnded({ plan: 'beyond', isTrial: true }, { ...trial, isTrial: false }, true)).toBe(false);
  });
  it('does not fire for a paid subscription that lapsed', () => {
    expect(trialJustEnded({ plan: 'beyond', isTrial: false }, FREE_STATE, true)).toBe(false);
  });
});

describe('trial reminder', () => {
  it('is due two days before the trial ends', () => {
    expect(trialReminderAt(trial, NOW)?.toISOString()).toBe('2026-10-06T12:00:00.000Z');
  });
  it('is not scheduled once the user has cancelled the trial', () => {
    expect(trialReminderAt({ ...trial, willRenew: false }, NOW)).toBeNull();
  });
  it('is not scheduled when the reminder time has passed', () => {
    expect(trialReminderAt(trial, new Date('2026-10-07T00:00:00Z'))).toBeNull();
  });
  it('is not scheduled outside a trial', () => {
    expect(trialReminderAt(FREE_STATE, NOW)).toBeNull();
  });
  it('names the charge and the date', () => {
    expect(trialReminderBody('$3.99', '2026-10-08T12:00:00Z')).toBe(
      "Your free trial ends in 2 days. You'll be charged $3.99 on Oct 8, 2026 unless you cancel.");
    expect(trialReminderBody(null, '2026-10-08T12:00:00Z')).toBe(
      "Your free trial ends in 2 days. You'll be charged on Oct 8, 2026 unless you cancel.");
  });
});

describe('snapshot storage', () => {
  it('round-trips per user', async () => {
    await saveSnapshot('u1', { plan: 'beyond', isTrial: true });
    expect(await loadSnapshot('u1')).toEqual({ plan: 'beyond', isTrial: true });
    expect(await loadSnapshot('u2')).toBeNull();
  });
});
```

Add to `__tests__/paywall-lib.test.ts` (extend its `expo-router` mock to `router: { push: jest.fn(), replace: jest.fn() }` and import `finishWelcome`):

```ts
describe('finishWelcome', () => {
  it('goes to the tabs and offers the trial when eligible', () => {
    finishWelcome(true);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    expect(push).toHaveBeenCalledWith({ pathname: '/paywall', params: { source: 'welcome' } });
  });
  it('goes straight to the tabs otherwise', () => {
    finishWelcome(false);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/trial.test.ts __tests__/paywall-lib.test.ts`
Expected: FAIL ("Cannot find module '../lib/trial'", `finishWelcome` is not a function)

- [ ] **Step 3: Implement the logic**

`lib/trial.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDate, type Plan, type PlanState } from './plan-state';

export type PlanSnapshot = { plan: Plan; isTrial: boolean };

const DAY_MS = 24 * 60 * 60 * 1000;
const key = (userId: string) => `plan-snapshot:${userId}`;

/** U6: the last state we saw was a trial and the user is now Free (cancelled trial ended). */
export function trialJustEnded(prev: PlanSnapshot | null, current: PlanState, loaded: boolean): boolean {
  return loaded && !!prev?.isTrial && current.plan === 'free';
}

/** Day 5 of 7: two days before the first charge, only if the trial will convert. */
export function trialReminderAt(s: PlanState, now: Date): Date | null {
  if (!s.isTrial || !s.willRenew || !s.trialEndsAt) return null;
  const at = new Date(Date.parse(s.trialEndsAt) - 2 * DAY_MS);
  return at.getTime() > now.getTime() ? at : null;
}

export function trialReminderBody(priceString: string | null, trialEndsAt: string): string {
  const charge = priceString ? `charged ${priceString}` : 'charged';
  return `Your free trial ends in 2 days. You'll be ${charge} on ${formatDate(trialEndsAt)} unless you cancel.`;
}

export async function loadSnapshot(userId: string): Promise<PlanSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as PlanSnapshot) : null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(userId: string, s: PlanSnapshot): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify(s)).catch(() => {});
}
```

`lib/paywall.ts`, append:

```ts
/** End of the welcome flow (U0): land on Today, then offer the trial to eligible users. */
export function finishWelcome(showOffer: boolean): void {
  router.replace('/(tabs)');
  if (showOffer) router.push({ pathname: '/paywall', params: { source: 'welcome' } });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/trial.test.ts __tests__/paywall-lib.test.ts`
Expected: PASS

- [ ] **Step 5: Wire the reminder, the watcher, the sheet and U0**

`lib/notifications.ts`: add `trialEnding: 'trial-ending'` to `IDS`, and append:

```ts
export async function scheduleTrialEndingReminder(at: Date, body: string) {
  if (Platform.OS === 'web') return;
  await cancelNotification(IDS.trialEnding);
  await Notifications.scheduleNotificationAsync({
    identifier: IDS.trialEnding,
    content: { title: 'Your Goalify Beyond trial', body, data: { screen: 'profile' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

export async function cancelTrialEndingReminder() {
  await cancelNotification(IDS.trialEnding);
}
```

`components/TrialWatcher.tsx`:

```tsx
// Renders nothing. Keeps the day-5 trial reminder in step with the plan and
// opens the "trial ended" sheet once after a cancelled trial runs out.

import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../store/auth';
import { usePlan } from '../store/plan';
import { loadSnapshot, saveSnapshot, trialJustEnded, trialReminderAt, trialReminderBody } from '../lib/trial';
import { cancelTrialEndingReminder, scheduleTrialEndingReminder } from '../lib/notifications';

export function TrialWatcher() {
  const { user } = useAuth();
  const plan = usePlan();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !plan.loaded) return;
    let cancelled = false;
    (async () => {
      const prev = await loadSnapshot(userId);
      if (cancelled) return;
      if (trialJustEnded(prev, plan, plan.loaded)) router.push('/trial-ended');
      await saveSnapshot(userId, { plan: plan.plan, isTrial: plan.isTrial });

      const at = trialReminderAt(plan, new Date());
      if (at && plan.trialEndsAt) {
        const pkg = [plan.packages.monthly, plan.packages.annual].find(p => p?.productId === plan.productId);
        await scheduleTrialEndingReminder(at, trialReminderBody(pkg?.priceString ?? null, plan.trialEndsAt)).catch(() => {});
      } else {
        await cancelTrialEndingReminder().catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [userId, plan.loaded, plan.plan, plan.isTrial, plan.willRenew, plan.trialEndsAt, plan.productId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
```

`app/trial-ended.tsx`:

```tsx
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { F } from '../components/ui';
import { PAID_PLAN_NAME } from '../constants/brand';
import { openPaywall } from '../lib/paywall';

const CHANGES = [
  'Coach chat: 10 messages in total',
  'Personalized insights: 3 a month',
  'Vision images: 10 a month, no regenerating',
];

export default function TrialEndedScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }}>
      <Text style={s.kicker}>{PAID_PLAN_NAME}</Text>
      <Text style={s.headline}>Your trial has ended</Text>
      <Text style={s.body}>You're on the Free plan now. What changes:</Text>
      <View style={{ gap: 8, marginTop: 14 }}>
        {CHANGES.map(c => <Text key={c} style={s.item}>· {c}</Text>)}
      </View>
      <Text style={s.body}>Everything you created stays: goals, habits, journal, images and letters.</Text>

      <TouchableOpacity
        style={s.cta}
        onPress={() => { router.back(); openPaywall('trial_ended'); }}
      >
        <Text style={s.ctaText}>Resubscribe</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.secondary} onPress={() => router.back()}>
        <Text style={s.secondaryText}>Continue with Free</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper, paddingHorizontal: 24 },
  kicker: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: COLORS.accentWarm },
  headline: { fontFamily: F.display, fontSize: 32, color: COLORS.ink1, marginTop: 10 },
  body: { fontSize: 14, lineHeight: 21, color: COLORS.ink2, marginTop: 18 },
  item: { fontSize: 14, color: COLORS.ink2 },
  cta: { marginTop: 32, backgroundColor: COLORS.ink1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: COLORS.paper, fontSize: 15, fontWeight: '600' },
  secondary: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { fontSize: 14, color: COLORS.ink3 },
});
```

`app/_layout.tsx`:
- `import { TrialWatcher } from '../components/TrialWatcher';` and render `<TrialWatcher />` next to `<HabitReminderScheduler />`.
- Register `<Stack.Screen name="trial-ended" options={{ presentation: 'modal', gestureEnabled: true }} />` next to `paywall`.
- In `NotificationListener`, add `else if (screen === 'profile') router.push('/profile' as any);`.

`app/(welcome)/add-task.tsx` (U0): import `usePlan` from `'../../store/plan'` and `finishWelcome` from `'../../lib/paywall'`. In the component add
`const { loaded, isTrialEligible } = usePlan();` and replace **every** `router.replace('/(tabs)')` in the file (four call sites: lines ~38, 46, 53, 56) with `finishWelcome(loaded && isTrialEligible)`.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx jest`
Expected: all suites pass (integration suites stay skipped without their env vars)
Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → `18`

- [ ] **Step 7: Commit**

```bash
git add lib/trial.ts lib/notifications.ts lib/paywall.ts components/TrialWatcher.tsx app/trial-ended.tsx \
  app/_layout.tsx "app/(welcome)/add-task.tsx" __tests__/trial.test.ts __tests__/paywall-lib.test.ts
git commit -m "feat(billing): welcome trial offer, day-5 reminder, trial-ended sheet"
```

---

### Task 11: Billing setup runbook and final check

**Files:**
- Create: `docs/billing-setup.md`
- Modify: `docs/superpowers/specs/2026-09-23-paid-tiers-user-behaviour.md` (status labels only)

- [ ] **Step 1: Write `docs/billing-setup.md`**

```markdown
# Goalify Beyond: billing setup

Code is done; these steps happen in dashboards. Do them in order.

## 1. RevenueCat
1. Create project "Goalify". Add apps: iOS (`com.goalifylife.app`), Android (`com.goalifylife.app`), Web Billing (connect Stripe).
2. Entitlement: identifier **`beyond`**.
3. Products (once each store has them, step 2–4): `beyond_monthly`, `beyond_annual` → attach both to `beyond`.
4. Offering **`default`** (mark Current) with packages **`$rc_monthly`** → `beyond_monthly` and **`$rc_annual`** → `beyond_annual`, per app.
5. API keys → copy the three public SDK keys into `.env` / EAS secrets as `REVENUECAT_IOS_KEY`, `REVENUECAT_ANDROID_KEY`, `REVENUECAT_WEB_KEY`.
6. Secret API key (v1) → `supabase secrets set REVENUECAT_SECRET_API_KEY=sk_...`
7. Integrations → Webhooks: URL `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`, Authorization header `Bearer <long random string>`.
   Then `supabase secrets set REVENUECAT_WEBHOOK_AUTH="Bearer <same string>"`. Send a test event; expect 200.

## 2. App Store Connect
Subscription group "Goalify Beyond": `beyond_monthly` ($3.99, 1 month) and `beyond_annual` ($29.99, 1 year).
Each: Introductory Offer → Free, 1 week, new subscribers. Add the App Store Connect API key / In-App Purchase key in RevenueCat.

## 3. Google Play Console
Subscription `beyond_monthly` (base plan monthly, $3.99) and `beyond_annual` (base plan yearly, $29.99).
Each base plan: offer "free-trial", 7 days free, eligibility "New customer acquisition". Connect the Play service account in RevenueCat.

## 4. Stripe (RevenueCat Web Billing)
Create the two products in RevenueCat Web Billing with a 7-day trial. Before adding any link from the mobile apps to web checkout, check current App Store / Play rules for each storefront.

## 5. Deploy
- `supabase db push` (migration 0021)
- `supabase functions deploy revenuecat-webhook sync-subscription ai-coach generate-vision`
- New EAS development build (the SDK is native): `eas build --profile development`
- Publish a Terms of Use page at https://goalify.life/terms (the paywall links to it; Apple requires it).

## 6. Test with sandbox accounts
Free → paywall shows "Start 7-day free trial" → buy → regenerate continues → Profile shows "Beyond trial · 7 days left" →
cancel in the store → reminder cancelled → after sandbox expiry, reopen → "Your trial has ended" sheet → paywall shows "Subscribe".
```

- [ ] **Step 2: Update spec status labels**

In the spec, change the Status column for U0–U7, the paywall, `usePlan()`, `getPlan()`, and the regenerate button from PROPOSED/HIDDEN to **BUILT (pending store setup)**. Leave ambient audio as HIDDEN.

- [ ] **Step 3: Final verification**

Run: `npx jest` → all pass
Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → `18`
Run: `grep -rn "\bPro\b" app components lib store constants --include='*.ts' --include='*.tsx'` → no user-facing "Pro" strings

- [ ] **Step 4: Commit**

```bash
git add docs/billing-setup.md docs/superpowers/specs/2026-09-23-paid-tiers-user-behaviour.md
git commit -m "docs(billing): Goalify Beyond setup runbook"
```
