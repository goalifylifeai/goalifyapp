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
