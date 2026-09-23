// Pure: which analytics events a store action produces. Called from
// usePersistentStore's dispatch (store/sync.ts) so every screen that dispatches
// is covered in one place and the reducer stays free of side effects.

import type { AppAction, AppState } from '../store/reducer';
import type { TrackedEvent } from './analytics';

const pct = (fraction: number) => Math.round(fraction * 100);

export function wordCountBucket(text: string): '1-20' | '21-100' | '100+' {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 20) return '1-20';
  if (words <= 100) return '21-100';
  return '100+';
}

export function eventsForAction(action: AppAction, prev: AppState, next: AppState): TrackedEvent[] {
  switch (action.type) {
    case 'ADD_GOAL': {
      const g = action.goal;
      return [{ name: 'goal_created', props: { sphere: g.sphere, has_due_date: !!g.due, subtask_count: g.sub.length } }];
    }
    case 'UPDATE_GOAL':
      return [{ name: 'goal_updated', props: { fields_changed: Object.keys(action.patch).sort() } }];
    case 'REMOVE_GOAL': {
      const g = prev.goals.find(x => x.id === action.goalId);
      if (!g) return [];
      return [{ name: 'goal_deleted', props: { subtask_count: g.sub.length, progress_pct: pct(g.progress) } }];
    }
    case 'ADD_SUBTASK':
      return [{ name: 'subtask_added', props: {} }];
    case 'TOGGLE_SUBTASK': {
      const g = next.goals.find(x => x.id === action.goalId);
      const s = g?.sub[action.idx];
      if (!g || !s) return [];
      return [{
        name: 'subtask_toggled',
        props: { done: s.done, goal_progress_pct: pct(g.progress), goal_completed: g.sub.length > 0 && g.sub.every(x => x.done) },
      }];
    }
    case 'ADD_HABIT': {
      const h = action.habit;
      return [{ name: 'habit_created', props: { sphere: h.sphere, linked_to_goal: !!h.goalId } }];
    }
    case 'TOGGLE_HABIT': {
      const h = next.habits.find(x => x.id === action.id);
      if (!h) return [];
      return [{ name: 'habit_checked', props: { done: h.doneToday, streak: h.streak, sphere: h.sphere } }];
    }
    case 'SET_HABIT_REMINDER':
      return [{
        name: 'habit_reminder_set',
        props: action.hour === null ? { enabled: false } : { enabled: true, hour: action.hour },
      }];
    case 'ADD_ACTION':
      return [{ name: 'task_created', props: { sphere: action.action.sphere } }];
    case 'TOGGLE_ACTION': {
      const a = next.todayActions.find(x => x.id === action.id);
      if (!a) return [];
      return [{ name: 'task_toggled', props: { done: a.done } }];
    }
    case 'ADD_JOURNAL': {
      const e = action.entry;
      return [{
        name: 'journal_entry_created',
        props: { sentiment: e.sentiment, word_count_bucket: wordCountBucket(e.body ?? e.excerpt) },
      }];
    }
    // Coach chat is tracked in app/(tabs)/coach.tsx, where the outcome is known.
    default:
      return [];
  }
}
