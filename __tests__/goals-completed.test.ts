import { activeGoals, completedGoals, isCompleted } from '../lib/goals';
import type { Goal } from '../store/reducer';

const goal = (id: string, completedAt?: string): Goal => ({
  id, sphere: 'health', title: id, due: '', progress: 0, sub: [], completedAt,
});

describe('completed goals', () => {
  const goals = [
    goal('open-1'),
    goal('done-old', '2026-08-01T10:00:00.000Z'),
    goal('open-2'),
    goal('done-new', '2026-09-20T10:00:00.000Z'),
  ];

  it('treats a goal as completed only once completedAt is set', () => {
    expect(isCompleted(goal('a'))).toBe(false);
    expect(isCompleted(goal('b', '2026-09-20T10:00:00.000Z'))).toBe(true);
  });

  it('active goals exclude completed ones and keep their order', () => {
    expect(activeGoals(goals).map(g => g.id)).toEqual(['open-1', 'open-2']);
  });

  it('completed goals list newest first', () => {
    expect(completedGoals(goals).map(g => g.id)).toEqual(['done-new', 'done-old']);
  });
});
