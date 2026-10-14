// Spec 011 Story 3: goal-due reminder planning and reconciliation.
let mockScheduled: { identifier: string; content: { body?: string; data?: Record<string, unknown> } }[] = [];

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockImplementation(({ identifier, content }: any) => {
    mockScheduled = mockScheduled.filter(n => n.identifier !== identifier);
    mockScheduled.push({ identifier, content });
    return Promise.resolve(identifier);
  }),
  cancelScheduledNotificationAsync: jest.fn().mockImplementation((identifier: string) => {
    mockScheduled = mockScheduled.filter(n => n.identifier !== identifier);
    return Promise.resolve();
  }),
  getAllScheduledNotificationsAsync: jest.fn().mockImplementation(() => Promise.resolve(mockScheduled)),
  SchedulableTriggerInputTypes: { CALENDAR: 'calendar', DAILY: 'daily', DATE: 'date' },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../lib/analytics', () => ({ track: jest.fn() }));

import * as Notifications from 'expo-notifications';
import { planGoalReminders, GOAL_REMINDER_MAX_DAYS } from '../lib/goal-reminders';
import { ensureGoalRemindersScheduled } from '../lib/notifications';
import { notificationKind } from '../lib/analytics-screen';
import { addDaysISO, localDateISO } from '../lib/date';
import type { Goal, HabitItem } from '../store/reducer';

const TODAY = '2026-10-14';
const d = (n: number) => addDaysISO(TODAY, n);
const NOON = new Date(`${TODAY}T12:00:00`);          // before the 21:00 evening slot
const LATE = new Date(`${TODAY}T22:00:00`);          // after it
const goal = (over: Partial<Goal>): Goal => ({
  id: 'g', sphere: 'career', title: 'Ship it', due: '', progress: 0, sub: [],
  createdAt: new Date(`${d(-30)}T12:00:00`).toISOString(), ...over,
});
const plan = (goals: Goal[], now = NOON, habits: HabitItem[] = []) => planGoalReminders(goals, habits, now, 21, 0);
const localDay = (date: Date) => localDateISO(date);

describe('planGoalReminders', () => {
  it('schedules one reminder 2 days before the due date at the evening time (AS3.1)', () => {
    const [r] = plan([goal({ due: d(10) })]);
    expect(r.id).toBe(`goal-due-${d(8)}`);
    expect(localDay(r.fireAt)).toBe(d(8));
    expect([r.fireAt.getHours(), r.fireAt.getMinutes()]).toEqual([21, 0]);
    expect(r.data).toEqual({ screen: 'goals', sphere: 'career' });
    expect(r.body).toBe('"Ship it" is due in 2 days: no plan yet.');
  });

  it('falls back to the next evening before the due date when 2 days out has passed (AS3.2)', () => {
    expect(plan([goal({ due: d(1) })], NOON).map(r => r.id)).toEqual([`goal-due-${TODAY}`]);
    expect(plan([goal({ due: d(1) })], NOON)[0].body).toContain('due tomorrow');
  });

  it('schedules nothing when no evening remains before the due date (AS3.2)', () => {
    expect(plan([goal({ due: d(1) })], LATE)).toEqual([]);
    expect(plan([goal({ due: TODAY })], NOON)).toEqual([]);
  });

  it('skips goals with no due date, a legacy creation-day date, or completed', () => {
    expect(plan([
      goal({ id: 'a' }),
      goal({ id: 'b', due: d(-30) }),
      goal({ id: 'c', due: d(10), completedAt: new Date().toISOString() }),
    ])).toEqual([]);
  });

  it('sends at most one per day, naming the most urgent and counting the rest (AS3.6)', () => {
    const goals = [
      goal({ id: 'a', title: 'Ahead', due: d(5), sub: [{ id: 's', t: 's', done: true }] }),
      goal({ id: 'b', title: 'Behind', due: d(5) }),
      goal({ id: 'c', title: 'Other', due: d(5), sub: [{ id: 's', t: 's', done: false }, { id: 't', t: 't', done: true }] }),
    ];
    const out = plan(goals);
    expect(out).toHaveLength(1);
    expect(out[0].body).toBe('"Behind" is due in 2 days: no plan yet. (and 2 more)');
  });

  it('caps how far ahead it schedules (iOS 64-notification limit)', () => {
    const goals = Array.from({ length: 20 }, (_, i) => goal({ id: `g${i}`, due: d(5 + i) }));
    expect(plan(goals)).toHaveLength(GOAL_REMINDER_MAX_DAYS);
    expect(plan(goals)[0].id).toBe(`goal-due-${d(3)}`);
  });

  it('reflects linked-habit health in the copy', () => {
    const h: HabitItem = {
      id: 'h', label: 'x', icon: '○', sphere: 'career', streak: 0, target: '', doneToday: false, goalId: 'g',
      history: [1, 2, 3, 4, 5, 6, 7].map(n => d(-n)),
    };
    expect(plan([goal({ due: d(10) })], NOON, [h])[0].body).toContain('100% there');
  });
});

describe('ensureGoalRemindersScheduled', () => {
  beforeEach(() => { mockScheduled = []; jest.clearAllMocks(); });

  it('schedules the plan, then cancels reminders that are no longer wanted (AS3.3)', async () => {
    await ensureGoalRemindersScheduled(plan([goal({ due: d(10) })]));
    expect(mockScheduled.map(n => n.identifier)).toEqual([`goal-due-${d(8)}`]);

    // Goal completed / date cleared → empty plan → cancelled.
    await ensureGoalRemindersScheduled([]);
    expect(mockScheduled).toEqual([]);
  });

  it('moves the reminder when the due date moves', async () => {
    await ensureGoalRemindersScheduled(plan([goal({ due: d(10) })]));
    await ensureGoalRemindersScheduled(plan([goal({ due: d(20) })]));
    expect(mockScheduled.map(n => n.identifier)).toEqual([`goal-due-${d(18)}`]);
  });

  it('leaves an unchanged reminder alone and replaces one whose copy changed', async () => {
    const p = plan([goal({ due: d(10) })]);
    await ensureGoalRemindersScheduled(p);
    await ensureGoalRemindersScheduled(p);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    await ensureGoalRemindersScheduled(plan([goal({ due: d(10), title: 'Renamed' })]));
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockScheduled[0].content.body).toContain('Renamed');
  });

  it('never touches other notifications', async () => {
    mockScheduled = [{ identifier: 'habit-reminder-h1', content: {} }, { identifier: 'ritual-evening', content: {} }];
    await ensureGoalRemindersScheduled([]);
    expect(mockScheduled.map(n => n.identifier)).toEqual(['habit-reminder-h1', 'ritual-evening']);
  });

  it('does nothing without notification permission (AS3.5)', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    await ensureGoalRemindersScheduled(plan([goal({ due: d(10) })]));
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('notificationKind', () => {
  it('classifies goal reminders as goal_due without leaking the date (FR-013)', () => {
    expect(notificationKind(`goal-due-${d(8)}`)).toBe('goal_due');
  });
});
