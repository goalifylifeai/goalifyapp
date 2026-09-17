// Mock native modules pulled in transitively by store/sync.ts
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
    auth: { onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })) },
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }), gte: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })) })),
    })),
  },
}));
jest.mock('../lib/bootstrap', () => ({ bootstrapUserData: jest.fn().mockResolvedValue({}) }));
jest.mock('../lib/offline-queue', () => ({ enqueue: jest.fn(), drainQueue: jest.fn() }));

import { appReducer, initialState, type AppAction, type AppState } from '../store';
import { GOALS, HABITS, TODAY_ACTIONS, JOURNAL } from '../constants/data';

// ── Helpers ───────────────────────────────────────────────────────
function state(): AppState {
  const s: AppState = JSON.parse(JSON.stringify(initialState));
  s.goals = GOALS.map(g => ({
    ...g,
    sub: g.sub.map((st, i) => ({ id: `st-${g.id}-${i}`, ...st }))
  }));
  s.habits = HABITS.map(h => ({ ...h, doneToday: false }));
  s.todayActions = TODAY_ACTIONS;
  s.journal = JOURNAL;
  return s;
}

// ── TOGGLE_ACTION ─────────────────────────────────────────────────
describe('TOGGLE_ACTION', () => {
  it('flips a done action to not-done', () => {
    const s = state();
    const id = s.todayActions.find(a => a.done)!.id;
    const next = appReducer(s, { type: 'TOGGLE_ACTION', id });
    expect(next.todayActions.find(a => a.id === id)!.done).toBe(false);
  });

  it('flips a not-done action to done', () => {
    const s = state();
    const id = s.todayActions.find(a => !a.done)!.id;
    const next = appReducer(s, { type: 'TOGGLE_ACTION', id });
    expect(next.todayActions.find(a => a.id === id)!.done).toBe(true);
  });

  it('does not mutate other actions', () => {
    const s = state();
    const id = s.todayActions[0].id;
    const next = appReducer(s, { type: 'TOGGLE_ACTION', id });
    expect(next.todayActions.filter(a => a.id !== id)).toEqual(s.todayActions.filter(a => a.id !== id));
  });
});

// ── ADD_ACTION ────────────────────────────────────────────────────
describe('ADD_ACTION', () => {
  it('appends a new action to the list', () => {
    const s = state();
    const newAction = { id: 'new-1', t: 'Test action', sphere: 'health' as const, time: '09:00', done: false, goal: 'g2' };
    const next = appReducer(s, { type: 'ADD_ACTION', action: newAction });
    expect(next.todayActions).toHaveLength(s.todayActions.length + 1);
    expect(next.todayActions[next.todayActions.length - 1]).toEqual(newAction);
  });
});

// ── TOGGLE_SUBTASK ────────────────────────────────────────────────
describe('TOGGLE_SUBTASK', () => {
  it('toggles a subtask from not-done to done', () => {
    const s = state();
    const goal = s.goals.find(g => g.sub.some(st => !st.done))!;
    const idx = goal.sub.findIndex(st => !st.done);
    const next = appReducer(s, { type: 'TOGGLE_SUBTASK', goalId: goal.id, idx });
    const updatedGoal = next.goals.find(g => g.id === goal.id)!;
    expect(updatedGoal.sub[idx].done).toBe(true);
  });

  it('recalculates progress when subtask is toggled', () => {
    const s = state();
    const goal = s.goals.find(g => g.sub.some(st => !st.done))!;
    const doneCount = goal.sub.filter(st => st.done).length;
    const idx = goal.sub.findIndex(st => !st.done);
    const next = appReducer(s, { type: 'TOGGLE_SUBTASK', goalId: goal.id, idx });
    const updatedGoal = next.goals.find(g => g.id === goal.id)!;
    const expectedProgress = (doneCount + 1) / goal.sub.length;
    expect(updatedGoal.progress).toBeCloseTo(expectedProgress);
  });

  it('does not affect other goals', () => {
    const s = state();
    const goal = s.goals[0];
    const idx = 0;
    const next = appReducer(s, { type: 'TOGGLE_SUBTASK', goalId: goal.id, idx });
    const others = next.goals.filter(g => g.id !== goal.id);
    expect(others).toEqual(s.goals.filter(g => g.id !== goal.id));
  });
});

// ── ADD_GOAL ──────────────────────────────────────────────────────
describe('ADD_GOAL', () => {
  it('appends a new goal', () => {
    const s = state();
    const newGoal = { id: 'g-new', sphere: 'finance' as const, title: 'New goal', due: 'Dec 31', progress: 0, sub: [] };
    const next = appReducer(s, { type: 'ADD_GOAL', goal: newGoal });
    expect(next.goals).toHaveLength(s.goals.length + 1);
    expect(next.goals[next.goals.length - 1].title).toBe('New goal');
  });
});

