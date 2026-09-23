import type { SphereId } from './theme';
import type { Goal } from '../store/reducer';

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
  finance:       'A small kitchen, light through linen, a table with nothing left owing.',
  health:        'A wide quiet morning. The road, your breath, the finish in sight.',
  career:        'The work shipped, the room nodding, the notebook full.',
  relationships: 'A long table, the candle burned low, the people you love still there.',
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

export function computeSphereData(goals: Goal[]): Record<SphereId, { count: number; progress: number }> {
  return SPHERE_LIST.reduce((acc, id) => {
    const sphereGoals = goals.filter(g => g.sphere === id);
    const avgProgress = sphereGoals.length > 0
      ? sphereGoals.reduce((sum, g) => sum + g.progress, 0) / sphereGoals.length
      : 0;
    acc[id] = { count: sphereGoals.length, progress: avgProgress };
    return acc;
  }, {} as Record<SphereId, { count: number; progress: number }>);
}

// Overall score only averages spheres the user has actually started (has a goal
// in). A sphere with no goals yet shouldn't drag the score toward 0 — it should
// be neutral until the user engages with it.
export function computeOverallScore(sphereData: Record<SphereId, { count: number; progress: number }>): number {
  const startedSpheres = Object.values(sphereData).filter(d => d.count > 0);
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

// Single source of truth for the level shown on Today, Profile and Level info.
export function levelForGoals(goals: Goal[]) {
  return levelFromXp(computeOverallScore(computeSphereData(goals)) * 50);
}
