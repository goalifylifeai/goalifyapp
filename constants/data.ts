import type { SphereId } from './theme';

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

export const USER = {
  name: 'Maya',
  pronoun: 'she',
  xp: 5240,
  streak: 47,
  joined: '2025-08-12',
  todayQuote: 'I move toward what I want with steady, ordinary courage.',
};

export const SPHERE_SCORES: Record<SphereId, number> = {
  finance: 72, health: 58, career: 81, relationships: 64,
};

export const SCORE_HISTORY: Record<SphereId, number[]> = {
  finance:       [48,52,50,55,58,57,60,62,65,68,70,72],
  health:        [70,68,64,60,55,52,50,53,55,57,58,58],
  career:        [60,62,66,68,70,73,75,76,78,79,80,81],
  relationships: [55,58,60,62,60,58,60,62,63,64,64,64],
};

export const GOALS = [
  { id: 'g1', sphere: 'finance' as SphereId,       title: 'Build a 6-month emergency fund',  due: 'Sep 30',  progress: 0.62, sub: [
    { t: 'Open high-yield savings',          done: true  },
    { t: 'Automate $850 / month transfer',   done: true  },
    { t: 'Cut 2 recurring subscriptions',    done: true  },
    { t: 'Reach $8,400 milestone',           done: false },
    { t: 'Negotiate phone & internet bills', done: false },
    { t: 'Reach $13,500 final target',       done: false },
  ]},
  { id: 'g2', sphere: 'health' as SphereId,        title: 'Run a half-marathon in October',   due: 'Oct 12',  progress: 0.34, sub: [
    { t: 'Run 3× per week for 4 weeks',      done: true  },
    { t: 'Buy fitted running shoes',         done: true  },
    { t: 'Complete first 10K',               done: false },
    { t: 'Hold 9:30 / mile pace for 8 mi',  done: false },
    { t: 'Sign up for race',                 done: false },
  ]},
  { id: 'g3', sphere: 'career' as SphereId,        title: 'Ship the design system v2',        due: 'Jul 18',  progress: 0.78, sub: [
    { t: 'Audit existing components',        done: true  },
    { t: 'Define token spec',                done: true  },
    { t: 'Migrate 12 core components',       done: true  },
    { t: 'Write contributor docs',           done: true  },
    { t: 'Run team adoption review',         done: false },
  ]},
  { id: 'g4', sphere: 'relationships' as SphereId, title: 'Reconnect with 5 old friends',     due: 'Aug 01',  progress: 0.40, sub: [
    { t: 'Make a list of people I miss',     done: true  },
    { t: 'Reach out to Jordan',              done: true  },
    { t: 'Schedule call with Priya',         done: false },
    { t: 'Plan trip to see Sam',             done: false },
    { t: 'Write a letter to Mom',            done: false },
  ]},
];

export const HABITS = [
  { id: 'h1', label: 'Morning meditation', icon: '◐', sphere: 'health'        as SphereId, streak: 47, target: '10 min' },
  { id: 'h2', label: 'Strength training',  icon: '△', sphere: 'health'        as SphereId, streak:  9, target: '45 min' },
  { id: 'h3', label: 'Read 20 pages',      icon: '▭', sphere: 'career'        as SphereId, streak: 23, target: '20 pgs' },
  { id: 'h4', label: 'No-spend hour',      icon: '◇', sphere: 'finance'       as SphereId, streak: 14, target: '1 hr'   },
  { id: 'h5', label: 'Reach out to 1',     icon: '○', sphere: 'relationships' as SphereId, streak:  5, target: '1 pers' },
];

export const HEATMAP = [
  2,3,3,2,3,3,2, 3,2,3,3,2,3,3, 2,3,3,3,2,3,2, 3,2,3,2,3,3,3,
  2,1,3,2,3,3,2, 3,2,2,3,3,2,3, 1,2,3,3,2,2,3, 3,3,2,3,3,2,3,
  2,3,3,3,2,3,3, 3,2,3,3,2,3,2, 3,3,2,3,3,3,3, 2,3,3,3,3,3,3,
];

export const TODAY_ACTIONS = [
  { id: 't1', t: 'Run 5 miles, easy pace',        sphere: 'health'        as SphereId, time: '07:00', done: true,  goal: 'g2' },
  { id: 't2', t: 'Standup + design review',        sphere: 'career'        as SphereId, time: '10:00', done: true,  goal: 'g3' },
  { id: 't3', t: 'Move $850 to savings',           sphere: 'finance'       as SphereId, time: '12:30', done: false, goal: 'g1' },
  { id: 't4', t: 'Write contributor docs (1 hr)',  sphere: 'career'        as SphereId, time: '15:00', done: false, goal: 'g3' },
  { id: 't5', t: 'Call Priya',                     sphere: 'relationships' as SphereId, time: '18:30', done: false, goal: 'g4' },
];

export const JOURNAL = [
  { id: 'j1', date: 'May 8', sphere: 'career'        as SphereId, sentiment: 0.72,
    excerpt: 'Shipped the token migration. Felt steady today — like the work finally moves on its own momentum.' },
  { id: 'j2', date: 'May 7', sphere: 'relationships' as SphereId, sentiment: -0.18,
    excerpt: 'Missed Jordan\'s birthday call. Sat with the small guilt of it instead of pushing it away.' },
  { id: 'j3', date: 'May 6', sphere: 'health'        as SphereId, sentiment: 0.41,
    excerpt: 'Long run hurt at mile four, then opened up. The body keeps surprising me when I let it.' },
  { id: 'j4', date: 'May 5', sphere: 'finance'       as SphereId, sentiment: 0.55,
    excerpt: 'Cut the gym I never use. Strange how a $42 cancellation feels bigger than it is.' },
];

