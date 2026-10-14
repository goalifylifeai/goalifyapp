// Spec 012 FR-005: the client catalogue mirrors the keys the database awards.
import fs from 'fs';
import path from 'path';
import { ACHIEVEMENTS, ACHIEVEMENT_FAMILIES, achievementFor, knownKeys } from '../lib/achievements';

const sql = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', f), 'utf8');

// Every key the database can write, derived from the migrations themselves.
function serverKeys(): string[] {
  const xp = sql('0027_xp_events.sql');
  const ach = sql('0030_achievements.sql');

  const firstKinds = /xp_first_bonus_kinds[\s\S]*?array\[([\s\S]*?)\]/.exec(xp)![1]
    .match(/'([a-z_]+)'/g)!.map(s => `first:${s.slice(1, -1)}`);
  const milestones = /award_streak_milestones[\s\S]*?values ([^)]*\)(?:, \([^)]*\))*)/.exec(xp)![1]
    .match(/\((\d+),/g)!.map(m => `streak:${m.slice(1, -1)}`);
  const volume = [...ach.matchAll(/\('([a-z]+:\d+)',\s*'[a-z_]+',\s*\d+\)/g)].map(m => m[1]);
  const balance = ach.includes("'balanced_week'") ? ['balanced_week'] : [];
  return [...firstKinds, ...milestones, ...volume, ...balance];
}

describe('achievement catalogue', () => {
  it('has copy for exactly the keys the database awards (no drift)', () => {
    expect(new Set(ACHIEVEMENTS.map(a => a.key))).toEqual(new Set(serverKeys()));
  });

  it('parses all four families from the SQL (guards the parser above)', () => {
    const keys = serverKeys();
    expect(keys.filter(k => k.startsWith('first:'))).toHaveLength(7);
    expect(keys.filter(k => k.startsWith('streak:'))).toEqual(['streak:7', 'streak:30', 'streak:100', 'streak:365']);
    expect(keys.filter(k => /^(goals|habits|evenings):/.test(k))).toHaveLength(6);
    expect(keys).toContain('balanced_week');
  });

  it('has unique keys, a known family and copy for every achievement', () => {
    expect(new Set(ACHIEVEMENTS.map(a => a.key)).size).toBe(ACHIEVEMENTS.length);
    const families = new Set(ACHIEVEMENT_FAMILIES.map(f => f.id));
    for (const a of ACHIEVEMENTS) {
      expect(families.has(a.family)).toBe(true);
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.howTo.length).toBeGreaterThan(0);
    }
  });

  it('keys pass the analytics sanitizer (achievement_unlocked {achievement})', () => {
    for (const a of ACHIEVEMENTS) expect(a.key).toMatch(/^[a-z0-9_:/\[\]$.-]{1,40}$/);
  });

  it('ignores keys it does not know and returns catalogue order', () => {
    expect(knownKeys(['balanced_week', 'from:a-future-version', 'first:habit_done']))
      .toEqual(['first:habit_done', 'balanced_week']);
    expect(achievementFor('from:a-future-version')).toBeUndefined();
  });
});
