jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../store/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SignIn from '../app/(auth)/sign-in';
import { useAuth } from '../store/auth';

const useAuthMock = useAuth as jest.Mock;

function fill(utils: ReturnType<typeof render>) {
  fireEvent.changeText(utils.getByTestId('email-input'), '  me@example.com ');
  fireEvent.changeText(utils.getByTestId('password-input'), 'hunter22');
}

describe('<SignIn />', () => {
  beforeEach(() => jest.clearAllMocks());

  it('signs in when Enter is pressed in the password field', async () => {
    const signIn = jest.fn().mockResolvedValue({ error: null });
    useAuthMock.mockReturnValue({ signIn });
    const utils = render(<SignIn />);
    fill(utils);
    await act(async () => { fireEvent(utils.getByTestId('password-input'), 'submitEditing'); });
    expect(signIn).toHaveBeenCalledWith('me@example.com', 'hunter22');
  });

  it('locks the fields while the request is in flight', async () => {
    let resolve!: (v: { error: null }) => void;
    const signIn = jest.fn(() => new Promise(r => { resolve = r; }));
    useAuthMock.mockReturnValue({ signIn });
    const utils = render(<SignIn />);
    fill(utils);
    await act(async () => { fireEvent.press(utils.getByTestId('sign-in-button')); });
    expect(utils.getByTestId('email-input').props.editable).toBe(false);
    expect(utils.getByTestId('password-input').props.editable).toBe(false);
    expect(utils.getByText('Signing in…')).toBeTruthy();
    await act(async () => { resolve({ error: null }); });
    expect(utils.getByTestId('email-input').props.editable).toBe(true);
  });

  it('recovers the button and shows an error if sign-in throws', async () => {
    useAuthMock.mockReturnValue({ signIn: jest.fn().mockRejectedValue(new Error('Failed to fetch')) });
    const utils = render(<SignIn />);
    fill(utils);
    await act(async () => { fireEvent.press(utils.getByTestId('sign-in-button')); });
    expect(utils.getByText('Sign in')).toBeTruthy();
    expect(utils.getByText('No connection. Check your network and try again.')).toBeTruthy();
  });

  it('does not submit a whitespace-only email', async () => {
    const signIn = jest.fn();
    useAuthMock.mockReturnValue({ signIn });
    const utils = render(<SignIn />);
    fireEvent.changeText(utils.getByTestId('email-input'), '   ');
    fireEvent.changeText(utils.getByTestId('password-input'), 'hunter22');
    await act(async () => { fireEvent(utils.getByTestId('password-input'), 'submitEditing'); });
    expect(signIn).not.toHaveBeenCalled();
  });
});
