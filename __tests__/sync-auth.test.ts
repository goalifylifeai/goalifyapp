// Auth-lifecycle behaviour of usePersistentStore: writes made before the
// session is known, pending writes on sign-in, and clearing on sign-out.

const mockAuthCallbacks: Function[] = [];

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { onAuthStateChange: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('../lib/bootstrap', () => ({
  bootstrapUserData: jest.fn(),
}));

jest.mock('../lib/offline-queue', () => ({
  enqueue: jest.fn().mockResolvedValue(undefined),
  drainQueue: jest.fn().mockResolvedValue(undefined),
  clearQueue: jest.fn().mockResolvedValue(undefined),
}));

import { renderHook, act } from '@testing-library/react-native';
import { usePersistentStore } from '../store/sync';
import type { AppAction, Goal } from '../store/index';

function getMocks() {
  const asyncMock = jest.requireMock('@react-native-async-storage/async-storage');
  const { supabase } = jest.requireMock('../lib/supabase');
  const queueMock = jest.requireMock('../lib/offline-queue');
  const bootstrapMock = jest.requireMock('../lib/bootstrap');
  return { asyncMock, supabase, queueMock, bootstrapMock };
}

const goal = (id: string, title = 'Run a 10k'): Goal => ({
  id, sphere: 'health', title, due: '', progress: 0, sub: [],
});

async function fireAuth(event: string, session: unknown) {
  await act(async () => {
    for (const cb of mockAuthCallbacks) await cb(event, session);
  });
}

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 50)); });

describe('usePersistentStore auth lifecycle', () => {
  let upsert: jest.Mock;
  let order: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthCallbacks.length = 0;
    const { asyncMock, supabase, bootstrapMock, queueMock } = getMocks();
    asyncMock.getItem.mockResolvedValue(null);
    queueMock.drainQueue.mockResolvedValue(undefined);
    bootstrapMock.bootstrapUserData.mockResolvedValue({ goals: [], habits: [], journal: [] });
    supabase.auth.onAuthStateChange.mockImplementation((cb: Function) => {
      mockAuthCallbacks.push(cb);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    upsert = jest.fn().mockResolvedValue({ error: null });
    order = jest.fn().mockResolvedValue({ data: [], error: null });
    supabase.from.mockReturnValue({
      upsert,
      delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
      select: jest.fn(() => ({ order })),
    });
  });

  it('syncs a goal added before the session is known once the session arrives', async () => {
    const { result } = renderHook(() => usePersistentStore());

    act(() => {
      result.current.dispatch({ type: 'ADD_GOAL', goal: goal('g-early') } as AppAction);
    });
    await flush();
    expect(upsert).not.toHaveBeenCalled();

    await fireAuth('INITIAL_SESSION', { user: { id: 'user-1' } });
    await flush();

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'g-early', user_id: 'user-1', title: 'Run a 10k' }),
      { onConflict: 'id' },
    );
  });

  it('does not attribute pre-session writes to a user after a sign-out', async () => {
    const { result } = renderHook(() => usePersistentStore());

    act(() => {
      result.current.dispatch({ type: 'ADD_GOAL', goal: goal('g-orphan') } as AppAction);
    });
    await fireAuth('SIGNED_OUT', null);
    await fireAuth('SIGNED_IN', { user: { id: 'user-2' } });
    await flush();

    expect(upsert).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'g-orphan' }), expect.anything());
  });

  it('replays the offline queue before loading from the server on sign-in', async () => {
    const { queueMock, bootstrapMock } = getMocks();
    const calls: string[] = [];
    queueMock.drainQueue.mockImplementation(async () => { calls.push('drain'); });
    bootstrapMock.bootstrapUserData.mockImplementation(async () => {
      calls.push('bootstrap');
      return { goals: [], habits: [], journal: [] };
    });

    renderHook(() => usePersistentStore());
    await fireAuth('SIGNED_IN', { user: { id: 'user-1' } });

    expect(calls.slice(0, 2)).toEqual(['drain', 'bootstrap']);
  });

  it('keeps the goals on screen when the server load fails', async () => {
    const { asyncMock, bootstrapMock } = getMocks();
    asyncMock.getItem.mockResolvedValue(JSON.stringify({
      goals: [goal('g-cached', 'Cached goal')], habits: [], journal: [], todayActions: [], snapshot_at: '',
    }));
    bootstrapMock.bootstrapUserData.mockRejectedValue(new Error('goals: permission denied'));

    const { result } = renderHook(() => usePersistentStore());
    await flush();
    await fireAuth('SIGNED_IN', { user: { id: 'user-1' } });
    await flush();

    expect(result.current.state.goals.map(g => g.id)).toEqual(['g-cached']);
  });

  it('clears state, cache and queue on sign-out so the next account starts clean', async () => {
    const { asyncMock, queueMock, bootstrapMock } = getMocks();
    bootstrapMock.bootstrapUserData.mockResolvedValue({ goals: [goal('g-a')], habits: [], journal: [] });

    const { result } = renderHook(() => usePersistentStore());
    await fireAuth('SIGNED_IN', { user: { id: 'user-a' } });
    expect(result.current.state.goals).toHaveLength(1);

    await fireAuth('SIGNED_OUT', null);
    await flush();

    expect(result.current.state.goals).toEqual([]);
    expect(asyncMock.removeItem).toHaveBeenCalledWith('@goalify/cache');
    expect(queueMock.clearQueue).toHaveBeenCalled();
  });
});
