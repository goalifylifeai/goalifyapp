// Characterization tests for app/(onboarding)/future-letter.tsx.
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock('../store/onboarding', () => ({
  useOnboarding: jest.fn(),
}));

jest.mock('../store/future-self', () => ({
  useFutureSelf: jest.fn(),
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
import FutureLetterStep from '../app/(onboarding)/future-letter';
import { useOnboarding } from '../store/onboarding';
import { useFutureSelf } from '../store/future-self';
import { router } from 'expo-router';

function getMocks() {
  return {
    useOnboardingMock: useOnboarding as jest.Mock,
    useFutureSelfMock: useFutureSelf as jest.Mock,
    routerMock: router as unknown as { replace: jest.Mock; push: jest.Mock },
  };
}

describe('<FutureLetterStep /> onboarding screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the horizon options and defaults to "Continue" label when empty', () => {
    const { useOnboardingMock, useFutureSelfMock } = getMocks();
    useOnboardingMock.mockReturnValue({ complete: jest.fn() });
    useFutureSelfMock.mockReturnValue({ saveLetter: jest.fn() });

    const { getByText } = render(<FutureLetterStep />);
    expect(getByText('1 month')).toBeTruthy();
    expect(getByText('3 months')).toBeTruthy();
    expect(getByText('6 months')).toBeTruthy();
    expect(getByText('1 year')).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });

  it('changes button label to "Save & continue" once the letter body is non-empty', () => {
    const { useOnboardingMock, useFutureSelfMock } = getMocks();
    useOnboardingMock.mockReturnValue({ complete: jest.fn() });
    useFutureSelfMock.mockReturnValue({ saveLetter: jest.fn() });

    const { getByText, getByPlaceholderText } = render(<FutureLetterStep />);
    fireEvent.changeText(getByPlaceholderText('Dear future me…'), 'Dear future me, ...');

    expect(getByText('Save & continue')).toBeTruthy();
  });

  it('skips saveLetter and calls complete when body is empty, navigating to add-goal', async () => {
    const { useOnboardingMock, useFutureSelfMock, routerMock } = getMocks();
    const complete = jest.fn().mockResolvedValue({ error: null });
    const saveLetter = jest.fn();
    useOnboardingMock.mockReturnValue({ complete });
    useFutureSelfMock.mockReturnValue({ saveLetter });

    const { getByText } = render(<FutureLetterStep />);

    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(saveLetter).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith({});
    expect(routerMock.replace).toHaveBeenCalledWith('/(welcome)/add-goal');
  });

  it('saves the letter with the chosen horizon before completing when body is non-empty', async () => {
    const { useOnboardingMock, useFutureSelfMock, routerMock } = getMocks();
    const complete = jest.fn().mockResolvedValue({ error: null });
    const saveLetter = jest.fn().mockResolvedValue({ error: null });
    useOnboardingMock.mockReturnValue({ complete });
    useFutureSelfMock.mockReturnValue({ saveLetter });

    const { getByText, getByPlaceholderText } = render(<FutureLetterStep />);
    fireEvent.press(getByText('3 months'));
    fireEvent.changeText(getByPlaceholderText('Dear future me…'), '  Dear future me...  ');

    await act(async () => {
      fireEvent.press(getByText('Save & continue'));
    });

    expect(saveLetter).toHaveBeenCalledWith({ horizon: '3m', body: 'Dear future me...' });
    expect(complete).toHaveBeenCalledWith({});
    expect(routerMock.replace).toHaveBeenCalledWith('/(welcome)/add-goal');
  });

  it('"Skip for now" bypasses saveLetter even when body has text', async () => {
    const { useOnboardingMock, useFutureSelfMock, routerMock } = getMocks();
    const complete = jest.fn().mockResolvedValue({ error: null });
    const saveLetter = jest.fn().mockResolvedValue({ error: null });
    useOnboardingMock.mockReturnValue({ complete });
    useFutureSelfMock.mockReturnValue({ saveLetter });

    const { getByText, getByPlaceholderText } = render(<FutureLetterStep />);
    fireEvent.changeText(getByPlaceholderText('Dear future me…'), 'some content');

    await act(async () => {
      fireEvent.press(getByText('Skip for now'));
    });

    expect(saveLetter).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith({});
    expect(routerMock.replace).toHaveBeenCalledWith('/(welcome)/add-goal');
  });

  it('shows an error and does not navigate when saveLetter fails', async () => {
    const { useOnboardingMock, useFutureSelfMock, routerMock } = getMocks();
    const complete = jest.fn();
    const saveLetter = jest.fn().mockResolvedValue({ error: 'save failed' });
    useOnboardingMock.mockReturnValue({ complete });
    useFutureSelfMock.mockReturnValue({ saveLetter });

    const { getByText, getByPlaceholderText, findByText } = render(<FutureLetterStep />);
    fireEvent.changeText(getByPlaceholderText('Dear future me…'), 'content');

    await act(async () => {
      fireEvent.press(getByText('Save & continue'));
    });

    expect(await findByText('save failed')).toBeTruthy();
    expect(complete).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('shows an error and does not navigate when complete() fails', async () => {
    const { useOnboardingMock, useFutureSelfMock, routerMock } = getMocks();
    const complete = jest.fn().mockResolvedValue({ error: 'complete failed' });
    useOnboardingMock.mockReturnValue({ complete });
    useFutureSelfMock.mockReturnValue({ saveLetter: jest.fn() });

    const { getByText, findByText } = render(<FutureLetterStep />);

    await act(async () => {
      fireEvent.press(getByText('Continue'));
    });

    expect(await findByText('complete failed')).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
