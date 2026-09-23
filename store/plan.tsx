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