// ── TOGGLE_HABIT ──────────────────────────────────────────────────
describe('TOGGLE_HABIT', () => {
  it('toggles habit doneToday', () => {
    const s = state();
    const habit = s.habits[0];
    const prev = habit.doneToday;
    const next = appReducer(s, { type: 'TOGGLE_HABIT', id: habit.id });
    expect(next.habits.find(h => h.id === habit.id)!.doneToday).toBe(!prev);
  });
});

// ── ADD_HABIT ─────────────────────────────────────────────────────
describe('ADD_HABIT', () => {
  it('appends a new habit', () => {
    const s = state();
    const newHabit = { id: 'h-new', label: 'Cold shower', icon: '○', sphere: 'health' as const, streak: 0, target: '2 min', doneToday: false };
    const next = appReducer(s, { type: 'ADD_HABIT', habit: newHabit });
    expect(next.habits).toHaveLength(s.habits.length + 1);
    expect(next.habits[next.habits.length - 1].label).toBe('Cold shower');
  });

  it('accepts an optional goalId linking the habit to a goal', () => {
    const s = state();
    const goal = s.goals[0];
    const newHabit = { id: 'h-new', label: 'Cold shower', icon: '○', sphere: 'health' as const, streak: 0, target: '2 min', doneToday: false, goalId: goal.id };
    const next = appReducer(s, { type: 'ADD_HABIT', habit: newHabit });
    expect(next.habits[next.habits.length - 1].goalId).toBe(goal.id);
  });
});

// ── SET_HABIT_REMINDER ───────────────────────────────────────────────
describe('SET_HABIT_REMINDER', () => {
  it('sets the reminder hour and minute on the matching habit', () => {
    const s = state();
    const habit = s.habits[0];
    const next = appReducer(s, { type: 'SET_HABIT_REMINDER', id: habit.id, hour: 8, minute: 30 });
    const updated = next.habits.find(h => h.id === habit.id)!;
    expect(updated.reminderHour).toBe(8);
    expect(updated.reminderMinute).toBe(30);
  });

  it('clears the reminder when hour/minute are null', () => {
    const s = state();
    const habit = s.habits[0];
    const withReminder = appReducer(s, { type: 'SET_HABIT_REMINDER', id: habit.id, hour: 8, minute: 30 });
    const cleared = appReducer(withReminder, { type: 'SET_HABIT_REMINDER', id: habit.id, hour: null, minute: null });
    const updated = cleared.habits.find(h => h.id === habit.id)!;
    expect(updated.reminderHour).toBeNull();
    expect(updated.reminderMinute).toBeNull();
  });

  it('does not affect other habits', () => {
    const s = state();
    const [habit, other] = s.habits;
    const next = appReducer(s, { type: 'SET_HABIT_REMINDER', id: habit.id, hour: 8, minute: 0 });
    expect(next.habits.find(h => h.id === other.id)).toEqual(other);
  });
});

// ── ADD_JOURNAL ───────────────────────────────────────────────────
describe('ADD_JOURNAL', () => {
  it('prepends a new journal entry', () => {
    const s = state();
    const entry = { id: 'j-new', date: 'May 9', sentiment: 0.6, excerpt: 'New entry' };
    const next = appReducer(s, { type: 'ADD_JOURNAL', entry });
    expect(next.journal[0]).toEqual(entry);
    expect(next.journal).toHaveLength(s.journal.length + 1);
  });
});

// ── ADD_USER_MESSAGE / ADD_COACH_REPLY ─────────────────────────────
describe('ADD_USER_MESSAGE / ADD_COACH_REPLY', () => {
  it('appends a user message', () => {
    const s = state();
    const prevLen = s.coachMessages.length;
    const next = appReducer(s, { type: 'ADD_USER_MESSAGE', text: 'What should I focus on?' });
    expect(next.coachMessages).toHaveLength(prevLen + 1);
    expect(next.coachMessages[prevLen].role).toBe('user');
    expect(next.coachMessages[prevLen].text).toBe('What should I focus on?');
  });

  it('appends a coach reply', () => {
    const s = state();
    const prevLen = s.coachMessages.length;
    const next = appReducer(s, { type: 'ADD_COACH_REPLY', text: 'Focus on mornings.' });
    expect(next.coachMessages).toHaveLength(prevLen + 1);
    expect(next.coachMessages[prevLen].role).toBe('coach');
    expect(next.coachMessages[prevLen].text).toBe('Focus on mornings.');
  });
});
