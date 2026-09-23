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

it('I1: an already-subscribed user is not offered a purchase; the continuation runs instead', async () => {
  const action = jest.fn();
  openWith(action);
  const p = plan({ plan: 'beyond' });
  (usePlan as jest.Mock).mockReturnValue(p);
  const { queryByText } = render(<PaywallScreen />);
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(queryByText('Start 7-day free trial')).toBeNull();
  expect(p.purchase).not.toHaveBeenCalled();
});

it('I1: waits for the plan to load before deciding the user is subscribed', () => {
  openWith(jest.fn());
  (usePlan as jest.Mock).mockReturnValue(plan({ plan: 'beyond', loaded: false }));
  render(<PaywallScreen />);
  expect(router.back).not.toHaveBeenCalled();
});

it('I1: a purchase that flips the plan to Beyond mid-flight closes the paywall once', async () => {
  const action = jest.fn();
  openWith(action);
  let finish!: (v: string) => void;
  const p = plan({ purchase: jest.fn(() => new Promise(r => { finish = r; })) });
  (usePlan as jest.Mock).mockReturnValue(p);
  const { getByText, rerender } = render(<PaywallScreen />);
  fireEvent.press(getByText('Start 7-day free trial'));
  // RevenueCat reports Beyond while the server sync is still running.
  (usePlan as jest.Mock).mockReturnValue({ ...p, plan: 'beyond' });
  rerender(<PaywallScreen />);
  expect(router.back).not.toHaveBeenCalled();
  finish('purchased');
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  expect(router.back).toHaveBeenCalledTimes(1);
});
