import type { SphereId } from '../../constants/theme';

// Demo fixtures for reducer tests. Kept out of constants/ so they can't leak into the UI.

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

export const TODAY_ACTIONS = [
  { id: 't1', t: 'Run 5 miles, easy pace',        sphere: 'health'        as SphereId, time: '07:00', done: true,  goal: 'g2' },
  { id: 't2', t: 'Standup + design review',        sphere: 'career'        as SphereId, time: '10:00', done: true,  goal: 'g3' },
  { id: 't3', t: 'Move $850 to savings',           sphere: 'finance'       as SphereId, time: '12:30', done: false, goal: 'g1' },
  { id: 't4', t: 'Write contributor docs (1 hr)',  sphere: 'career'        as SphereId, time: '15:00', done: false, goal: 'g3' },
  { id: 't5', t: 'Call Priya',                     sphere: 'relationships' as SphereId, time: '18:30', done: false, goal: 'g4' },
];

export const JOURNAL = [
  { id: 'j1', date: 'May 8', sentiment: 0.72,
    excerpt: 'Shipped the token migration. Felt steady today — like the work finally moves on its own momentum.' },
  { id: 'j2', date: 'May 7', sentiment: -0.18,
    excerpt: 'Missed Jordan\'s birthday call. Sat with the small guilt of it instead of pushing it away.' },
  { id: 'j3', date: 'May 6', sentiment: 0.41,
    excerpt: 'Long run hurt at mile four, then opened up. The body keeps surprising me when I let it.' },
  { id: 'j4', date: 'May 5', sentiment: 0.55,
    excerpt: 'Cut the gym I never use. Strange how a $42 cancellation feels bigger than it is.' },
];
