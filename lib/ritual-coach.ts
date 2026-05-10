import type { SphereId } from '../constants/theme';
import type { Goal, HabitItem } from '../store/index';
import type { RitualAction } from '../store/daily-ritual';

const SPHERE_FALLBACKS: Record<SphereId, string[]> = {
  finance: [
    'Review last week\'s spending in one category',
    'Transfer any unspent cash to savings',
    'Check progress on this month\'s budget',
    'Unsubscribe from one unused service',
    'Read one article on personal finance',
  ],
  health: [
    'Go for a 20-minute walk outside',
    'Drink 2 litres of water today',
    'Do 10 minutes of stretching',
    'Sleep by 10:30 PM tonight',
    'Prep a healthy meal or snack',
  ],
  career: [
    'Close all browser tabs except the one task that matters most',
    'Write the first draft of something you\'ve been avoiding',
    'Send one message you\'ve been putting off',
    'Block 90 minutes of deep work time in your calendar',
    'Review and update your to-do list',
  ],
  relationships: [
    'Send a voice note to someone you haven\'t spoken to in a while',
    'Put your phone down during the next conversation you have',
    'Write a short thank-you to someone who helped you recently',
    'Schedule a call or meetup you\'ve been meaning to arrange',
    'Check in on a friend with a simple "how are you doing?"',
  ],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function proposeMorningActions(
  sphere: SphereId,
  goals: Goal[],
  habits: HabitItem[],
): RitualAction[] {
  const pool: RitualAction[] = [];

  // Pull incomplete subtasks from sphere-matching goals (up to 2).
  for (const goal of goals) {
    if (goal.sphere !== sphere) continue;
    for (const sub of goal.sub) {
      if (!sub.done && pool.length < 2) {
        pool.push({
          id: `sub-${goal.id}-${pool.length}`,
          text: sub.t,
          sphere,
          is_must_do: false,
          done: false,
          source: 'goal_subtask',
        });
      }
    }
  }

  // Pull one undone habit from the same sphere.
  const sphereHabit = habits.find(h => h.sphere === sphere && !h.doneToday);
  if (sphereHabit && pool.length < 3) {
    pool.push({
      id: `habit-${sphereHabit.id}`,
      text: sphereHabit.label,
      sphere,
      is_must_do: false,
      done: false,
      source: 'habit',
    });
  }

  // Fill remaining slots from static fallbacks.
  const fallbacks = shuffle(SPHERE_FALLBACKS[sphere]);
  for (const text of fallbacks) {
    if (pool.length >= 3) break;
    pool.push({
      id: `fallback-${Date.now()}-${pool.length}`,
      text,
      sphere,
      is_must_do: false,
      done: false,
      source: 'free',
    });
  }

  return pool.slice(0, 3);
}

const JOURNAL_SUGGESTIONS: Record<SphereId, { done: string[]; notDone: string[] }> = {
  finance: {
    done: [
      'Today I took one step toward financial peace.',
      'I made a conscious choice with my money today.',
      'Small financial wins still count.',
    ],
    notDone: [
      'Tomorrow I\'ll approach money with more intention.',
      'I noticed where my attention went instead.',
      'I can restart any day. Tomorrow is close.',
    ],
  },
  health: {
    done: [
      'I showed up for my body today.',
      'Movement is medicine — I took my dose.',
      'One healthy choice is never wasted.',
    ],
    notDone: [
      'Rest is still part of the process.',
      'Tomorrow my body gets another chance.',
      'I\'ll be gentler with myself and try again.',
    ],
  },
  career: {
    done: [
      'I made progress on something that matters.',
      'Today I did the hard thing instead of the easy thing.',
      'Consistency looks like this.',
    ],
    notDone: [
      'Clarity about what stopped me is useful data.',
      'Tomorrow I start with the most important thing first.',
      'Even an unproductive day teaches something.',
    ],
  },
  relationships: {
    done: [
      'I invested in someone I care about today.',
      'Connection is the whole point.',
      'That message I sent mattered more than I know.',
    ],
    notDone: [
      'I\'ll reach out to someone tomorrow, no matter how small.',
      'Being present tomorrow is still possible.',
      'Relationships are patient. So am I.',
    ],
  },
};

export function suggestJournalLine(sphere: SphereId, mustDoDone: boolean): string {
  const pool = JOURNAL_SUGGESTIONS[sphere][mustDoDone ? 'done' : 'notDone'];
  return pool[Math.floor(Math.random() * pool.length)];
}
