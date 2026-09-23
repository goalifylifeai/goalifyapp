jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import TrialEndedScreen from '../app/trial-ended';

beforeEach(() => jest.clearAllMocks());

it('renders the trial-ended copy', () => {
  const { getByText } = render(<TrialEndedScreen />);
  expect(getByText('Your trial has ended')).toBeTruthy();
});

it('replaces the sheet with the paywall on Resubscribe', () => {
  const { getByText } = render(<TrialEndedScreen />);
  fireEvent.press(getByText('Resubscribe'));
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/paywall', params: { source: 'trial_ended' } });
  expect(router.back).not.toHaveBeenCalled();
});

it('goes back on Continue with Free', () => {
  const { getByText } = render(<TrialEndedScreen />);
  fireEvent.press(getByText('Continue with Free'));
  expect(router.back).toHaveBeenCalled();
});
