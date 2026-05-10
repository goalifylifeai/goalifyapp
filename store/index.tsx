import React, { createContext, useContext, type ReactNode } from 'react';
import { usePersistentStore } from './sync';
import type { SphereId } from '../constants/theme';

// ── Domain types ──────────────────────────────────────────────────
export type TodayAction = {
  id: string; t: string; sphere: SphereId; time: string; done: boolean; goal: string;
};

export type Subtask = { t: string; done: boolean };

export type Goal = {
  id: string; sphere: SphereId; title: string; due: string; progress: number; sub: Subtask[];
};

export type HabitItem = {
  id: string; label: string; icon: string; sphere: SphereId; streak: number; target: string; doneToday: boolean;
};

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
  | { type: 'ADD_SUBTASK'; goalId: string; subtask: Subtask }
  | { type: 'TOGGLE_HABIT'; id: string }
  | { type: 'ADD_HABIT'; habit: HabitItem }
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

    case 'ADD_SUBTASK': {
      const goals = state.goals.map(g =>
        g.id !== action.goalId ? g : { ...g, sub: [...g.sub, action.subtask] },
      );
      return { ...state, goals };
    }

    case 'TOGGLE_HABIT':
      return {
        ...state,
        habits: state.habits.map(h =>
          h.id === action.id ? { ...h, doneToday: !h.doneToday } : h,
        ),
      };

    case 'ADD_HABIT':
      return { ...state, habits: [...state.habits, action.habit] };

    case 'ADD_JOURNAL':
      return { ...state, journal: [action.entry, ...state.journal] };

    case 'SEND_COACH_MESSAGE': {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
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
        id: `msg-${Date.now() + 1}`,
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
