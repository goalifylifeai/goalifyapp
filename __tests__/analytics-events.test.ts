import { eventsForAction, wordCountBucket } from '../lib/analytics-events';
import { appReducer, initialState, type AppAction, type AppState, type Goal, type HabitItem } from '../store/reducer';

const goal: Goal = {
  id: 'g1', sphere: 'health', title: 'Run a marathon', due: '2026-12-01', progress: 0,
  sub: [{ id: 's1', t: 'Buy shoes', done: false }, { id: 's2', t: 'Run 5k', done: true }],
};
const habit: HabitItem = {
  id: 'h1', label: 'Meditate', icon: '○', sphere: 'mind' as HabitItem['sphere'], streak: 0, target: '10 min', doneToday: false, history: [],
};

function run(action: AppAction, prev: AppState = initialState) {
  return eventsForAction(action, prev, appReducer(prev, action));
}

describe('eventsForAction', () => {
  it('goal_created carries no title', () => {
    const [e] = run({ type: 'ADD_GOAL', goal });
    expect(e).toEqual({ name: 'goal_created', props: { sphere: 'health', has_due_date: true, subtask_count: 2 } });
    expect(JSON.stringify(e)).not.toContain('marathon');
  });

  it('subtask_toggled reports progress and completion', () => {
    const prev = { ...initialState, goals: [goal] };
    expect(run({ type: 'TOGGLE_SUBTASK', goalId: 'g1', idx: 0 }, prev)).toEqual([
      { name: 'subtask_toggled', props: { done: true, goal_progress_pct: 100, goal_completed: true } },
    ]);
  });

  it('goal_updated sends field names only', () => {
    const prev = { ...initialState, goals: [goal] };
    expect(run({ type: 'UPDATE_GOAL', goalId: 'g1', patch: { title: 'New secret', due: '' } }, prev)).toEqual([
      { name: 'goal_updated', props: { fields_changed: ['due', 'title'] } },
    ]);
  });

  it('habit_checked reflects the new state', () => {
    const prev = { ...initialState, habits: [habit] };
    const [e] = run({ type: 'TOGGLE_HABIT', id: 'h1' }, prev);
    expect(e).toEqual({ name: 'habit_checked', props: { done: true, streak: 1, sphere: habit.sphere } });
  });

  it('journal_entry_created buckets length and never sends text', () => {
    const [e] = run({
      type: 'ADD_JOURNAL',
      entry: { id: 'j1', date: '2026-09-23', sentiment: 4, excerpt: 'Felt good', body: 'Felt good about the run today' },
    });
    expect(e).toEqual({ name: 'journal_entry_created', props: { sentiment: 4, word_count_bucket: '1-20' } });
  });

  it('habit_reminder_set distinguishes clearing a reminder', () => {
    expect(run({ type: 'SET_HABIT_REMINDER', id: 'h1', hour: null, minute: null }))
      .toEqual([{ name: 'habit_reminder_set', props: { enabled: false } }]);
  });

  it('ignores hydrate and chat actions', () => {
    expect(run({ type: 'HYDRATE', state: {} })).toEqual([]);
    expect(run({ type: 'ADD_USER_MESSAGE', text: 'hello' })).toEqual([]);
  });

  it('skips actions on unknown ids', () => {
    expect(run({ type: 'REMOVE_GOAL', goalId: 'nope' })).toEqual([]);
    expect(run({ type: 'TOGGLE_HABIT', id: 'nope' })).toEqual([]);
  });
});

describe('wordCountBucket', () => {
  it('buckets by words', () => {
    expect(wordCountBucket('one two')).toBe('1-20');
    expect(wordCountBucket(Array(50).fill('w').join(' '))).toBe('21-100');
    expect(wordCountBucket(Array(101).fill('w').join(' '))).toBe('100+');
  });
});
