"""XP economy + rest-day Monte-Carlo for specs/010-gamification-foundation.
Run: python3 xp-sim.py   (stdlib only, deterministic seeds)"""
import random, statistics as st
LEVELS = [0, 300, 900, 2000, 4200, 7500, 12000, 20000]   # constants/data.ts LEVELS
MIL = {7: 50, 30: 200, 100: 500, 365: 1500}
P = {  # p = share of active days; sub/hab = mean per active day; others = probability; goal = every n active days
  'light':   dict(p=0.40, sub=1, hab=2, lock=.9, must=.6,  close=.3, jour=.2, goal=40),
  'regular': dict(p=0.75, sub=2, hab=3, lock=1,  must=.8,  close=.7, jour=.5, goal=20),
  'power':   dict(p=0.95, sub=5, hab=6, lock=1,  must=.95, close=.9, jour=.9, goal=10),
}
def run(pp, every=7, cap=1, rest=True, firsts=True, days=730, seed=0):
  r = random.Random(seed); xp = streak = tokens = best = an = 0; reached = {}; seen = set()
  for d in range(1, days + 1):
    if r.random() < pp['p']:
      an += 1
      s = min(r.randint(0, 2 * pp['sub']), 10); h = min(r.randint(0, 2 * pp['hab']), 10)
      xp += s * 10 + h * 5
      got = {'sub': s > 0, 'hab': h > 0}
      for k, v in (('lock', 15), ('must', 15), ('close', 20), ('jour', 10)):
        if r.random() < pp[k]: xp += v; got[k] = True
      if an % pp['goal'] == 0: xp += 100; got['goal'] = True
      if firsts:
        for k, g in got.items():
          if g and k not in seen: seen.add(k); xp += 50
      streak += 1
      if rest and streak % every == 0: tokens = min(cap, tokens + 1)
      if streak in MIL and streak > best: xp += MIL[streak]
      best = max(best, streak)
    elif rest and tokens: tokens -= 1
    else: streak = 0
    for i, m in enumerate(LEVELS):
      if xp >= m and i + 1 not in reached: reached[i + 1] = d
  return reached, best
med = lambda xs: st.median(xs)
print('Median day each level is reached (firsts on, rest 7/1):')
for n, pp in P.items():
  res = [run(pp, seed=s) for s in range(300)]
  print(f'  {n:8}', {L: (int(med([r[0].get(L, 9999) for r in res])) if med([r[0].get(L, 9999) for r in res]) < 9999 else '>2y') for L in range(2, 9)})
print('Median best streak over 2 years:')
for label, kw in (('none', dict(rest=False)), ('7/hold2', dict(every=7, cap=2)), ('7/hold1', dict(every=7, cap=1)), ('14/hold1', dict(every=14, cap=1))):
  print(f'  {label:9}', {n: med([run(pp, seed=s, **kw)[1] for s in range(300)]) for n, pp in P.items()})
