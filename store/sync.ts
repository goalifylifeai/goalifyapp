import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { bootstrapUserData } from '../lib/bootstrap';
import { enqueue, drainQueue, type QueueItem } from '../lib/offline-queue';
import { appReducer, initialState, type AppAction, type AppState } from './index';

const CACHE_KEY = '@goalify/cache';

type CacheSnapshot = {
  goals: AppState['goals'];
  habits: AppState['habits'];
  journal: AppState['journal'];
  todayActions: AppState['todayActions'];
  snapshot_at: string;
};

async function readCache(): Promise<Partial<AppState> | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as CacheSnapshot;
    return {
      goals: snap.goals ?? [],
      habits: snap.habits ?? [],
      journal: snap.journal ?? [],
      todayActions: snap.todayActions ?? [],
    };
  } catch {
    return null;
  }
}

async function writeCache(state: AppState): Promise<void> {
  try {
    const snap: CacheSnapshot = {
      goals: state.goals,
      habits: state.habits,
      journal: state.journal,
      todayActions: state.todayActions,
      snapshot_at: new Date().toISOString(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(snap));
  } catch {
    // cache write failure is non-fatal
  }
}

// Maps an AppAction to the Supabase upsert/delete call.
// Returns a QueueItem on failure so the caller can enqueue it.
async function syncAction(action: AppAction, state: AppState, userId: string): Promise<void> {
  switch (action.type) {
    case 'ADD_GOAL':
    case 'TOGGLE_SUBTASK':
    case 'ADD_SUBTASK': {
      if (action.type === 'ADD_GOAL') {
        const g = action.goal;
        await supabase.from('goals').upsert(
          { id: g.id, user_id: userId, sphere: g.sphere, title: g.title, due_date: g.due || null },
          { onConflict: 'id' },
        );
      } else {
        // Sync all subtasks for the affected goal
        const goalId = action.goalId;
        const goal = state.goals.find(g => g.id === goalId);
        if (!goal) return;
        const subtasks = goal.sub.map((s, i) => ({
          id: `${goalId}:${i}`,
          goal_id: goalId,
          user_id: userId,
          text: s.t,
          done: s.done,
          sort_order: i,
        }));
        for (const st of subtasks) {
          await supabase.from('goal_subtasks').upsert(st, { onConflict: 'id' });
        }
      }
      break;
    }

    case 'ADD_HABIT': {
      const h = action.habit;
      await supabase.from('habits').upsert(
        { id: h.id, user_id: userId, label: h.label, icon: h.icon, sphere: h.sphere, target_description: h.target },
        { onConflict: 'id' },
      );
      break;
    }

    case 'TOGGLE_HABIT': {
      const habit = state.habits.find(h => h.id === action.id);
      if (!habit) return;
      const today = new Date().toISOString().slice(0, 10);
      const logId = `${action.id}:${today}`;
      await supabase.from('habit_logs').upsert(
        { id: logId, habit_id: action.id, user_id: userId, date: today, done: habit.doneToday },
        { onConflict: 'habit_id,date' },
      );
      break;
    }

    case 'ADD_JOURNAL': {
      const e = action.entry;
      await supabase.from('journal_entries').upsert(
        { id: e.id, user_id: userId, date: e.date, sphere: e.sphere, sentiment: e.sentiment, excerpt: e.excerpt },
        { onConflict: 'id' },
      );
      break;
    }

    // Actions that don't touch persisted tables
    case 'TOGGLE_ACTION':
    case 'ADD_ACTION':
    case 'SEND_COACH_MESSAGE':
    case 'HYDRATE':
      break;
  }
}

function actionToQueueItem(action: AppAction, state: AppState, userId: string): QueueItem | null {
  switch (action.type) {
    case 'ADD_GOAL': {
      const g = action.goal;
      return {
        id: `goal:${g.id}`,
        table: 'goals',
        operation: 'upsert',
        payload: { id: g.id, user_id: userId, sphere: g.sphere, title: g.title, due_date: g.due || null },
        created_at: new Date().toISOString(),
        retries: 0,
      };
    }
    case 'TOGGLE_HABIT': {
      const habit = state.habits.find(h => h.id === action.id);
      if (!habit) return null;
      const today = new Date().toISOString().slice(0, 10);
      return {
        id: `habit_log:${action.id}:${today}`,
        table: 'habit_logs',
        operation: 'upsert',
        payload: { id: `${action.id}:${today}`, habit_id: action.id, user_id: userId, date: today, done: habit.doneToday },
        created_at: new Date().toISOString(),
        retries: 0,
      };
    }
    case 'ADD_HABIT': {
      const h = action.habit;
      return {
        id: `habit:${h.id}`,
        table: 'habits',
        operation: 'upsert',
        payload: { id: h.id, user_id: userId, label: h.label, icon: h.icon, sphere: h.sphere, target_description: h.target },
        created_at: new Date().toISOString(),
        retries: 0,
      };
    }
    case 'ADD_JOURNAL': {
      const e = action.entry;
      return {
        id: `journal:${e.id}`,
        table: 'journal_entries',
        operation: 'upsert',
        payload: { id: e.id, user_id: userId, date: e.date, sphere: e.sphere, sentiment: e.sentiment, excerpt: e.excerpt },
        created_at: new Date().toISOString(),
        retries: 0,
      };
    }
    default:
      return null;
  }
}

async function replayQueueItem(item: QueueItem): Promise<void> {
  if (item.operation === 'upsert') {
    const { error } = await supabase.from(item.table).upsert(item.payload, { onConflict: 'id' });
    if (error) throw error;
  } else {
    const { error } = await supabase.from(item.table).delete().eq('id', item.payload.id as string);
    if (error) throw error;
  }
}

export function usePersistentStore(): { state: AppState; dispatch: React.Dispatch<AppAction> } {
  const [state, rawDispatch] = useReducer(appReducer, initialState);
  const stateRef = useRef(state);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  });

  // Hydrate from cache immediately on mount, then bootstrap from Supabase
  useEffect(() => {
    let cancelled = false;

    const loadCache = async () => {
      const cached = await readCache();
      if (cached && !cancelled) {
        rawDispatch({ type: 'HYDRATE', state: cached });
      }
    };

    loadCache();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_IN' && session?.user) {
        userIdRef.current = session.user.id;
        try {
          const freshState = await bootstrapUserData();
          if (!cancelled) {
            rawDispatch({ type: 'HYDRATE', state: freshState });
            await writeCache({ ...stateRef.current, ...freshState });
          }
        } catch {
          // bootstrap failure is non-fatal — cached data remains
        }
      } else if (event === 'SIGNED_OUT') {
        userIdRef.current = null;
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Drain queue when connectivity is restored
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(netState => {
      if (netState.isConnected) {
        drainQueue(replayQueueItem).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  const dispatch = useCallback(
    (action: AppAction) => {
      rawDispatch(action);

      const userId = userIdRef.current;
      if (!userId) return;

      // Fire-and-forget: sync to Supabase, enqueue on failure
      const currentState = stateRef.current;
      const nextState = appReducer(currentState, action);

      writeCache(nextState).catch(() => {});

      syncAction(action, nextState, userId).catch(() => {
        const item = actionToQueueItem(action, nextState, userId);
        if (item) enqueue(item).catch(() => {});
      });
    },
    [],
  );

  return { state, dispatch };
}
