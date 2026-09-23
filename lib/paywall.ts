// One paywall for every upgrade moment. Callers pass the moment (`source`)
// and, optionally, what to do once the user is on Beyond; the paywall screen
// runs it after a successful purchase or restore.

import { router } from 'expo-router';
import { PAID_PLAN_PITCH, VISION_PITCH, WELCOME_OFFER } from '../constants/brand';
import { formatDate, type PaywallSource } from './plan-state';
import type { PaywallPackage } from './purchases';
import { track } from './analytics';

const pending = new Map<string, () => void>();
let seq = 0;

export function openPaywall(source: PaywallSource, onUnlocked?: () => void): void {
  track('upgrade_cta_tapped', { source });
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

/** End of the welcome flow (U0): land on Today, then offer the trial to eligible users. */
export function finishWelcome(showOffer: boolean): void {
  track('welcome_completed', { trial_offer_shown: showOffer });
  router.replace('/(tabs)');
  if (showOffer) router.push({ pathname: '/paywall', params: { source: 'welcome' } });
}
