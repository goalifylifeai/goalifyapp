// Characterization tests for app/(onboarding)/pronouns.tsx.
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
import PronounsStep from '../app/(onboarding)/pronouns';
import { useOnboarding } from '../store/onboarding';
import { router } from 'expo-router';

function getMocks() {
  return {
    useOnboardingMock: useOnboarding as jest.Mock,
    routerMock: router as unknown as { replace: jest.Mock; push: jest.Mock },
  };
}

describe('<PronounsStep /> onboarding screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the suggestion chips', () => {
    const { useOnboardingMock } = getMocks();
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance: jest.fn(), complete: jest.fn() });

    const { getByText } = render(<PronounsStep />);
    expect(getByText('she/her')).toBeTruthy();
    expect(getByText('he/him')).toBeTruthy();
    expect(getByText('they/them')).toBeTruthy();
  });

  it('tapping a suggestion chip fills the text input', () => {
    const { useOnboardingMock } = getMocks();
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance: jest.fn(), complete: jest.fn() });

    const { getByText, getByDisplayValue } = render(<PronounsStep />);
    fireEvent.press(getByText('they/them'));
    expect(getByDisplayValue('they/them')).toBeTruthy();
  });

  it('Finish calls advance with the trimmed pronouns and navigates to future-letter', async () => {
    const { useOnboardingMock, routerMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: null });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance, complete: jest.fn() });

    const { getByText, getByPlaceholderText } = render(<PronounsStep />);
    fireEvent.changeText(getByPlaceholderText('she/her'), '  ze/zir  ');

    await act(async () => {
      fireEvent.press(getByText('Finish'));
    });

    expect(advance).toHaveBeenCalledWith('pronouns', 'ze/zir');
    expect(routerMock.replace).toHaveBeenCalledWith('/(onboarding)/future-letter');
  });

  it('Skip calls advance with undefined and still navigates forward', async () => {
    const { useOnboardingMock, routerMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: null });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance, complete: jest.fn() });

    const { getByText, getByPlaceholderText } = render(<PronounsStep />);
    fireEvent.changeText(getByPlaceholderText('she/her'), 'he/him');

    await act(async () => {
      fireEvent.press(getByText('Skip'));
    });

    expect(advance).toHaveBeenCalledWith('pronouns', undefined);
    expect(routerMock.replace).toHaveBeenCalledWith('/(onboarding)/future-letter');
  });

  it('shows an error and does not navigate when advance() fails', async () => {
    const { useOnboardingMock, routerMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: 'Could not save' });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance, complete: jest.fn() });

    const { getByText, findByText } = render(<PronounsStep />);

    await act(async () => {
      fireEvent.press(getByText('Finish'));
    });

    expect(await findByText('Could not save')).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
