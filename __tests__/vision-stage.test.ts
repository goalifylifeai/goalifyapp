import { stageFromProgress } from '../lib/vision-stage';
import { buildPrompt, promptHash, figureFromProfile } from '../lib/vision-prompts';
import { seedFromGoalId } from '../lib/vision-seed';

describe('stageFromProgress', () => {
  it('returns 0 for 0%', () => expect(stageFromProgress(0)).toBe(0));
  it('returns 0 for 24%', () => expect(stageFromProgress(0.24)).toBe(0));
  it('returns 1 for 25%', () => expect(stageFromProgress(0.25)).toBe(1));
  it('returns 1 for 49%', () => expect(stageFromProgress(0.49)).toBe(1));
  it('returns 2 for 50%', () => expect(stageFromProgress(0.50)).toBe(2));
  it('returns 2 for 74%', () => expect(stageFromProgress(0.74)).toBe(2));
  it('returns 3 for 75%', () => expect(stageFromProgress(0.75)).toBe(3));
  it('returns 3 for 100%', () => expect(stageFromProgress(1.0)).toBe(3));
});

describe('buildPrompt', () => {
  it('contains sphere scene content', () => {
    const p = buildPrompt({ sphere: 'finance', stage: 0 });
    expect(p).toContain('kitchen');
    expect(p).toContain('film grain');
  });

  it('varies by stage', () => {
    const s0 = buildPrompt({ sphere: 'health', stage: 0 });
    const s3 = buildPrompt({ sphere: 'health', stage: 3 });
    expect(s0).not.toBe(s3);
  });

  it('covers all spheres and stages without throwing', () => {
    const spheres = ['finance', 'health', 'career', 'relationships'] as const;
    const stages = [0, 1, 2, 3] as const;
    for (const sphere of spheres) {
      for (const stage of stages) {
        expect(() => buildPrompt({ sphere, stage })).not.toThrow();
      }
    }
  });
});

describe('promptHash', () => {
  it('returns an 8-char hex string', () => {
    const h = promptHash('hello world');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic', () => {
    const p = buildPrompt({ sphere: 'career', stage: 2 });
    expect(promptHash(p)).toBe(promptHash(p));
  });

  it('differs for different prompts', () => {
    const h1 = promptHash('prompt one');
    const h2 = promptHash('prompt two');
    expect(h1).not.toBe(h2);
  });
});

describe('seedFromGoalId', () => {
  it('returns a positive integer', () => {
    expect(seedFromGoalId('g1')).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(seedFromGoalId('goal-abc')).toBe(seedFromGoalId('goal-abc'));
  });

  it('differs for different ids', () => {
    expect(seedFromGoalId('g1')).not.toBe(seedFromGoalId('g2'));
  });

  it('stays within int32 range', () => {
    const seed = seedFromGoalId('some-very-long-goal-id-string-1234');
    expect(seed).toBeLessThan(2_147_483_648);
    expect(seed).toBeGreaterThan(0);
  });
});

describe('figureFromProfile', () => {
  it('maps she/he pronouns when gender-aware imagery is on', () => {
    expect(figureFromProfile('she/her', true)).toBe('woman');
    expect(figureFromProfile(' She/Her ', true)).toBe('woman');
    expect(figureFromProfile('he/him', true)).toBe('man');
    expect(figureFromProfile('He', true)).toBe('man');
  });

  it('does not read "her/hers" as he', () => {
    expect(figureFromProfile('her/hers', true)).toBeNull();
  });

  it('is null for they/them, custom or missing pronouns', () => {
    expect(figureFromProfile('they/them', true)).toBeNull();
    expect(figureFromProfile('xe/xem', true)).toBeNull();
    expect(figureFromProfile(null, true)).toBeNull();
    expect(figureFromProfile('', true)).toBeNull();
  });

  it('is null when gender-aware imagery is off', () => {
    expect(figureFromProfile('she/her', false)).toBeNull();
    expect(figureFromProfile('he/him', false)).toBeNull();
  });
});

describe('buildPrompt with a figure', () => {
  it('puts a matching person in the final health and career scenes', () => {
    expect(buildPrompt({ sphere: 'health', stage: 3, figure: 'woman' })).toContain('woman');
    expect(buildPrompt({ sphere: 'career', stage: 3, figure: 'man' })).toContain('man');
  });

  it('keeps the people-free scene when there is no figure', () => {
    const p = buildPrompt({ sphere: 'health', stage: 3, figure: null });
    expect(p).toContain('running shoes');
    expect(p).not.toMatch(/\b(woman|man)\b/);
  });

  it('never adds a person to finance or relationships', () => {
    expect(buildPrompt({ sphere: 'finance', stage: 3, figure: 'woman' }))
      .toBe(buildPrompt({ sphere: 'finance', stage: 3, figure: null }));
    expect(buildPrompt({ sphere: 'relationships', stage: 3, figure: 'man' }))
      .toBe(buildPrompt({ sphere: 'relationships', stage: 3, figure: null }));
  });

  it('gives different prompts (so different images) per figure', () => {
    const w = buildPrompt({ sphere: 'career', stage: 3, figure: 'woman' });
    const m = buildPrompt({ sphere: 'career', stage: 3, figure: 'man' });
    expect(promptHash(w)).not.toBe(promptHash(m));
  });
});
