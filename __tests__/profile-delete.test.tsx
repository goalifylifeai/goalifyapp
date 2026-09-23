// Deleting the account also removes this device's queued offline writes,
// which can hold full journal text.

jest.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    auth: { signOut: jest.fn().mockResolvedValue({ error: null }) },
    from: jest.fn(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) })) })),
    })),
  },
}));
jest.mock('../store/auth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../lib/offline-queue', () => ({ clearQueue: jest.fn().mockResolvedValue(undefined) }));

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ProfileProvider, useProfile } from '../store/profile';

const mocks = () => ({
  supabase: jest.requireMock('../lib/supabase').supabase,
  queue: jest.requireMock('../lib/offline-queue'),
});

const wrapper = ({ children }: { children: React.ReactNode }) => <ProfileProvider>{children}</ProfileProvider>;

describe('deleteAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears the offline queue before signing out', async () => {
    const { supabase, queue } = mocks();
    const order: string[] = [];
    supabase.functions.invoke.mockResolvedValue({ error: null });
    queue.clearQueue.mockImplementation(async () => { order.push('clearQueue'); });
    supabase.auth.signOut.mockImplementation(async () => { order.push('signOut'); return { error: null }; });

    const { result } = renderHook(() => useProfile(), { wrapper });
    await act(async () => { await result.current.deleteAccount(); });

    expect(order).toEqual(['clearQueue', 'signOut']);
  });

  it('keeps the queue when the delete fails', async () => {
    const { supabase, queue } = mocks();
    supabase.functions.invoke.mockResolvedValue({ error: { message: 'boom' } });

    const { result } = renderHook(() => useProfile(), { wrapper });
    let res: { error: string | null } = { error: null };
    await act(async () => { res = await result.current.deleteAccount(); });

    expect(res.error).toBe('boom');
    expect(queue.clearQueue).not.toHaveBeenCalled();
  });
});
