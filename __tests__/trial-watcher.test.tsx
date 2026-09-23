jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../lib/notifications', () => ({
  scheduleTrialEndingReminder: jest.fn().mockResolvedValue(undefined),
  cancelTrialEndingReminder: jest.fn().mockResolvedValue(undefined),
}));
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

const mockMaybeSingle = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn().mockResolvedValue({ data: { ok: true }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
  },
}));

let mockUser: { id: string } | null = null;
jest.mock('../store/auth', () => ({ useAuth: () => ({ user: mockUser }) }));

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { PlanProvider } from '../store/plan';
import { TrialWatcher } from '../components/TrialWatcher';
import * as purchases from '../lib/purchases';
import { loadSnapshot } from '../lib/trial';
import { cancelTrialEndingReminder, scheduleTrialEndingReminder } from '../lib/notifications';

const P = purchases as jest.Mocked<typeof purchases>;
const tree = () => <PlanProvider><TrialWatcher /></PlanProvider>;
const trialRow = {
  has_entitlement: true, expires_at: '2999-01-08T00:00:00Z', grace_expires_at: null,
  period_type: 'trial', store: 'play_store', product_id: 'beyond_monthly', will_renew: true, had_trial: true,
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockUser = null;
  P.configurePurchases.mockResolvedValue(false);
});

it('C1: a trial user signing in never sees the trial-ended sheet or loses the trial snapshot', async () => {
  await AsyncStorage.setItem('plan-snapshot:u1', JSON.stringify({ plan: 'beyond', isTrial: true }));
  mockMaybeSingle.mockResolvedValue({ data: trialRow, error: null });
  let signIn!: () => void;
  function App() {
    const [, setTick] = React.useState(0);
    signIn = () => { mockUser = { id: 'u1' }; setTick(t => t + 1); };
    return tree();
  }
  render(<App />);
  await act(async () => {});

  // Sign in the way the app does: an update outside act(), so React schedules
  // the re-render for later and AsyncStorage can resolve first (as on web).
  const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  g.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    signIn();
    await new Promise(r => setTimeout(r, 50));
  } finally {
    g.IS_REACT_ACT_ENVIRONMENT = true;
  }
  await waitFor(() => expect(scheduleTrialEndingReminder).toHaveBeenCalled());
  expect(router.push).not.toHaveBeenCalled();
  expect(await loadSnapshot('u1')).toEqual({ plan: 'beyond', isTrial: true });
});

it('I2: an offline cold start neither shows the sheet nor overwrites the snapshot', async () => {
  await AsyncStorage.setItem('plan-snapshot:u1', JSON.stringify({ plan: 'beyond', isTrial: true }));
  mockUser = { id: 'u1' };
  mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'network' } });
  render(tree());
  await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
  await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  expect(router.push).not.toHaveBeenCalled();
  expect(cancelTrialEndingReminder).not.toHaveBeenCalled();
  expect(await loadSnapshot('u1')).toEqual({ plan: 'beyond', isTrial: true });
});

it('still shows the sheet when a confirmed Free follows a trial snapshot', async () => {
  await AsyncStorage.setItem('plan-snapshot:u1', JSON.stringify({ plan: 'beyond', isTrial: true }));
  mockUser = { id: 'u1' };
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  render(tree());
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/trial-ended'));
  await waitFor(async () => expect(await loadSnapshot('u1')).toEqual({ plan: 'free', isTrial: false }));
});

it('I5: names the Android price in the day-5 reminder (base plan id on the package)', async () => {
  P.configurePurchases.mockResolvedValue(true);
  P.fetchPlanState.mockResolvedValue({
    plan: 'beyond', isTrial: true, trialEndsAt: '2999-01-08T00:00:00Z', expiresAt: '2999-01-08T00:00:00Z',
    willRenew: true, store: 'PLAY_STORE', productId: 'beyond_monthly', managementURL: null,
  });
  P.fetchPackages.mockResolvedValue({
    monthly: { period: 'monthly', productId: 'beyond_monthly:monthly', priceString: '€3.99', price: 3.99, hasFreeTrial: true, raw: {} },
    annual: null,
  });
  mockUser = { id: 'u1' };
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  render(tree());
  await waitFor(() => expect(scheduleTrialEndingReminder).toHaveBeenCalled());
  expect((scheduleTrialEndingReminder as jest.Mock).mock.calls.at(-1)[1]).toContain('charged €3.99');
});
