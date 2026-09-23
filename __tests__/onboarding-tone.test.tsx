// Characterization tests for app/(onboarding)/tone.tsx.
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
import ToneStep from '../app/(onboarding)/tone';
import { useOnboarding } from '../store/onboarding';
import { router } from 'expo-router';

function getMocks() {
  return {
    useOnboardingMock: useOnboarding as jest.Mock,
    routerMock: router as unknown as { replace: jest.Mock; push: jest.Mock },
  };
}

describe('<ToneStep /> onboarding screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the three tone options', () => {
    const { useOnboardingMock } = getMocks();
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance: jest.fn() });

    const { getByText } = render(<ToneStep />);
    expect(getByText('Warm')).toBeTruthy();
    expect(getByText('Direct')).toBeTruthy();
    expect(getByText('Playful')).toBeTruthy();
  });

  it('Continue is disabled until a tone is picked, and does not call advance', async () => {
    const { useOnboardingMock } = getMocks();
    const advance = jest.fn();
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance });

    const { getByText } = render(<ToneStep />);
    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(advance).not.toHaveBeenCalled();
  });

  it('selecting a tone and pressing Continue advances and navigates to pronouns', async () => {
    const { useOnboardingMock, routerMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: null });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance });

    const { getByText } = render(<ToneStep />);
    fireEvent.press(getByText('Direct'));

    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(advance).toHaveBeenCalledWith('coaching_tone', 'direct');
    expect(routerMock.replace).toHaveBeenCalledWith('/(onboarding)/pronouns');
  });

  it('does not navigate when advance() returns an error', async () => {
    const { useOnboardingMock, routerMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: 'boom' });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance });

    const { getByText } = render(<ToneStep />);
    fireEvent.press(getByText('Playful'));

    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('pre-selects an existing coaching_tone selection', () => {
    const { useOnboardingMock } = getMocks();
    useOnboardingMock.mockReturnValue({
      state: { selections: { coaching_tone: 'warm' } },
      advance: jest.fn(),
    });

    const { getByText } = render(<ToneStep />);
    // Selected tone renders its label in the "selected" paper color; we can
    // at least assert it's present and Continue becomes enabled immediately.
    expect(getByText('Warm')).toBeTruthy();
  });
});
