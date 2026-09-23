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
