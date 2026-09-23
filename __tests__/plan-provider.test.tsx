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

let mockUser: { id: string } | null = { id: 'u1' };
jest.mock('../store/auth', () => ({ useAuth: () => ({ user: mockUser }) }));

import React from 'react';
import { AppState } from 'react-native';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { PlanProvider, usePlan } from '../store/plan';
import * as purchases from '../lib/purchases';
import { FREE_STATE } from '../lib/plan-state';

const P = purchases as jest.Mocked<typeof purchases>;
const wrapper = ({ children }: { children: React.ReactNode }) => <PlanProvider>{children}</PlanProvider>;
const monthly = { period: 'monthly' as const, productId: 'beyond_monthly', priceString: '$3.99', price: 3.99, hasFreeTrial: true, raw: {} };

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1' };
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
});

it('is immediately loaded and free when signed out', async () => {
  mockUser = null;
  const { result } = renderHook(() => usePlan(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.plan).toBe('free');
  expect(result.current.available).toBe(false);
  expect(P.configurePurchases).not.toHaveBeenCalled();
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

it('C1: is not loaded on the first render after a user signs in', async () => {
  mockUser = null;
  P.configurePurchases.mockResolvedValue(false);
  const seen: Array<{ user: string | null; loaded: boolean }> = [];
  const { result, rerender } = renderHook(() => {
    const p = usePlan();
    seen.push({ user: mockUser?.id ?? null, loaded: p.loaded });
    return p;
  }, { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));

  mockUser = { id: 'u1' };
  seen.length = 0;
  rerender({});
  expect(seen[0]).toEqual({ user: 'u1', loaded: false });
  await waitFor(() => expect(result.current.loaded).toBe(true));
});

it('I2: is loaded but not confirmed when every source fails (offline)', async () => {
  P.configurePurchases.mockResolvedValue(true);
  P.fetchPlanState.mockRejectedValue(new Error('offline'));
  P.fetchPackages.mockRejectedValue(new Error('offline'));
  mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'network' } });
  const { result } = renderHook(() => usePlan(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.confirmed).toBe(false);
});

it('I2: is confirmed when the server row loads even if RevenueCat fails', async () => {
  P.configurePurchases.mockResolvedValue(true);
  P.fetchPlanState.mockRejectedValue(new Error('offline'));
  P.fetchPackages.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => usePlan(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.confirmed).toBe(true);
});

it('I2: is confirmed when RevenueCat answers even if the server row fails', async () => {
  P.configurePurchases.mockResolvedValue(true);
  P.fetchPlanState.mockResolvedValue(FREE_STATE);
  P.fetchPackages.mockResolvedValue({ monthly, annual: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'network' } });
  const { result } = renderHook(() => usePlan(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.confirmed).toBe(true);
});

it('M1: configures RevenueCat for the next user only after a pending log-out finishes', async () => {
  let finishLogOut!: () => void;
  P.logOutPurchases.mockReturnValueOnce(new Promise<void>(r => { finishLogOut = r; }));
  P.configurePurchases.mockResolvedValue(false);
  mockUser = null;
  const { result, rerender } = renderHook(() => usePlan(), { wrapper });
  await waitFor(() => expect(P.logOutPurchases).toHaveBeenCalled());

  mockUser = { id: 'u2' };
  rerender({});
  await act(async () => { await Promise.resolve(); });
  expect(P.configurePurchases).not.toHaveBeenCalled();

  await act(async () => { finishLogOut(); });
  await waitFor(() => expect(P.configurePurchases).toHaveBeenCalledWith('u2'));
  await waitFor(() => expect(result.current.loaded).toBe(true));
});

it('M2: refreshes when the app returns to the foreground and re-reads server expiry', async () => {
  const listeners: Array<(s: string) => void> = [];
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
    listeners.push(cb);
    return { remove: () => {} };
  }) as never);
  P.configurePurchases.mockResolvedValue(false);
  const soon = new Date(Date.now() + 60_000).toISOString();
  mockMaybeSingle.mockResolvedValue({ data: {
    has_entitlement: true, expires_at: soon, grace_expires_at: null,
    period_type: 'normal', store: 'stripe', product_id: 'beyond_monthly', will_renew: false, had_trial: true,
  }, error: null });
  const { result } = renderHook(() => usePlan(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.plan).toBe('beyond');

  // An hour later the app comes back; the same (now expired) row must read as Free.
  const later = Date.now() + 60 * 60_000;
  const now = jest.spyOn(Date, 'now').mockReturnValue(later);
  try {
    await act(async () => { listeners.forEach(l => l('active')); });
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('sync-subscription'));
    await waitFor(() => expect(result.current.plan).toBe('free'));
  } finally {
    now.mockRestore();
    spy.mockRestore();
  }
});
