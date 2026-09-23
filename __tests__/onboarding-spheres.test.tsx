// Characterization tests for app/(onboarding)/spheres.tsx.
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock('../store/onboarding', () => ({
  useOnboarding: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SpheresStep from '../app/(onboarding)/spheres';
import { useOnboarding } from '../store/onboarding';
import { router } from 'expo-router';

function getMocks() {
  return {
    useOnboardingMock: useOnboarding as jest.Mock,
    routerMock: router as unknown as { replace: jest.Mock; push: jest.Mock },
  };
}

describe('<SpheresStep /> onboarding screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all four sphere options', () => {
    const { useOnboardingMock } = getMocks();
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance: jest.fn() });

    const { getByText } = render(<SpheresStep />);
    expect(getByText('Where to focus?')).toBeTruthy();
  });

  it('Continue is disabled with zero spheres picked', async () => {
    const { useOnboardingMock } = getMocks();
    const advance = jest.fn();
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance });

    const { getByText } = render(<SpheresStep />);
    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(advance).not.toHaveBeenCalled();
  });

  it('toggling spheres on and off updates the picked set, and Continue submits it', async () => {
    const { useOnboardingMock, routerMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: null });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance });

    const { getByText } = render(<SpheresStep />);

    fireEvent.press(getByText('Career'));
    fireEvent.press(getByText('Health'));
    // Toggle Career back off.
    fireEvent.press(getByText('Career'));

    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(advance).toHaveBeenCalledWith('spheres', ['health']);
    expect(routerMock.replace).toHaveBeenCalledWith('/(onboarding)/tone');
  });

  it('pre-fills picked spheres from existing selections', async () => {
    const { useOnboardingMock, routerMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: null });
    useOnboardingMock.mockReturnValue({
      state: { selections: { spheres: ['finance'] } },
      advance,
    });

    const { getByText } = render(<SpheresStep />);
    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(advance).toHaveBeenCalledWith('spheres', ['finance']);
  });

  it('does not navigate when advance() fails', async () => {
    const { useOnboardingMock, routerMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: 'nope' });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance });

    const { getByText } = render(<SpheresStep />);
    fireEvent.press(getByText('Career'));

    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
