import React, { createContext, useContext, type ReactNode } from 'react';
import { usePersistentStore } from './sync';
import type { SphereId } from '../constants/theme';

// ── Domain types ──────────────────────────────────────────────────
export type TodayAction = {
  id: string; t: string; sphere: SphereId; time: string; done: boolean; goal: string;
};

export type Subtask = { id: string; t: string; done: boolean };

export type Goal = {
  id: string; sphere: SphereId; title: string; due: string; progress: number; sub: Subtask[];
};

export type HabitItem = {
  id: string; label: string; icon: string; sphere: SphereId; streak: number; target: string; doneToday: boolean;
  history?: string[]; // YYYY-MM-DD dates when completed
  calendarEventId?: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function calcStreak(history: string[]): number {
  if (history.length === 0) return 0;
  const set = new Set(history);
  let streak = 0;
  const cur = new Date();
  if (!set.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
  while (set.has(cur.toISOString().slice(0, 10))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export type JournalEntry = {
  id: string; date: string; sphere: SphereId; sentiment: number; excerpt: string;
};

export type ChatMessage = {
  id: string; role: 'user' | 'coach'; text: string;
};

export type AppState = {
  todayActions: TodayAction[];
  goals: Goal[];
  habits: HabitItem[];
  journal: JournalEntry[];
  coachMessages: ChatMessage[];
};

// ── Actions ───────────────────────────────────────────────────────
export type AppAction =
  | { type: 'TOGGLE_ACTION'; id: string }
  | { type: 'ADD_ACTION'; action: TodayAction }
  | { type: 'TOGGLE_SUBTASK'; goalId: string; idx: number }
  | { type: 'ADD_GOAL'; goal: Goal }
  | { type: 'UPDATE_GOAL'; goalId: string; patch: Partial<Goal> }
  | { type: 'REMOVE_GOAL'; goalId: string }
  | { type: 'ADD_SUBTASK'; goalId: string; subtask: Subtask }
  | { type: 'TOGGLE_HABIT'; id: string }
  | { type: 'ADD_HABIT'; habit: HabitItem }
  | { type: 'SET_HABIT_CALENDAR_ID'; id: string; calendarEventId: string }
  | { type: 'ADD_JOURNAL'; entry: JournalEntry }
  | { type: 'SEND_COACH_MESSAGE'; text: string }
  | { type: 'HYDRATE'; state: Partial<AppState> };

// ── Pure reducer (unit-testable without rendering) ────────────────
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'TOGGLE_ACTION':
      return {
        ...state,
        todayActions: state.todayActions.map(a =>
          a.id === action.id ? { ...a, done: !a.done } : a,
        ),
      };

    case 'ADD_ACTION':
      return { ...state, todayActions: [...state.todayActions, action.action] };

    case 'TOGGLE_SUBTASK': {
      const goals = state.goals.map(g => {
        if (g.id !== action.goalId) return g;
        const sub = g.sub.map((s, i) => i === action.idx ? { ...s, done: !s.done } : s);
        const progress = sub.filter(s => s.done).length / (sub.length || 1);
        return { ...g, sub, progress };
      });
      return { ...state, goals };
    }

    case 'ADD_GOAL':
      return { ...state, goals: [...state.goals, action.goal] };

    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: state.goals.map(g => {
          if (g.id !== action.goalId) return g;
          const next = { ...g, ...action.patch };
          // Recalculate progress if subtasks changed
          if (action.patch.sub) {
            next.progress = next.sub.filter(s => s.done).length / (next.sub.length || 1);
          }
          return next;
        }),
      };

    case 'REMOVE_GOAL':
      return {
        ...state,
        goals: state.goals.filter(g => g.id !== action.goalId),
      };

    case 'ADD_SUBTASK': {
      const goals = state.goals.map(g => {
        if (g.id !== action.goalId) return g;
        const sub = [...g.sub, action.subtask];
        const progress = sub.filter(s => s.done).length / (sub.length || 1);
        return { ...g, sub, progress };
      });
      return { ...state, goals };
    }

    case 'TOGGLE_HABIT': {
      const today = todayISO();
      return {
        ...state,
        habits: state.habits.map(h => {
          if (h.id !== action.id) return h;
          const history = h.history ?? [];
          const wasDone = history.includes(today);
          const newHistory = wasDone ? history.filter(d => d !== today) : [...history, today];
          return { ...h, doneToday: !wasDone, history: newHistory, streak: calcStreak(newHistory) };
        }),
      };
    }

    case 'ADD_HABIT':
      return { ...state, habits: [...state.habits, action.habit] };

    case 'SET_HABIT_CALENDAR_ID':
      return {
        ...state,
        habits: state.habits.map(h =>
          h.id === action.id ? { ...h, calendarEventId: action.calendarEventId } : h,
        ),
      };

    case 'ADD_JOURNAL':
      return { ...state, journal: [action.entry, ...state.journal] };

    case 'SEND_COACH_MESSAGE': {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: action.text,
      };
      const replies = [
        'Your patterns suggest mornings are your strongest window. Try tackling this before 10 am.',
        'Based on your journal sentiment, consistency matters more than intensity for you right now.',
        'Small, ordinary steps compound quietly. Trust the streak you\'ve already built.',
        'You\'ve navigated harder weeks than this. What does the steadiest version of you do next?',
        'Your data shows a correlation between long runs and high-sentiment days. What if this question is best answered after movement?',
      ];
      const coachMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'coach',
        text: replies[Math.floor(Math.random() * replies.length)],
      };
      return { ...state, coachMessages: [...state.coachMessages, userMsg, coachMsg] };
    }

    case 'HYDRATE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ── Initial state ─────────────────────────────────────────────────
export const initialState: AppState = {
  todayActions: [],
  goals: [],
  habits: [],
  journal: [],
  coachMessages: [],
};

// ── Context + Provider ────────────────────────────────────────────
type StoreCtx = { state: AppState; dispatch: React.Dispatch<AppAction> };
const StoreContext = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = usePersistentStore();
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be called inside <StoreProvider>');
  return ctx;
}
