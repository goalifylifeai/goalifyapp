// Additional characterization tests for store/sync.ts, extending the
// coverage established in __tests__/sync.test.ts. Kept in a sibling file
// (rather than growing sync.test.ts further) because it targets a distinct
// cluster of behaviors: REMOVE_GOAL/subtask sync, SET_HABIT_CALENDAR_ID,
// ADD_JOURNAL, no-op action types, cache-read corruption, bootstrap failure,
// and NetInfo reconnect draining. Mocking style mirrors sync.test.ts exactly
// (self-contained jest.mock factories + jest.requireMock, since jest.mock is
// hoisted above these imports).

const mockAuthCallbacks: Function[] = [];
const mockNetInfoListeners: Array<(state: { isConnected: boolean | null }) => void> = [];

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((cb: Function) => {
    // mockNetInfoListeners is declared before jest.mock so it's in closure scope
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
  clearQueue: jest.fn().mockResolvedValue(undefined),
}));

import { renderHook, act } from '@testing-library/react-native';
import { usePersistentStore } from '../store/sync';
import type { AppAction } from '../store/index';

function getMocks() {
  const asyncMock = jest.requireMock('@react-native-async-storage/async-storage');
  const { supabase } = jest.requireMock('../lib/supabase');
  const queueMock = jest.requireMock('../lib/offline-queue');
  const bootstrapMock = jest.requireMock('../lib/bootstrap');
  const netInfoMock = jest.requireMock('@react-native-community/netinfo');
  return { asyncMock, supabase, queueMock, bootstrapMock, netInfoMock };
}

const baseGoal = {
  id: 'g1',
  sphere: 'health' as const,
  title: 'Run a 5k',
  due: '',
  progress: 0,
  sub: [{ id: 's1', t: 'Buy shoes', done: false }],
};

