import { xpDeltaForStore, XP, emitLocalXp, requestXpRefresh, onXpChange } from '../lib/xp';
import { levelFromXp, legacyXpForGoals, LEVELS } from '../constants/data';
import type { Goal, HabitItem, JournalEntry } from '../store/reducer';

const goal = (id: string, subs: [string, boolean][], completedAt?: string): Goal => ({
  id, sphere: 'health', title: id, due: '', completedAt,
  sub: subs.map(([sid, done]) => ({ id: sid, t: sid, done })) as any,
  progress: subs.length ? subs.filter(s => s[1]).length / subs.length : 0,
});
const habit = (id: string, doneToday: boolean): HabitItem =>
  ({ id, label: id, icon: 'x', sphere: 'health', streak: 0, target: '', doneToday });
const entry = (id: string, date: string): JournalEntry => ({ id, date, sentiment: 0, excerpt: 'x' });
const S = (goals: Goal[] = [], habits: HabitItem[] = [], journal: JournalEntry[] = []) => ({ goals, habits, journal });

describe('xpDeltaForStore', () => {
  it('checking a subtask earns subtask XP', () => {
    expect(xpDeltaForStore(S([goal('g', [['a', false]])]), S([goal('g', [['a', true]])]))).toBe(XP.subtask_done);
  });

  it('un-checking takes it back', () => {
    expect(xpDeltaForStore(S([goal('g', [['a', true]])]), S([goal('g', [['a', false]])]))).toBe(-XP.subtask_done);
  });

  it('adding a new goal earns nothing (P2 fixed)', () => {
    expect(xpDeltaForStore(S([goal('g', [['a', true]])]), S([goal('g', [['a', true]]), goal('h', [['b', false]])]))).toBe(0);
  });

  it('deleting a goal keeps its XP (FR-006)', () => {
    expect(xpDeltaForStore(S([goal('g', [['a', true]], '2026-09-01')]), S([]))).toBe(0);
  });

  it('completing and reopening a goal', () => {
    expect(xpDeltaForStore(S([goal('g', [])]), S([goal('g', [], '2026-09-30')]))).toBe(XP.goal_completed);
    expect(xpDeltaForStore(S([goal('g', [], '2026-09-30')]), S([goal('g', [])]))).toBe(-XP.goal_completed);
  });

  it('habit check / uncheck', () => {
    expect(xpDeltaForStore(S([], [habit('h', false)]), S([], [habit('h', true)]))).toBe(XP.habit_done);
    expect(xpDeltaForStore(S([], [habit('h', true)]), S([], [habit('h', false)]))).toBe(-XP.habit_done);
  });

  it('journal earns once per day', () => {
    const one = S([], [], [entry('1', '2026-09-30')]);
    expect(xpDeltaForStore(S(), one)).toBe(XP.journal_entry);
    expect(xpDeltaForStore(one, S([], [], [entry('2', '2026-09-30'), entry('1', '2026-09-30')]))).toBe(0);
  });
});

describe('levels', () => {
  it('Legend is reachable with earned XP (P1 fixed)', () => {
    expect(levelFromXp(20000).lvl.name).toBe('Legend');
    expect(levelFromXp(LEVELS[LEVELS.length - 1].min + 1).pct).toBe(1);
  });

  it('the legacy formula still tops out at Level 5 (why it was replaced)', () => {
    const allDone = [goal('g', [['a', true]])];
    expect(legacyXpForGoals(allDone)).toBe(5000);
    expect(levelFromXp(legacyXpForGoals(allDone)).lvl.n).toBe(5);
  });
});

describe('xp change bus', () => {
  it('delivers deltas and refresh requests, ignores zero, unsubscribes', () => {
    const seen: unknown[] = [];
    const off = onXpChange(e => seen.push(e));
    emitLocalXp(10);
    emitLocalXp(0);
    requestXpRefresh();
    off();
    emitLocalXp(5);
    expect(seen).toEqual([{ delta: 10 }, { refresh: true }]);
  });
});
