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

jest.mock('../lib/analytics', () => ({
  ...jest.requireActual('../lib/analytics'),
  trackAll: jest.fn(),
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

  it('tracks a pre-session dispatch once and syncs it once after INITIAL_SESSION', async () => {
    const { trackAll } = jest.requireMock('../lib/analytics');
    const { result } = renderHook(() => usePersistentStore());

    act(() => {
      result.current.dispatch({ type: 'ADD_GOAL', goal: goal('g-early') } as AppAction);
    });
    await flush();

    // Tracked at dispatch time, before any session exists.
    expect(trackAll).toHaveBeenCalledTimes(1);
    expect(trackAll).toHaveBeenCalledWith([
      { name: 'goal_created', props: { sphere: 'health', has_due_date: false, subtask_count: 0 } },
    ]);
    expect(upsert).not.toHaveBeenCalled();

    await fireAuth('INITIAL_SESSION', { user: { id: 'user-1' } });
    await flush();

    // Flushing the buffered write syncs it but does not track it again.
    expect(trackAll).toHaveBeenCalledTimes(1);
    const goalUpserts = upsert.mock.calls.filter(([row]) => row?.id === 'g-early');
    expect(goalUpserts).toHaveLength(1);
    expect(goalUpserts[0][0]).toEqual(expect.objectContaining({ user_id: 'user-1', completed_at: null }));
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

  it('clears state and cache on sign-out but keeps queued offline writes', async () => {
    // Supabase has already dropped the session when SIGNED_OUT fires, so a
    // replay here would be rejected by RLS; the queue must survive for the
    // owner's next sign-in.
    const { asyncMock, queueMock, bootstrapMock } = getMocks();
    bootstrapMock.bootstrapUserData.mockResolvedValue({ goals: [goal('g-a')], habits: [], journal: [] });

    const { result } = renderHook(() => usePersistentStore());
    await fireAuth('SIGNED_IN', { user: { id: 'user-a' } });
    expect(result.current.state.goals).toHaveLength(1);
    queueMock.drainQueue.mockClear();

    await fireAuth('SIGNED_OUT', null);
    await flush();

    expect(result.current.state.goals).toEqual([]);
    expect(asyncMock.removeItem).toHaveBeenCalledWith('@goalify/cache');
    expect(queueMock.clearQueue).not.toHaveBeenCalled();
    expect(queueMock.drainQueue).not.toHaveBeenCalled();
  });

  it('replays only the signed-in account\'s queued writes', async () => {
    const { queueMock } = getMocks();
    renderHook(() => usePersistentStore());
    await fireAuth('SIGNED_IN', { user: { id: 'user-1' } });
    expect(queueMock.drainQueue).toHaveBeenCalledWith(expect.any(Function), 'user-1');
  });

  it('does not replay the queue on reconnect while signed out', async () => {
    const netInfo = jest.requireMock('@react-native-community/netinfo');
    const { queueMock } = getMocks();
    renderHook(() => usePersistentStore());
    const listener = netInfo.addEventListener.mock.calls.at(-1)[0];

    listener({ isConnected: true });
    expect(queueMock.drainQueue).not.toHaveBeenCalled();

    await fireAuth('SIGNED_IN', { user: { id: 'user-1' } });
    queueMock.drainQueue.mockClear();
    listener({ isConnected: true });
    expect(queueMock.drainQueue).toHaveBeenCalledWith(expect.any(Function), 'user-1');
  });

  it('tags queued writes with the account that made them', async () => {
    const { queueMock } = getMocks();
    upsert.mockResolvedValue({ error: { message: 'offline' } });
    const { result } = renderHook(() => usePersistentStore());
    await fireAuth('SIGNED_IN', { user: { id: 'user-1' } });

    act(() => {
      result.current.dispatch({ type: 'ADD_GOAL', goal: goal('g-off') } as AppAction);
    });
    await flush();

    expect(queueMock.enqueue).toHaveBeenCalledWith(expect.objectContaining({ table: 'goals', owner: 'user-1' }));
  });

  it('replays older queued writes before this session\'s pending writes', async () => {
    // Otherwise a stale offline rename (or an upsert of a since-deleted goal)
    // would land on top of the newer write.
    const { queueMock, bootstrapMock } = getMocks();
    const calls: string[] = [];
    queueMock.drainQueue.mockImplementation(async () => { calls.push('drain'); });
    upsert.mockImplementation(async () => { calls.push('upsert'); return { error: null }; });
    bootstrapMock.bootstrapUserData.mockImplementation(async () => {
      calls.push('bootstrap');
      return { goals: [], habits: [], journal: [] };
    });

    const { result } = renderHook(() => usePersistentStore());
    act(() => {
      result.current.dispatch({ type: 'ADD_GOAL', goal: goal('g-new') } as AppAction);
    });
    await fireAuth('INITIAL_SESSION', { user: { id: 'user-1' } });
    await flush();

    // drain, then this session's upserts (goal + subtasks), then bootstrap.
    expect(calls[0]).toBe('drain');
    expect(calls).toContain('upsert');
    expect(calls[calls.length - 1]).toBe('bootstrap');
  });

  it('waits for pre-session writes to land before loading from the server', async () => {
    const { bootstrapMock } = getMocks();
    const calls: string[] = [];
    upsert.mockImplementation(() => new Promise(r => setTimeout(() => { calls.push('upsert'); r({ error: null }); }, 20)));
    bootstrapMock.bootstrapUserData.mockImplementation(async () => {
      calls.push('bootstrap');
      return { goals: [], habits: [], journal: [] };
    });

    const { result } = renderHook(() => usePersistentStore());
    act(() => {
      result.current.dispatch({ type: 'ADD_GOAL', goal: goal('g-early') } as AppAction);
    });
    await fireAuth('INITIAL_SESSION', { user: { id: 'user-1' } });
    await flush();

    expect(calls.indexOf('upsert')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('upsert')).toBeLessThan(calls.indexOf('bootstrap'));
  });
});
