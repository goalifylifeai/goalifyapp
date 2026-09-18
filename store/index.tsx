import React, { createContext, useContext, type ReactNode } from 'react';
import { usePersistentStore } from './sync';

export type {
  TodayAction, Subtask, Goal, HabitItem, JournalEntry, ChatMessage, AppState, AppAction,
} from './reducer';
export { appReducer, initialState } from './reducer';

// ── Context + Provider ────────────────────────────────────────────
import type { AppState, AppAction } from './reducer';

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
