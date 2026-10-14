// Spec 011: goal health, status, ordering and sphere scoring.
import {
  daysBetween, effectiveDue, habitConsistency, goalHealth, goalStatus, healthParts, sortByUrgency,
} from '../lib/goal-health';
import { computeSphereData, computeOverallScore } from '../constants/data';
import { appReducer } from '../store/reducer';
import { addDaysISO } from '../lib/date';
import type { AppState, Goal, HabitItem } from '../store/reducer';

const TODAY = '2026-10-14';
const d = (offset: number) => addDaysISO(TODAY, offset);
// Midday local, so the local calendar day is stable in any test timezone.
const createdOn = (day: string) => new Date(`${day}T12:00:00`).toISOString();

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', sphere: 'health', title: 'Run a 5k', due: '', progress: 0, sub: [],
  createdAt: createdOn(d(-30)), ...over,
});
const habit = (over: Partial<HabitItem> = {}): HabitItem => ({
  id: 'h1', label: 'Run', icon: '○', sphere: 'health', streak: 0, target: '1 session',
  doneToday: false, history: [], goalId: 'g1', ...over,
});
const sub = (done: boolean[]) => done.map((x, i) => ({ id: `s${i}`, t: `s${i}`, done: x }));

describe('daysBetween', () => {
  it('counts calendar days, across months and DST', () => {
    expect(daysBetween('2026-10-14', '2026-10-14')).toBe(0);
    expect(daysBetween('2026-10-14', '2026-10-16')).toBe(2);
    expect(daysBetween('2026-10-16', '2026-10-14')).toBe(-2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2); // EU DST change on 25 Oct
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('effectiveDue (FR-009)', () => {
  it('is null without a due date', () => {
    expect(effectiveDue(goal({ due: '' }))).toBeNull();
  });
  it('treats a due date on the creation day (old default) as undated', () => {
    expect(effectiveDue(goal({ due: d(-30), createdAt: createdOn(d(-30)) }))).toBeNull();
  });
  it('keeps any other due date', () => {
    expect(effectiveDue(goal({ due: d(5) }))).toBe(d(5));
  });
  it('keeps the due date when the creation time is unknown', () => {
    expect(effectiveDue(goal({ due: d(5), createdAt: undefined }))).toBe(d(5));
  });
});

describe('habitConsistency', () => {
  it('is done days in the trailing 7 ÷ 7', () => {
    const h = habit({ history: [d(-1), d(-2), d(-3), d(-5), d(-6)] });
    expect(habitConsistency(h, TODAY)).toBeCloseTo(5 / 7);
  });
  it('does not dip in the morning before today is checked', () => {
    // 7 straight days ending yesterday = 100%, not 6/7.
    const h = habit({ history: [1, 2, 3, 4, 5, 6, 7].map(n => d(-n)) });
    expect(habitConsistency(h, TODAY)).toBe(1);
  });
  it('counts today from doneToday even if history lags', () => {
    expect(habitConsistency(habit({ doneToday: true }), TODAY)).toBeCloseTo(1 / 7);
  });
  it('ignores days older than the window', () => {
    expect(habitConsistency(habit({ history: [d(-9), d(-20)] }), TODAY)).toBe(0);
  });
});

describe('goalHealth (Story 1)', () => {
  it('is null — "no plan yet" — with no subtasks and no linked habits (AS1.1)', () => {
    expect(goalHealth(goal(), [], TODAY)).toBeNull();
  });
  it('uses linked-habit consistency when there are no subtasks (AS1.2)', () => {
    const h = habit({ history: [d(-1), d(-2), d(-3), d(-4), d(-5)] });
    expect(goalHealth(goal(), [h], TODAY)).toBeCloseTo(5 / 7);
  });
  it('averages subtasks and habits when both exist (AS1.3)', () => {
    const h = habit({ history: [1, 2, 3, 4, 5, 6, 7].map(n => d(-n)) });
    expect(goalHealth(goal({ sub: sub([true, true, false, false]) }), [h], TODAY)).toBeCloseTo(0.75);
  });
  it('is the subtask ratio with subtasks only (AS1.4)', () => {
    expect(goalHealth(goal({ sub: sub([true, true]) }), [], TODAY)).toBe(1);
  });
  it('goes back down when a habit is unchecked (AS1.5, derived not ratcheted)', () => {
    const before = goalHealth(goal(), [habit({ doneToday: true, history: [TODAY, d(-1)] })], TODAY)!;
    const after = goalHealth(goal(), [habit({ doneToday: false, history: [d(-1)] })], TODAY)!;
    expect(after).toBeLessThan(before);
  });
  it('counts a linked habit that was never checked as 0, not "no data"', () => {
    expect(goalHealth(goal({ sub: sub([true]) }), [habit()], TODAY)).toBe(0.5);
  });
  it('averages several linked habits and ignores habits linked elsewhere', () => {
    const all = [1, 2, 3, 4, 5, 6, 7].map(n => d(-n));
    const habits = [habit({ id: 'a', history: all }), habit({ id: 'b' }), habit({ id: 'c', goalId: 'other', history: all })];
    expect(healthParts(goal(), habits, TODAY)).toEqual({ subtasks: null, habits: 0.5, habitCount: 2 });
  });
  it('is 1 for a completed goal', () => {
    expect(goalHealth(goal({ completedAt: createdOn(d(-1)) }), [], TODAY)).toBe(1);
  });
});

describe('goalStatus (Story 2)', () => {
  it('is overdue with the day count once the due date has passed (FR-005)', () => {
    expect(goalStatus(goal({ due: d(-3), sub: sub([true]) }), 1, TODAY)).toEqual({ kind: 'overdue', days: 3 });
  });
  it('is never overdue or at risk once completed (FR-007)', () => {
    expect(goalStatus(goal({ due: d(-3), completedAt: createdOn(d(-4)) }), 1, TODAY)).toEqual({ kind: 'completed' });
  });
  it('has no label without a due date', () => {
    expect(goalStatus(goal({ sub: sub([false]) }), 0, TODAY)).toEqual({ kind: 'on_track' });
    expect(goalStatus(goal(), null, TODAY)).toEqual({ kind: 'no_plan' });
  });
  it('is at risk when due within 7 days and behind the elapsed share (FR-006)', () => {
    // created 30 days ago, due in 3 → ~91% elapsed; 10% health is behind.
    expect(goalStatus(goal({ due: d(3) }), 0.1, TODAY)).toEqual({ kind: 'at_risk', daysLeft: 3 });
  });
  it('is not at risk when ahead of pace', () => {
    // created 4 days ago, due in 4 → 50% elapsed; 60% health is ahead.
    expect(goalStatus(goal({ due: d(4), createdAt: createdOn(d(-4)) }), 0.6, TODAY)).toEqual({ kind: 'on_track' });
  });
  it('is never at risk at ≥ 80% health', () => {
    expect(goalStatus(goal({ due: d(1) }), 0.8, TODAY)).toEqual({ kind: 'on_track' });
  });
  it('is not at risk more than 7 days out', () => {
    expect(goalStatus(goal({ due: d(8) }), 0, TODAY)).toEqual({ kind: 'on_track' });
  });
  it('flags a goal with no plan and a close due date as at risk', () => {
    expect(goalStatus(goal({ due: d(2) }), null, TODAY)).toEqual({ kind: 'at_risk', daysLeft: 2 });
  });
  it('is at risk, not overdue, on the due day itself', () => {
    expect(goalStatus(goal({ due: TODAY }), 0.1, TODAY)).toEqual({ kind: 'at_risk', daysLeft: 0 });
  });
  it('ignores the legacy creation-day due date', () => {
    expect(goalStatus(goal({ due: d(-30) }), 0.1, TODAY)).toEqual({ kind: 'on_track' });
  });
});

describe('sortByUrgency (FR-008)', () => {
  it('puts overdue, then at risk, first and keeps everything else in order', () => {
    const goals = [
      goal({ id: 'a', sub: sub([true]) }),
      goal({ id: 'b', due: d(2) }),          // at risk (no plan, close)
      goal({ id: 'c', sub: sub([false]) }),
      goal({ id: 'd', due: d(-1) }),         // overdue
      goal({ id: 'e', due: d(-5) }),         // overdue
    ];
    const sorted = sortByUrgency(goals, g => goalStatus(g, goalHealth(g, [], TODAY), TODAY));
    expect(sorted.map(g => g.id)).toEqual(['d', 'e', 'b', 'a', 'c']);
  });
});

describe('computeSphereData + computeOverallScore (FR-002, FR-003)', () => {
  it('excludes "no plan yet" goals from the sphere average', () => {
    const goals = [goal({ id: 'a', sub: sub([true, false]) }), goal({ id: 'b' })];
    expect(computeSphereData(goals, [], TODAY).health).toEqual({ count: 2, scored: 1, progress: 0.5 });
  });
  it('a sphere whose only goals have no plan does not drag the overall score', () => {
    const goals = [
      goal({ id: 'a', sphere: 'career', sub: sub([true]) }),
      goal({ id: 'b', sphere: 'health' }),
    ];
    expect(computeOverallScore(computeSphereData(goals, [], TODAY))).toBe(100);
  });
  it('a goal with a linked habit lifts its sphere off 0 (SC-001)', () => {
    const data = computeSphereData([goal()], [habit({ doneToday: true })], TODAY);
    expect(data.health.progress).toBeGreaterThan(0);
  });
  it('still accepts the old shape without `scored`', () => {
    expect(computeOverallScore({
      finance: { count: 1, progress: 0.5 }, health: { count: 0, progress: 0 },
      career: { count: 0, progress: 0 }, relationships: { count: 0, progress: 0 },
    })).toBe(50);
  });
});

describe('reducer: deleting a goal unlinks its habits', () => {
  it('keeps the habit and clears goalId (mirrors ON DELETE SET NULL)', () => {
    const state: AppState = {
      todayActions: [], journal: [], coachMessages: [],
      goals: [goal()],
      habits: [habit(), habit({ id: 'h2', goalId: 'other' })],
    };
    const next = appReducer(state, { type: 'REMOVE_GOAL', goalId: 'g1' });
    expect(next.habits.map(h => [h.id, h.goalId])).toEqual([['h1', undefined], ['h2', 'other']]);
  });
});
