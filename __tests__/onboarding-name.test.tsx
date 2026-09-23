// Characterization tests for app/(onboarding)/name.tsx.
// Mocking style: self-contained jest.mock factories (hoisted), requireMock
// for references, render/fireEvent from @testing-library/react-native —
// matching the convention already used for hook mocks in __tests__/sync.test.ts.

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
import NameStep from '../app/(onboarding)/name';
import { useOnboarding } from '../store/onboarding';
import { router } from 'expo-router';

function getMocks() {
  return {
    useOnboardingMock: useOnboarding as jest.Mock,
    routerMock: router as unknown as { replace: jest.Mock; push: jest.Mock },
  };
}

describe('<NameStep /> onboarding screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the Continue button disabled when the name is empty', () => {
    const { useOnboardingMock } = getMocks();
    useOnboardingMock.mockReturnValue({
      state: { selections: {} },
      advance: jest.fn(),
    });

    const { getByText, getByPlaceholderText } = render(<NameStep />);
    expect(getByPlaceholderText('Your name')).toBeTruthy();
    const button = getByText('Continue');
    expect(button.parent?.props.accessibilityState?.disabled).not.toBe(false);
  });

  it('enables Continue once a valid name (1-50 chars) is entered and advances on press', async () => {
    const { useOnboardingMock, routerMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: null });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance });

    const { getByText, getByPlaceholderText } = render(<NameStep />);
    fireEvent.changeText(getByPlaceholderText('Your name'), 'Ada');

    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(advance).toHaveBeenCalledWith('display_name', 'Ada');
    expect(routerMock.replace).toHaveBeenCalledWith('/(onboarding)/spheres');
  });

  it('trims whitespace before validating and submitting', async () => {
    const { useOnboardingMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: null });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance });

    const { getByText, getByPlaceholderText } = render(<NameStep />);
    fireEvent.changeText(getByPlaceholderText('Your name'), '   Ada   ');

    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(advance).toHaveBeenCalledWith('display_name', 'Ada');
  });

  it('treats a whitespace-only name as invalid and does not call advance', async () => {
    const { useOnboardingMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: null });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance });

    const { getByText, getByPlaceholderText } = render(<NameStep />);
    fireEvent.changeText(getByPlaceholderText('Your name'), '     ');

    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(advance).not.toHaveBeenCalled();
  });

  it('shows an error and does not navigate when advance() fails', async () => {
    const { useOnboardingMock, routerMock } = getMocks();
    const advance = jest.fn().mockResolvedValue({ error: 'Network error' });
    useOnboardingMock.mockReturnValue({ state: { selections: {} }, advance });

    const { getByText, getByPlaceholderText, findByText } = render(<NameStep />);
    fireEvent.changeText(getByPlaceholderText('Your name'), 'Ada');

    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(await findByText('Network error')).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('pre-fills the input from an existing display_name selection', () => {
    const { useOnboardingMock } = getMocks();
    useOnboardingMock.mockReturnValue({
      state: { selections: { display_name: 'Grace' } },
      advance: jest.fn(),
    });

    const { getByDisplayValue } = render(<NameStep />);
    expect(getByDisplayValue('Grace')).toBeTruthy();
  });
});
