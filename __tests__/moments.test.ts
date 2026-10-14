// Spec 012 Story 1: what the level-up / achievement moment shows.
import { decideMoment, afterDismiss, canShowMomentOn } from '../lib/moments';

describe('decideMoment', () => {
  it('records everything silently on first sight, with no moment (AS1.3)', () => {
    const r = decideMoment({ level: 4, achievements: ['first:habit_done', 'streak:7'] }, { level: null, achievements: null });
    expect(r.moment).toBeNull();
    expect(r.seed).toEqual({ level: 4, achievements: ['first:habit_done', 'streak:7'] });
  });

  it('celebrates a new level (AS1.1)', () => {
    expect(decideMoment({ level: 3, achievements: [] }, { level: 2, achievements: [] }).moment)
      .toEqual({ level: 3, achievements: [] });
  });

  it('shows only the highest of several new levels (AS1.5)', () => {
    expect(decideMoment({ level: 5, achievements: [] }, { level: 2, achievements: [] }).moment?.level).toBe(5);
  });

  it('never celebrates going down (e.g. XP corrected)', () => {
    expect(decideMoment({ level: 2, achievements: [] }, { level: 3, achievements: [] }).moment).toBeNull();
  });

  it('lists new, known achievements in catalogue order alongside a level-up (Story 2 AS3)', () => {
    const r = decideMoment(
      { level: 3, achievements: ['first:subtask_done', 'balanced_week', 'first:habit_done', 'from:future'] },
      { level: 2, achievements: ['first:subtask_done'] },
    );
    expect(r.moment).toEqual({ level: 3, achievements: ['first:habit_done', 'balanced_week'] });
    expect(r.seed).toEqual({});
  });

  it('with achievements unknown (read failed / migration not applied): levels still work, nothing seeded', () => {
    const first = decideMoment({ level: 3, achievements: null }, { level: null, achievements: null });
    expect(first.seed).toEqual({ level: 3 });
    expect(first.moment).toBeNull();

    const later = decideMoment({ level: 4, achievements: null }, { level: 3, achievements: null });
    expect(later.moment).toEqual({ level: 4, achievements: [] });
    expect(later.seed).toEqual({});
  });

  it('once achievements load after being unknown, the existing ones are seeded, not celebrated', () => {
    const r = decideMoment({ level: 4, achievements: ['streak:7', 'goals:5'] }, { level: 4, achievements: null });
    expect(r.moment).toBeNull();
    expect(r.seed).toEqual({ achievements: ['streak:7', 'goals:5'] });
  });
});

describe('afterDismiss', () => {
  it('records the level and what was shown', () => {
    expect(afterDismiss({ level: 2, achievements: ['a'] }, { level: 3, achievements: ['first:habit_done'] }, ['a', 'first:habit_done']))
      .toEqual({ level: 3, achievements: ['a', 'first:habit_done'] });
  });

  it('keeps a known achievement that arrived while the moment was open unseen, so it gets its own moment', () => {
    const next = afterDismiss({ level: 2, achievements: [] }, { level: 3, achievements: [] }, ['first:habit_done']);
    expect(next.achievements).not.toContain('first:habit_done');
  });

  it('records unknown keys so a later app version does not celebrate them retroactively', () => {
    expect(afterDismiss({ level: 2, achievements: [] }, { level: 3, achievements: [] }, ['from:future']).achievements)
      .toEqual(['from:future']);
  });

  it('leaves the level alone when only achievements were shown', () => {
    expect(afterDismiss({ level: 4, achievements: [] }, { level: null, achievements: ['streak:7'] }, ['streak:7']).level).toBe(4);
  });
});

describe('canShowMomentOn (FR-007)', () => {
  it.each([
    [['(tabs)'], true],
    [['(tabs)', 'goals'], true],
    [['ritual', 'evening'], false],
    [['(onboarding)', 'name'], false],
    [['(welcome)', 'add-goal'], false],
    [['paywall'], false],
    [[], false],
  ])('%j → %s', (segments, ok) => {
    expect(canShowMomentOn(segments)).toBe(ok);
  });
});
