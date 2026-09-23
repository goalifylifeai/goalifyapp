import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { AppState } from 'react-native';
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
  /** RevenueCat (if available) and the server row have both been tried for the current user. */
  loaded: boolean;
  /**
   * At least one source (RevenueCat customer info or the server row) answered
   * for the current user. False after an offline cold start, when the plan is
   * only the Free placeholder. Signed out counts as confirmed (Free is certain).
   */
  confirmed: boolean;
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

// The RevenueCat SDK is a singleton: run logOut / logIn strictly in order so a
// fast sign-out then sign-in can't log the new user out.
let purchasesQueue: Promise<unknown> = Promise.resolve();
function inPurchasesQueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = purchasesQueue.then(fn, fn);
  purchasesQueue = next.catch(() => {});
  return next;
}

/** `undefined` = nothing settled yet; `null` = settled for the signed-out state. */
type Owner = string | null | undefined;

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [rcState, setRcState] = useState<PlanState | null>(null);
  const [serverRow, setServerRow] = useState<ServerSubscription | null>(null);
  // Which user `loaded` / `confirmed` were computed for, so a render right after
  // sign-in never sees the signed-out state's loaded=true.
  const [loadedFor, setLoadedFor] = useState<Owner>(undefined);
  const [confirmedFor, setConfirmedFor] = useState<Owner>(undefined);
  const [available, setAvailable] = useState(false);
  const [packages, setPackages] = useState<Packages>(NO_PACKAGES);
  const [storeEligibility, setStoreEligibility] = useState<StoreEligibility>('unknown');
  // Re-read on refresh so an expired server row stops counting as Beyond.
  const [now, setNow] = useState(() => Date.now());
  const loaded = loadedFor === userId;
  const confirmed = loaded && confirmedFor === userId;

  /** The user's subscription row; `ok` is false when the query itself failed. */
  const fetchServerRow = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('has_entitlement, expires_at, grace_expires_at, period_type, store, product_id, will_renew, had_trial')
      .eq('user_id', id)
      .maybeSingle();
    if (error) return { ok: false as const };
    return { ok: true as const, row: (data as ServerSubscription | null) ?? null };
  }, []);

  /** Ask the server to re-read RevenueCat now, then reload our row. True if the row loaded. */
  const syncServer = useCallback(async () => {
    if (!userId) return false;
    await supabase.functions.invoke('sync-subscription').catch(() => {});
    const r = await fetchServerRow(userId).catch(() => null);
    if (!r?.ok) return false;
    setServerRow(r.row);
    setConfirmedFor(userId);
    return true;
  }, [userId, fetchServerRow]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setRcState(null);
    setServerRow(null);
    setPackages(NO_PACKAGES);
    if (!userId) {
      inPurchasesQueue(logOutPurchases);
      setAvailable(false);
      setConfirmedFor(null);
      setLoadedFor(null);
      return;
    }
    const confirm = () => { if (!cancelled) setConfirmedFor(userId); };
    (async () => {
      const ok = await inPurchasesQueue(() => configurePurchases(userId));
      if (cancelled) return;
      setAvailable(ok);
      const work: Promise<unknown>[] = [fetchServerRow(userId).then(r => {
        if (cancelled || !r.ok) return;
        setServerRow(r.row);
        confirm();
      })];
      if (ok) {
        unsubscribe = onPlanStateChange(s => { if (!cancelled) { setRcState(s); confirm(); } });
        work.push(fetchPlanState().then(s => { if (!cancelled) { setRcState(s); confirm(); } }));
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
      if (!cancelled) setLoadedFor(userId);
    })();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [userId, fetchServerRow]);

  const state = useMemo(
    () => resolvePlanState(rcState, planStateFromServer(serverRow, new Date(now))),
    [rcState, serverRow, now],
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
    setNow(Date.now());
    if (available) {
      const s = await fetchPlanState().catch(() => null);
      if (s) { setRcState(s); if (userId) setConfirmedFor(userId); }
    }
    await syncServer();
  }, [available, userId, syncServer]);

  // Coming back to the app: pick up renewals, cancellations and expiry.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active' && loadedRef.current) refreshRef.current().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<PlanContextValue>(() => ({
    ...state,
    loaded, confirmed, available, packages,
    isTrialEligible: trialEligibleFor(packages.monthly ?? packages.annual),
    trialEligibleFor, purchase, restore, refresh,
  }), [state, loaded, confirmed, available, packages, trialEligibleFor, purchase, restore, refresh]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be called inside <PlanProvider>');
  return ctx;
}
