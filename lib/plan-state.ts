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
