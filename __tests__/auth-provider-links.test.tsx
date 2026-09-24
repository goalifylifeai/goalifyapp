const mockLinking = { initialUrl: null as string | null, listeners: [] as Function[] };
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve(mockLinking.initialUrl)),
  addEventListener: jest.fn((_: string, cb: Function) => {
    mockLinking.listeners.push(cb);
    return { remove: jest.fn() };
  }),
}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-auth-session/providers/google', () => ({ useIdTokenAuthRequest: () => [null, null, jest.fn()] }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: {} } }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      setSession: jest.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../store/auth';

const { supabase } = jest.requireMock('../lib/supabase');

function probe() {
  const seen: { current: ReturnType<typeof useAuth> | null } = { current: null };
  function Probe() { seen.current = useAuth(); return null; }
  return { seen, Probe };
}

describe('AuthProvider auth-email links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLinking.initialUrl = null;
    mockLinking.listeners = [];
  });

  it('signs in from a reset link that launched the app and flags recovery', async () => {
    mockLinking.initialUrl = 'goalify://reset-password#access_token=a&refresh_token=r&type=recovery';
    const { seen, Probe } = probe();
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => {});
    expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
    expect(seen.current?.recovering).toBe(true);
    expect(seen.current?.linkError).toBeNull();
  });

  it('handles a confirm link opened while the app is running', async () => {
    const { seen, Probe } = probe();
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => {});
    await act(async () => { mockLinking.listeners[0]({ url: 'goalify://confirm#access_token=a2&refresh_token=r2' }); });
    expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'a2', refresh_token: 'r2' });
    expect(seen.current?.recovering).toBe(false);
  });

  it('reports an expired link and does not stay in recovery', async () => {
    mockLinking.initialUrl = 'goalify://reset-password#error=access_denied&error_code=otp_expired';
    const { seen, Probe } = probe();
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => {});
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
    expect(seen.current?.linkError).toBe('That link has expired or was already used.');
    expect(seen.current?.recovering).toBe(false);
  });
});
