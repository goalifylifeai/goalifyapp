// Covers store/sync.ts's replayQueueItem (the function passed to drainQueue
// on NetInfo reconnect) end to end. Unlike sync.test.ts / sync-more.test.ts,
// this file does NOT mock '../lib/offline-queue' — it uses the real
// drainQueue/getQueue/saveQueue implementation (backed by a mocked
// AsyncStorage) so that replayQueueItem's upsert/delete/error branches are
// actually exercised, not just asserted-on via a queueMock.

const mockAuthCallbacks: Function[] = [];
const mockNetInfoListeners: Array<(state: { isConnected: boolean | null }) => void> = [];

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((cb: Function) => {
    mockNetInfoListeners.push(cb as any);
    return jest.fn();
  }),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn((cb: Function) => {
        mockAuthCallbacks.push(cb);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    },
    from: jest.fn(),
  },
}));

jest.mock('../lib/bootstrap', () => ({
  bootstrapUserData: jest.fn().mockResolvedValue({ goals: [], habits: [], journal: [] }),
}));

// Real AsyncStorage is a native module — back it with an in-memory mock so
// the real lib/offline-queue.ts (also unmocked) has somewhere to read/write.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    __reset: () => { store = {}; },
    __getStore: () => store,
  };
});

import { renderHook, act } from '@testing-library/react-native';
import { usePersistentStore } from '../store/sync';

function getMocks() {
  const asyncMock = jest.requireMock('@react-native-async-storage/async-storage');
  const { supabase } = jest.requireMock('../lib/supabase');
  return { asyncMock, supabase };
}

const QUEUE_KEY = '@goalify/sync_queue';

// The queue only replays for a signed-in user. Sign in before seeding the
// queue so the sign-in drain sees it empty and each test exercises one
// reconnect replay.
async function signIn(userId = 'user-1') {
  await act(async () => {
    for (const cb of mockAuthCallbacks) await cb('SIGNED_IN', { user: { id: userId } });
  });
}

describe('usePersistentStore — replayQueueItem via real offline-queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetInfoListeners.length = 0;
    mockAuthCallbacks.length = 0;
    const { asyncMock } = getMocks();
    asyncMock.__reset();
  });

  it('replays a queued upsert successfully and removes it from the queue', async () => {
    renderHook(() => usePersistentStore());
    await signIn();
    const { asyncMock, supabase } = getMocks();
    await asyncMock.setItem(QUEUE_KEY, JSON.stringify([
      { id: 'goal:g1', table: 'goals', operation: 'upsert', payload: { id: 'g1', title: 'x' }, created_at: new Date().toISOString(), retries: 0 },
    ]));

    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ upsert: mockUpsert });

    act(() => {
      mockNetInfoListeners[0]({ isConnected: true });
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(mockUpsert).toHaveBeenCalledWith({ id: 'g1', title: 'x' }, { onConflict: 'id' });
    const remaining = JSON.parse(asyncMock.__getStore()[QUEUE_KEY]);
    expect(remaining).toEqual([]);
  });

  it('replays a queued delete successfully', async () => {
    renderHook(() => usePersistentStore());
    await signIn();
    const { asyncMock, supabase } = getMocks();
    await asyncMock.setItem(QUEUE_KEY, JSON.stringify([
      { id: 'goal_del:g2', table: 'goals', operation: 'delete', payload: { id: 'g2' }, created_at: new Date().toISOString(), retries: 0 },
    ]));

    const mockEq = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ delete: jest.fn(() => ({ eq: mockEq })) });

    act(() => {
      mockNetInfoListeners[0]({ isConnected: true });
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(mockEq).toHaveBeenCalledWith('id', 'g2');
    const remaining = JSON.parse(asyncMock.__getStore()[QUEUE_KEY]);
    expect(remaining).toEqual([]);
  });

  it('keeps a queued item (with incremented retries) when the upsert still errors', async () => {
    renderHook(() => usePersistentStore());
    await signIn();
    const { asyncMock, supabase } = getMocks();
    await asyncMock.setItem(QUEUE_KEY, JSON.stringify([
      { id: 'goal:g3', table: 'goals', operation: 'upsert', payload: { id: 'g3' }, created_at: new Date().toISOString(), retries: 0 },
    ]));

    supabase.from.mockReturnValue({ upsert: jest.fn().mockResolvedValue({ error: new Error('still down') }) });

    act(() => {
      mockNetInfoListeners[0]({ isConnected: true });
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    const remaining = JSON.parse(asyncMock.__getStore()[QUEUE_KEY]);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].retries).toBe(1);
  });

  it('keeps a queued item when the delete errors', async () => {
    renderHook(() => usePersistentStore());
    await signIn();
    const { asyncMock, supabase } = getMocks();
    await asyncMock.setItem(QUEUE_KEY, JSON.stringify([
      { id: 'goal_del:g4', table: 'goals', operation: 'delete', payload: { id: 'g4' }, created_at: new Date().toISOString(), retries: 0 },
    ]));

    supabase.from.mockReturnValue({ delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: new Error('still down') }) })) });

    act(() => {
      mockNetInfoListeners[0]({ isConnected: true });
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    const remaining = JSON.parse(asyncMock.__getStore()[QUEUE_KEY]);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].retries).toBe(1);
  });
});