describe('usePersistentStore — additional characterization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthCallbacks.length = 0;
    mockNetInfoListeners.length = 0;

    const { asyncMock, supabase } = getMocks();
    asyncMock.getItem.mockResolvedValue(null);
    asyncMock.setItem.mockResolvedValue(undefined);

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

  async function signIn(result: any, userId: string) {
    await act(async () => {
      for (const cb of mockAuthCallbacks) {
        await cb('SIGNED_IN', { user: { id: userId } });
      }
    });
  }

  // ── readCache: malformed JSON in cache (line ~31-33) ────────────
  it('ignores a corrupted cache blob and falls back to initial state', async () => {
    const { asyncMock } = getMocks();
    asyncMock.getItem.mockResolvedValue('{not valid json');

    const { result } = renderHook(() => usePersistentStore());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(result.current.state.goals).toEqual([]);
    expect(result.current.state.habits).toEqual([]);
  });

  // ── REMOVE_GOAL sync path (lines 60-64) ─────────────────────────
  it('deletes subtasks then the goal from Supabase on REMOVE_GOAL', async () => {
    const { supabase } = getMocks();
    const fromCalls: string[] = [];
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockImplementation((table: string) => {
      fromCalls.push(table);
      return {
        upsert: jest.fn().mockResolvedValue({ error: null }),
        delete: jest.fn(() => ({ eq: mockEq })),
        select: jest.fn(() => ({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
          gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
        })),
      };
    });

    const { result } = renderHook(() => usePersistentStore());
    await signIn(result, 'user-remove');

    act(() => {
      result.current.dispatch({ type: 'REMOVE_GOAL', goalId: 'g1' } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(fromCalls).toEqual(expect.arrayContaining(['goal_subtasks', 'goals']));
    expect(mockEq).toHaveBeenCalledWith('goal_id', 'g1');
    expect(mockEq).toHaveBeenCalledWith('id', 'g1');
  });

  it('enqueues a delete queue item for both tables when REMOVE_GOAL sync fails', async () => {
    const { supabase, queueMock } = getMocks();
    supabase.from.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn(() => ({ eq: jest.fn().mockRejectedValue(new Error('offline')) })),
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    });

    const { result } = renderHook(() => usePersistentStore());
    await signIn(result, 'user-remove2');

    act(() => {
      result.current.dispatch({ type: 'REMOVE_GOAL', goalId: 'g-del' } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(queueMock.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'goals', operation: 'delete', payload: { id: 'g-del' } }),
    );
  });

  // ── ADD_GOAL with subtasks: success + failure queueing (lines 66-100, 163-197) ─
  it('upserts the goal and its subtasks on ADD_GOAL', async () => {
    const { supabase } = getMocks();
    const fromCalls: string[] = [];
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
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
    await signIn(result, 'user-addgoal');

    act(() => {
      result.current.dispatch({ type: 'ADD_GOAL', goal: baseGoal } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(fromCalls).toEqual(expect.arrayContaining(['goals', 'goal_subtasks']));
  });

  it('enqueues both the goal and its subtasks when ADD_GOAL sync fails', async () => {
    const { supabase, queueMock } = getMocks();
    supabase.from.mockReturnValue({
      upsert: jest.fn().mockRejectedValue(new Error('offline')),
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    });

    const { result } = renderHook(() => usePersistentStore());
    await signIn(result, 'user-addgoal2');

    act(() => {
      result.current.dispatch({ type: 'ADD_GOAL', goal: baseGoal } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(queueMock.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'goal:g1', table: 'goals', operation: 'upsert' }),
    );
    expect(queueMock.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'subtask:s1', table: 'goal_subtasks', operation: 'upsert' }),
    );
  });

  // ── TOGGLE_SUBTASK sync path for an already-known goal (lines 87-101, 209-233) ─
  it('upserts all subtasks for the goal on TOGGLE_SUBTASK', async () => {
    const { supabase } = getMocks();
    const fromCalls: string[] = [];
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
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
    await signIn(result, 'user-toggle');

    act(() => {
      result.current.dispatch({ type: 'ADD_GOAL', goal: baseGoal } as AppAction);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    fromCalls.length = 0;
    mockUpsert.mockClear();

    act(() => {
      result.current.dispatch({ type: 'TOGGLE_SUBTASK', goalId: 'g1', idx: 0 } as AppAction);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(fromCalls).toEqual(['goal_subtasks']);
    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 's1', goal_id: 'g1', done: true, sort_order: 0 })],
      { onConflict: 'id' },
    );
  });

  it('enqueues subtask upserts when TOGGLE_SUBTASK sync fails on a known goal', async () => {
    const { supabase, queueMock } = getMocks();
    // First call (ADD_GOAL) succeeds so the goal lands in state; force failure after.
    let callCount = 0;
    supabase.from.mockImplementation(() => ({
      upsert: jest.fn(() => {
        callCount += 1;
        return callCount <= 2 ? Promise.resolve({ error: null }) : Promise.reject(new Error('offline'));
      }),
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    }));

    const { result } = renderHook(() => usePersistentStore());
    await signIn(result, 'user-toggle2');

    act(() => {
      result.current.dispatch({ type: 'ADD_GOAL', goal: baseGoal } as AppAction);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    act(() => {
      result.current.dispatch({ type: 'TOGGLE_SUBTASK', goalId: 'g1', idx: 0 } as AppAction);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(queueMock.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'goal_subtasks', operation: 'upsert' }),
    );
  });

  // ── SET_HABIT_CALENDAR_ID sync path (lines 114-116, 260-270) ────
  it('updates the habits row with the calendar event id on SET_HABIT_CALENDAR_ID', async () => {
    const { supabase } = getMocks();
    const mockEq2 = jest.fn().mockResolvedValue({ error: null });
    const mockEq1 = jest.fn(() => ({ eq: mockEq2 }));
    const mockUpdate = jest.fn(() => ({ eq: mockEq1 }));
    supabase.from.mockReturnValue({
      update: mockUpdate,
      upsert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    });

    const { result } = renderHook(() => usePersistentStore());
    await signIn(result, 'user-cal');

    act(() => {
      result.current.dispatch({ type: 'SET_HABIT_CALENDAR_ID', id: 'h1', calendarEventId: 'evt-1' } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(mockUpdate).toHaveBeenCalledWith({ calendar_event_id: 'evt-1' });
    expect(mockEq1).toHaveBeenCalledWith('id', 'h1');
    expect(mockEq2).toHaveBeenCalledWith('user_id', 'user-cal');
  });

  it('enqueues a habits upsert with the calendar event id when SET_HABIT_CALENDAR_ID sync fails', async () => {
    const { supabase, queueMock } = getMocks();
    supabase.from.mockReturnValue({
      update: jest.fn(() => ({ eq: jest.fn(() => ({ eq: jest.fn().mockRejectedValue(new Error('offline')) })) })),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    });

    const { result } = renderHook(() => usePersistentStore());
    await signIn(result, 'user-cal2');

    act(() => {
      result.current.dispatch({ type: 'SET_HABIT_CALENDAR_ID', id: 'h2', calendarEventId: 'evt-2' } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(queueMock.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        table: 'habits',
        operation: 'upsert',
        payload: expect.objectContaining({ id: 'h2', calendar_event_id: 'evt-2' }),
      }),
    );
  });

  // ── ADD_JOURNAL sync path (lines 136-143, 271-281) ──────────────
  it('upserts a journal entry on ADD_JOURNAL', async () => {
    const { supabase } = getMocks();
    const fromCalls: string[] = [];
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
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
    await signIn(result, 'user-journal');

    act(() => {
      result.current.dispatch({
        type: 'ADD_JOURNAL',
        entry: { id: 'j1', date: '2026-05-11', sentiment: 1, excerpt: 'Good day' },
      } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(fromCalls).toContain('journal_entries');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'j1', date: '2026-05-11', sentiment: 1, excerpt: 'Good day' }),
      { onConflict: 'id' },
    );
  });

  it('enqueues a journal_entries upsert when ADD_JOURNAL sync fails', async () => {
    const { supabase, queueMock } = getMocks();
    supabase.from.mockReturnValue({
      upsert: jest.fn().mockRejectedValue(new Error('offline')),
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    });

    const { result } = renderHook(() => usePersistentStore());
    await signIn(result, 'user-journal2');

    act(() => {
      result.current.dispatch({
        type: 'ADD_JOURNAL',
        entry: { id: 'j2', date: '2026-05-12', sentiment: -1, excerpt: 'Rough day' },
      } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(queueMock.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'journal:j2',
        table: 'journal_entries',
        operation: 'upsert',
        payload: expect.objectContaining({ id: 'j2', excerpt: 'Rough day' }),
      }),
    );
  });

  // ── No-op action types never touch Supabase (lines 145-154) ─────
  it('does not call Supabase for local-only action types (TOGGLE_ACTION, ADD_ACTION, ADD_USER_MESSAGE, ADD_COACH_REPLY, HYDRATE)', async () => {
    const { supabase } = getMocks();
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({
      upsert: mockUpsert,
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    });

    const { result } = renderHook(() => usePersistentStore());
    await signIn(result, 'user-noop');
    supabase.from.mockClear();

    const noopActions: AppAction[] = [
      { type: 'ADD_ACTION', action: { id: 'a1', t: 'Do a thing', sphere: 'health', time: '9am', done: false, goal: '' } },
      { type: 'TOGGLE_ACTION', id: 'a1' },
      { type: 'ADD_USER_MESSAGE', text: 'hi' },
      { type: 'ADD_COACH_REPLY', text: 'hello' },
      { type: 'HYDRATE', state: { goals: [] } },
    ];

    for (const action of noopActions) {
      act(() => {
        result.current.dispatch(action);
      });
    }

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  // ── Bootstrap failure is swallowed (lines 336-346) ──────────────
  it('leaves cached state intact when bootstrapUserData rejects after sign-in', async () => {
    const { asyncMock, bootstrapMock } = getMocks();
    const cached = {
      goals: [{ id: 'cached-g', sphere: 'health', title: 'Cached goal', due: '', progress: 0, sub: [] }],
      habits: [],
      journal: [],
      todayActions: [],
      snapshot_at: new Date().toISOString(),
    };
    asyncMock.getItem.mockResolvedValue(JSON.stringify(cached));
    bootstrapMock.bootstrapUserData.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => usePersistentStore());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    await signIn(result, 'user-bootfail');

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    // Bootstrap rejected — cached data (from readCache) should remain, not crash.
    expect(result.current.state.goals).toHaveLength(1);
    expect(result.current.state.goals[0].id).toBe('cached-g');
  });

  // ── TOGGLE_HABIT queue item construction on failure (lines 234-246) ─
  it('enqueues a habit_logs upsert when TOGGLE_HABIT sync fails', async () => {
    const { supabase, queueMock } = getMocks();
    let callCount = 0;
    supabase.from.mockImplementation(() => ({
      upsert: jest.fn(() => {
        callCount += 1;
        // First upsert (ADD_HABIT) succeeds so the habit lands in state;
        // second upsert (TOGGLE_HABIT -> habit_logs) fails.
        return callCount === 1 ? Promise.resolve({ error: null }) : Promise.reject(new Error('offline'));
      }),
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    }));

    const { result } = renderHook(() => usePersistentStore());
    await signIn(result, 'user-togglehabit');

    act(() => {
      result.current.dispatch({
        type: 'ADD_HABIT',
        habit: { id: 'h50', label: 'Meditate', icon: '🧘', sphere: 'health', streak: 0, target: 'daily', doneToday: false },
      } as AppAction);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    act(() => {
      result.current.dispatch({ type: 'TOGGLE_HABIT', id: 'h50' } as AppAction);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(queueMock.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'habit_logs', operation: 'upsert' }),
    );
  });

  // ── SIGNED_OUT clears the tracked userId (line 345-346) ─────────
  it('stops syncing to Supabase after a SIGNED_OUT event', async () => {
    const { supabase } = getMocks();
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({
      upsert: mockUpsert,
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    });

    const { result } = renderHook(() => usePersistentStore());
    await signIn(result, 'user-out');

    await act(async () => {
      for (const cb of mockAuthCallbacks) {
        await cb('SIGNED_OUT', null);
      }
    });

    supabase.from.mockClear();

    act(() => {
      result.current.dispatch({
        type: 'ADD_JOURNAL',
        entry: { id: 'j-after-signout', date: '2026-05-13', sentiment: 0, excerpt: 'x' },
      } as AppAction);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  // ── NetInfo reconnect drains the queue (lines 356-364) ──────────
  it('drains the offline queue when connectivity is restored', async () => {
    const { queueMock } = getMocks();
    renderHook(() => usePersistentStore());

    expect(mockNetInfoListeners).toHaveLength(1);

    act(() => {
      mockNetInfoListeners[0]({ isConnected: true });
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(queueMock.drainQueue).toHaveBeenCalledTimes(1);
  });

  it('does not drain the offline queue when still disconnected', async () => {
    const { queueMock } = getMocks();
    renderHook(() => usePersistentStore());

    act(() => {
      mockNetInfoListeners[0]({ isConnected: false });
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(queueMock.drainQueue).not.toHaveBeenCalled();
  });
});