export const SENTIMENT = [
  0.1,0.2,0.15,-0.1,-0.2,0.05,0.3,0.4,0.35,0.2,
  0.1,-0.05,-0.2,-0.1,0.15,0.3,0.4,0.5,0.45,0.55,
  0.4,0.3,0.55,0.6,0.5,-0.18,0.41,0.55,0.72,0.6,
];

export const BADGES = [
  { id: 'b1',  name: 'First Step',        desc: 'Complete your first goal',     got: true,  cat: 'goals',   g: '△' },
  { id: 'b2',  name: '30-Day Mind',       desc: '30-day meditation streak',      got: true,  cat: 'habits',  g: '◐' },
  { id: 'b3',  name: 'Quiet Pages',       desc: 'Read 1,000 pages tracked',      got: true,  cat: 'habits',  g: '▭' },
  { id: 'b4',  name: 'Honest Witness',    desc: 'Journal 14 days in a row',      got: true,  cat: 'journal', g: '✎' },
  { id: 'b5',  name: 'Sphere Balance',    desc: 'All four spheres above 50',     got: true,  cat: 'spheres', g: '◇' },
  { id: 'b6',  name: 'Forty-Seven',       desc: '47-day overall streak',         got: true,  cat: 'habits',  g: '⌬' },
  { id: 'b7',  name: 'Quiet Money',       desc: 'Save $5,000',                   got: true,  cat: 'goals',   g: '$' },
  { id: 'b8',  name: 'Ship It',           desc: 'Hit a career milestone',        got: true,  cat: 'goals',   g: '◷' },
  { id: 'b9',  name: 'Anchored',          desc: 'Reach Level 5',                 got: true,  cat: 'spheres', g: '★' },
  { id: 'b10', name: 'Reaching Out',      desc: 'Reconnect with 3 friends',      got: false, cat: 'goals',   g: '○' },
  { id: 'b11', name: 'Half-Marathoner',   desc: 'Run 13.1 miles',                got: false, cat: 'habits',  g: '⌃' },
  { id: 'b12', name: 'Forerunner',        desc: 'Reach Level 6',                 got: false, cat: 'spheres', g: '✦' },
  { id: 'b13', name: 'Hundred Days',      desc: '100-day streak',                got: false, cat: 'habits',  g: '⌘' },
  { id: 'b14', name: 'Cartographer',      desc: 'Journal 50 days',               got: false, cat: 'journal', g: '✎' },
  { id: 'b15', name: 'Patience',          desc: 'Hold a goal for 90 days',       got: false, cat: 'goals',   g: '◔' },
  { id: 'b16', name: 'Whole Heart',       desc: 'Sphere score 90+',              got: false, cat: 'spheres', g: '♡' },
  { id: 'b17', name: 'Mentor',            desc: 'Reach Level 7',                 got: false, cat: 'spheres', g: '❖' },
  { id: 'b18', name: 'Wide Awake',        desc: '30-day journal streak',         got: false, cat: 'journal', g: '☼' },
  { id: 'b19', name: 'Quiet Strength',    desc: 'No-spend month',                got: false, cat: 'habits',  g: '◇' },
  { id: 'b20', name: 'Legend',            desc: 'Reach Level 8',                 got: false, cat: 'spheres', g: '❂' },
];

export const COACH_INSIGHTS = [
  { kind: 'pattern', title: 'You journal more after long runs',
    body: 'Of your 18 highest-sentiment entries this quarter, 14 fell on days you also logged a run over 4 miles. Movement seems to unlock reflection for you, not the other way around.' },
  { kind: 'nudge',   title: 'Relationships sphere has plateaued',
    body: 'Your score has held between 60 and 64 for six weeks. Your goal "Reconnect with 5 old friends" is the heaviest lever — try collapsing the next two subtasks into one 45-minute window this Sunday.' },
  { kind: 'win',     title: 'Career compounding',
    body: 'Three weeks ago you spent ~6 hrs / week on the design system. This week: 11 hrs and a shipped milestone. The pattern looks like a flywheel, not a sprint.' },
];

export const AFFIRMATIONS: Record<string, string> = {
  g1: 'Small, automatic transfers add up to a quiet kind of safety.',
  g2: 'My body knows how to go further than my mind expects.',
  g3: 'The work I make matters because the people around it do.',
  g4: 'The people I love are not waiting to be impressed; they\'re waiting to hear from me.',
};

export const VISION_CAPTIONS: Record<string, string> = {
  g1: 'A small kitchen, light through linen, a stack of cleared bills.',
  g2: 'A wide quiet morning. The road, your breath, an ordinary mile.',
  g3: 'A stage, a half-empty notebook, the team that built it with you.',
  g4: 'A long table. Six chairs. Candles already lit before you arrive.',
};

export function levelFromXp(xp: number) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) lvl = l;
  const next = LEVELS[lvl.n] || lvl;
  const span = (next.min - lvl.min) || 1;
  const into = xp - lvl.min;
  return { lvl, next, pct: Math.min(into / span, 1), into, span };
}
