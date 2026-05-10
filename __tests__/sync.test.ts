// ── Mocks ─────────────────────────────────────────────────────────
// jest.mock calls are hoisted before imports, so factory functions must be
// self-contained (no references to outer variables defined after hoisting).

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
    auth: {
      onAuthStateChange: jest.fn((cb: Function) => {
        // mockAuthCallbacks is declared before jest.mock so it's in closure scope
        mockAuthCallbacks.push(cb);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    },
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    })),
  },
}));

jest.mock('../lib/bootstrap', () => ({
  bootstrapUserData: jest.fn().mockResolvedValue({ goals: [], habits: [], journal: [] }),
}));

jest.mock('../lib/offline-queue', () => ({
  enqueue: jest.fn().mockResolvedValue(undefined),
  drainQueue: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mocks) ──────────────────────────────────────────
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistentStore } from '../store/sync';
import type { AppAction } from '../store/index';

// Grab mock references via requireMock (safe — avoids hoisting issues)
function getMocks() {
  const asyncMock = jest.requireMock('@react-native-async-storage/async-storage');
  const { supabase } = jest.requireMock('../lib/supabase');
  const queueMock = jest.requireMock('../lib/offline-queue');
  return { asyncMock, supabase, queueMock };
}

describe('usePersistentStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthCallbacks.length = 0;

    const { asyncMock, supabase } = getMocks();
    asyncMock.getItem.mockResolvedValue(null);
    asyncMock.setItem.mockResolvedValue(undefined);

    // Re-configure onAuthStateChange to capture callbacks
    supabase.auth.onAuthStateChange.mockImplementation((cb: Function) => {
      mockAuthCallbacks.push(cb);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    supabase.from.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    });
  });

  it('returns initialState when no cache exists', () => {
    const { result } = renderHook(() => usePersistentStore());
    expect(result.current.state.goals).toEqual([]);
    expect(result.current.state.habits).toEqual([]);
  });

  it('hydrates from cache on mount', async () => {
    const { asyncMock } = getMocks();
    const cached = {
      goals: [{ id: 'g1', sphere: 'health', title: 'Run', due: '', progress: 0, sub: [] }],
      habits: [],
      journal: [],
      todayActions: [],
      snapshot_at: new Date().toISOString(),
    };
    asyncMock.getItem.mockResolvedValue(JSON.stringify(cached));

    const { result } = renderHook(() => usePersistentStore());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(result.current.state.goals).toHaveLength(1);
    expect(result.current.state.goals[0].title).toBe('Run');
  });

  it('writes cache after each dispatch when user is signed in', async () => {
    const { asyncMock } = getMocks();
    const { result } = renderHook(() => usePersistentStore());

    await act(async () => {
      for (const cb of mockAuthCallbacks) {
        await cb('SIGNED_IN', { user: { id: 'user-123' } });
      }
    });

    act(() => {
      result.current.dispatch({
        type: 'ADD_GOAL',
        goal: { id: 'g-new', sphere: 'health', title: 'Test Goal', due: '', progress: 0, sub: [] },
      } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(asyncMock.setItem).toHaveBeenCalledWith('@goalify/cache', expect.any(String));
  });

  it('enqueues item when Supabase upsert fails and user is signed in', async () => {
    const { supabase, queueMock } = getMocks();
    supabase.from.mockReturnValue({
      upsert: jest.fn().mockRejectedValue(new Error('network')),
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    });

    const { result } = renderHook(() => usePersistentStore());

    await act(async () => {
      for (const cb of mockAuthCallbacks) {
        await cb('SIGNED_IN', { user: { id: 'user-abc' } });
      }
    });

    act(() => {
      result.current.dispatch({
        type: 'ADD_HABIT',
        habit: { id: 'h1', label: 'Run', icon: '🏃', sphere: 'health', streak: 0, target: 'daily', doneToday: false },
      } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(queueMock.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'habits', operation: 'upsert' }),
    );
  });

  it('does not enqueue when user is signed out', async () => {
    const { queueMock } = getMocks();
    const { result } = renderHook(() => usePersistentStore());

    act(() => {
      result.current.dispatch({
        type: 'ADD_JOURNAL',
        entry: { id: 'j1', date: '2026-05-11', sphere: 'health', sentiment: 1, excerpt: 'Good day' },
      } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(queueMock.enqueue).not.toHaveBeenCalled();
  });

  it('maps TOGGLE_HABIT dispatch to habit_logs table upsert', async () => {
    const { supabase } = getMocks();
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    const fromCalls: string[] = [];

    supabase.from.mockImplementation((table: string) => {
      fromCalls.push(table);
      return {
        upsert: mockUpsert,
        select: jest.fn(() => ({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
          gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
        })),
      };
    });

    const { result } = renderHook(() => usePersistentStore());

    await act(async () => {
      for (const cb of mockAuthCallbacks) {
        await cb('SIGNED_IN', { user: { id: 'user-xyz' } });
      }
    });

    act(() => {
      result.current.dispatch({
        type: 'ADD_HABIT',
        habit: { id: 'h99', label: 'Walk', icon: '🚶', sphere: 'health', streak: 0, target: 'daily', doneToday: false },
      } as AppAction);
    });

    act(() => {
      result.current.dispatch({ type: 'TOGGLE_HABIT', id: 'h99' } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(fromCalls).toContain('habit_logs');
  });
});
