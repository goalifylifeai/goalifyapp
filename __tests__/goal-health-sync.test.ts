// Spec 011: the habit → goal link and goal creation time survive a reload
// (bootstrap) and are written on sync. Before migration 0029 the link only
// lived in memory and vanished on the next launch.
const mockRows: Record<string, unknown[]> = {};

jest.mock('../lib/supabase', () => {
  const makeQuery = (table: string) => ({
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn(() => Promise.resolve({ data: mockRows[table] ?? [], error: null })),
  });
  return { supabase: { from: jest.fn((table: string) => makeQuery(table)) } };
});

import { bootstrapUserData } from '../lib/bootstrap';

describe('bootstrap maps goal health inputs', () => {
  beforeEach(() => { for (const k of Object.keys(mockRows)) delete mockRows[k]; });

  it('restores habit.goalId from habits.goal_id and goal.createdAt from created_at', async () => {
    mockRows.goals = [{
      id: 'g1', user_id: 'u1', sphere: 'health', title: 'Run a 5k', due_date: '2026-11-01',
      completed_at: null, created_at: '2026-10-01T09:00:00.000Z', updated_at: '2026-10-01T09:00:00.000Z',
    }];
    mockRows.habits = [
      { id: 'h1', user_id: 'u1', label: 'Run', icon: '○', sphere: 'health', target_description: '1 session',
        calendar_event_id: null, reminder_hour: null, reminder_minute: null, goal_id: 'g1',
        created_at: '2026-10-01T09:00:00.000Z', updated_at: '2026-10-01T09:00:00.000Z' },
      { id: 'h2', user_id: 'u1', label: 'Read', icon: '○', sphere: 'career', target_description: '1 session',
        calendar_event_id: null, reminder_hour: null, reminder_minute: null, goal_id: null,
        created_at: '2026-10-01T09:00:00.000Z', updated_at: '2026-10-01T09:00:00.000Z' },
    ];
    const state = await bootstrapUserData();
    expect(state.goals?.[0].createdAt).toBe('2026-10-01T09:00:00.000Z');
    expect(state.habits?.map(h => [h.id, h.goalId])).toEqual([['h1', 'g1'], ['h2', undefined]]);
  });
});
