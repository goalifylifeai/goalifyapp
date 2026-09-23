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
