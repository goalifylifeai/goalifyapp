import { levelFromXp, LEVELS } from '../constants/data';

describe('levelFromXp', () => {
  it('returns level 1 at 0 XP', () => {
    const r = levelFromXp(0);
    expect(r.lvl.n).toBe(1);
    expect(r.pct).toBe(0);
  });

  it('returns level 1 just before level 2 threshold', () => {
    const r = levelFromXp(299);
    expect(r.lvl.n).toBe(1);
  });

  it('returns level 2 at the threshold', () => {
    const r = levelFromXp(300);
    expect(r.lvl.n).toBe(2);
  });

  it('returns level 8 (max) at 20000 XP', () => {
    const r = levelFromXp(20000);
    expect(r.lvl.n).toBe(8);
  });

  it('caps progress at 1 for level 8', () => {
    const r = levelFromXp(999999);
    expect(r.pct).toBe(1);
  });

  it('calculates pct correctly mid-level', () => {
    // Level 2: min=300, level 3: min=900, span=600
    const r = levelFromXp(600);
    expect(r.lvl.n).toBe(2);
    expect(r.pct).toBeCloseTo(0.5);
    expect(r.into).toBe(300);
    expect(r.span).toBe(600);
  });

  it('returns correct next level', () => {
    const r = levelFromXp(300); // level 2
    expect(r.next.n).toBe(3);
  });

  it('covers all level thresholds', () => {
    LEVELS.forEach(l => {
      const r = levelFromXp(l.min);
      expect(r.lvl.n).toBe(l.n);
    });
  });
});
