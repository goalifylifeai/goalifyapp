import { proposeMorningActions, suggestJournalLine } from '../lib/ritual-coach';
import type { Goal, HabitItem } from '../store/index';
import type { SphereId } from '../constants/theme';

const GOALS: Goal[] = [
  {
    id: 'g1', sphere: 'health', title: 'Run a half-marathon', due: 'Oct 12', progress: 0.34,
    sub: [
      { t: 'Complete first 10K', done: false },
      { t: 'Hold 9:30 / mile pace for 8 mi', done: false },
      { t: 'Already done task', done: true },
    ],
  },
  {
    id: 'g2', sphere: 'career', title: 'Ship design system', due: 'Jul 18', progress: 0.78,
    sub: [{ t: 'Run team adoption review', done: false }],
  },
];

const HABITS: HabitItem[] = [
  { id: 'h1', label: 'Morning meditation', icon: '◐', sphere: 'health', streak: 47, target: '10 min', doneToday: false },
  { id: 'h2', label: 'Strength training', icon: '△', sphere: 'health', streak: 9, target: '45 min', doneToday: true },
  { id: 'h3', label: 'Read 20 pages', icon: '▭', sphere: 'career', streak: 23, target: '20 pgs', doneToday: false },
];

describe('proposeMorningActions', () => {
  it('always returns exactly 3 actions', () => {
    const result = proposeMorningActions('health', GOALS, HABITS);
    expect(result).toHaveLength(3);
  });

  it('all returned actions have is_must_do: false by default', () => {
    const result = proposeMorningActions('career', GOALS, HABITS);
    expect(result.every(a => a.is_must_do === false)).toBe(true);
  });

  it('all returned actions have done: false', () => {
    const result = proposeMorningActions('finance', GOALS, HABITS);
    expect(result.every(a => a.done === false)).toBe(true);
  });

  it('includes incomplete subtasks from matching sphere goals', () => {
    const result = proposeMorningActions('health', GOALS, HABITS);
    const texts = result.map(a => a.text);
    // Both incomplete health subtasks should be included (there are 2)
    expect(texts).toContain('Complete first 10K');
    expect(texts).toContain('Hold 9:30 / mile pace for 8 mi');
  });

  it('does not include already-done subtasks', () => {
    const result = proposeMorningActions('health', GOALS, HABITS);
    expect(result.map(a => a.text)).not.toContain('Already done task');
  });

  it('includes undone habit from matching sphere', () => {
    const result = proposeMorningActions('health', GOALS, HABITS);
    // h1 is health and not done today
    expect(result.map(a => a.text)).toContain('Morning meditation');
    // h2 is health but doneToday = true, should not appear
    expect(result.map(a => a.text)).not.toContain('Strength training');
  });

  it('falls back to static pool when no goals/habits for sphere', () => {
    const result = proposeMorningActions('relationships', [], []);
    expect(result).toHaveLength(3);
    expect(result.every(a => a.source === 'free')).toBe(true);
  });

  it('returns unique ids', () => {
    const result = proposeMorningActions('career', GOALS, HABITS);
    const ids = result.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('suggestJournalLine', () => {
  const spheres: SphereId[] = ['finance', 'health', 'career', 'relationships'];

  it('returns a non-empty string for every sphere + done combination', () => {
    for (const sphere of spheres) {
      for (const done of [true, false]) {
        const result = suggestJournalLine(sphere, done);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    }
  });
});
