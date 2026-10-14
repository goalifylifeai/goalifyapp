import type { SphereId } from './theme';
import type { Goal, HabitItem } from '../store/reducer';
import { goalHealth } from '../lib/goal-health';
import { localDateISO } from '../lib/date';

export const SPHERE_LIST: SphereId[] = ['finance', 'health', 'career', 'relationships'];

export const LEVELS = [
  { n: 1, name: 'Awakening',  min: 0     },
  { n: 2, name: 'Seeker',     min: 300   },
  { n: 3, name: 'Builder',    min: 900   },
  { n: 4, name: 'Practiced',  min: 2000  },
  { n: 5, name: 'Anchored',   min: 4200  },
  { n: 6, name: 'Forerunner', min: 7500  },
  { n: 7, name: 'Mentor',     min: 12000 },
  { n: 8, name: 'Legend',     min: 20000 },
];

// Caption per sphere, describing the "arrived" scene the vision board generates
// for that sphere (see supabase/functions/generate-vision SCENES stage 3).
export const SPHERE_VISION_CAPTIONS: Record<SphereId, string> = {
  finance:       'A sunlit sill, a jar that keeps filling, a plant still growing.',
  health:        'Morning light, worn-in shoes, the road you already ran.',
  career:        'The work finished, the desk quiet, flowers for the win.',
  relationships: 'A long table after a good night, candles burned low.',
};

// Fallback gradient shown behind a vision banner while its image loads.
export const SPHERE_VISION_TONES: Record<SphereId, [string, string]> = {
  finance:       ['#E8D5C5', '#C4A593'],
  health:        ['#E8E2D5', '#C9C0AE'],
  career:        ['#D8DEE0', '#A0AAAE'],
  relationships: ['#E8D8DC', '#BB9BA0'],
};

// A small library of affirmations per sphere. Each goal gets one picked
// deterministically from its id, so it stays stable across renders.
export const SPHERE_AFFIRMATIONS: Record<SphereId, string[]> = {
  finance: [
    'Small, automatic choices add up to a quiet kind of safety.',
    'I move toward what I want with steady, ordinary courage.',
    'Every clear decision about money is a gift to future me.',
  ],
  health: [
    'My body keeps showing up. I show up back.',
    'My body knows how to go further than my mind expects.',
    'Rest is part of the training, not a break from it.',
  ],
  career: [
    'The work I do matters because the people around it do.',
    'I finish things. One honest piece at a time.',
    'Focus is a choice I get to make again today.',
  ],
  relationships: [
    "The people I love aren't waiting to be impressed; they're waiting to hear from me.",
    'A short message today is worth more than a perfect one someday.',
    'I show up for the people who show up for me.',
  ],
};

export function affirmationFor(goalId: string, sphere: SphereId): string {
  const list = SPHERE_AFFIRMATIONS[sphere];
  let h = 0;
  for (let i = 0; i < goalId.length; i++) h = (h * 31 + goalId.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

export type SphereStats = {
  /** Goals in the sphere (incl. completed and "no plan yet"). */
  count: number;
  /** Goals that have a health value, i.e. that count toward the score. */
  scored: number;
  /** Mean goal health over the scored goals, 0 when none. */
  progress: number;
};

// Per-sphere stats from goal health (lib/goal-health). Goals with no plan yet
// (no subtasks, no linked habits) are excluded from the average, the same way
// an empty sphere is excluded from the overall score (spec 011 FR-002).
export function computeSphereData(
  goals: Goal[],
  habits: readonly HabitItem[] = [],
  today: string = localDateISO(),
): Record<SphereId, SphereStats> {
  return SPHERE_LIST.reduce((acc, id) => {
    const sphereGoals = goals.filter(g => g.sphere === id);
    const healths = sphereGoals
      .map(g => goalHealth(g, habits, today))
      .filter((h): h is number => h !== null);
    const progress = healths.length > 0 ? healths.reduce((a, b) => a + b, 0) / healths.length : 0;
    acc[id] = { count: sphereGoals.length, scored: healths.length, progress };
    return acc;
  }, {} as Record<SphereId, SphereStats>);
}

// Nudge copy for a sphere that has no goal yet. Shown on the home screen
// once the user has started at least one other sphere (see sphereNudge()).
// Lives here, not in the AI coach: deterministic, offline, no quota.
export const SPHERE_EMPTY_NUDGES: Record<SphereId, string> = {
  finance:       'Finance is still quiet. One small money goal would round out your week.',
  health:        'Health has no goal yet. Something you\'d like your body to thank you for?',
  career:        'Career is still open. What\'s one piece of work you want to finish?',
  relationships: 'Relationships has nothing yet. Who would you like to show up for?',
};

export type SphereNudge =
  | { kind: 'none' }
  | { kind: 'single'; sphere: SphereId }
  | { kind: 'many'; spheres: SphereId[] };

// Decides whether to nudge the user toward spheres that have no goal.
// - No sphere started yet → 'none' (the overview card already says "Add a goal").
// - Every sphere has a goal → 'none'.
// - Exactly one sphere left → 'single', so the copy can name it.
// - Otherwise → 'many', listing the empty spheres in SPHERE_LIST order.
export function sphereNudge(sphereData: Record<SphereId, { count: number }>): SphereNudge {
  const empty = SPHERE_LIST.filter(id => sphereData[id].count === 0);
  const started = SPHERE_LIST.length - empty.length;
  if (started === 0 || empty.length === 0) return { kind: 'none' };
  if (empty.length === 1) return { kind: 'single', sphere: empty[0] };
  return { kind: 'many', spheres: empty };
}

// Overall score only averages spheres with at least one scored goal. A sphere
// with no goals yet, or only goals with no plan, shouldn't drag the score
// toward 0 — it stays neutral until the user engages with it.
export function computeOverallScore(
  sphereData: Record<SphereId, { count: number; progress: number; scored?: number }>,
): number {
  const startedSpheres = Object.values(sphereData).filter(d => (d.scored ?? d.count) > 0);
  if (startedSpheres.length === 0) return 0;
  const avg = startedSpheres.reduce((sum, d) => sum + d.progress, 0) / startedSpheres.length;
  return Math.round(avg * 100);
}

export function levelFromXp(xp: number) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) lvl = l;
  const next = LEVELS[lvl.n] || lvl;
  const span = (next.min - lvl.min) || 1;
  const into = xp - lvl.min;
  return { lvl, next, pct: Math.min(into / span, 1), into, span };
}

// The pre-spec-010 formula (XP = life score × 50). Kept only as the
// EARNED_XP=false fallback and as the reference the carryover in
// supabase/migrations/0028_xp_backfill.sql reproduces. The level everyone
// sees comes from useLevel() in store/xp.tsx.
export function legacyXpForGoals(goals: Goal[]): number {
  return computeOverallScore(computeSphereData(goals)) * 50;
}
