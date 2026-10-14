// Earned XP and level (spec 010, FR-001, FR-008, FR-010, FR-014).
//
// The server ledger (view public.user_xp) is the source of truth. Local
// changes add an estimated `pending` amount on top so progress feels instant
// and works offline; each server fetch reconciles it.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { supabase } from '../lib/supabase';
import { getQueue } from '../lib/offline-queue';
import { onXpChange } from '../lib/xp';
import { track } from '../lib/analytics';
import { EARNED_XP } from '../constants/flags';
import { levelFromXp, legacyXpForGoals } from '../constants/data';
import { afterDismiss, decideMoment, type Moment, type Seen } from '../lib/moments';
import { useAuth } from './auth';
import { useStore } from './index';

const LOCAL_SETTLE_MS = 2500;   // wait for fire-and-forget sync to land
const QUIET_MS = 2000;          // no local change for this long = safe to trust server
const RETRY_MS = 5000;

const kTotal = (uid: string) => `@goalify/xp_total:${uid}`;
const kSeenLevel = (uid: string) => `@goalify/xp_seen_level:${uid}`;
const kSeenAchievements = (uid: string) => `@goalify/achievements_seen:${uid}`;
const kTimezone = (uid: string) => `@goalify/timezone:${uid}`;

export type UnlockedAchievement = { key: string; unlockedAt: string };

type XpContextValue = {
  /** Server total + pending local estimate (never below 0). */
  total: number;
  /** True once a server total (or cached one) is known. */
  ready: boolean;
  refresh: () => Promise<void>;
  /** Achievements unlocked on the server (spec 012), [] until loaded. */
  achievements: UnlockedAchievement[];
  /** Level-up / new achievements waiting to be celebrated, or null. */
  moment: Moment | null;
  dismissMoment: () => void;
};

const XpContext = createContext<XpContextValue | null>(null);

function deviceTimezone(): string | null {
  try {
    return Localization.getCalendars()[0]?.timeZone ?? null;
  } catch {
    return null;
  }
}

export function XpProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  // null = not loaded yet (or the read failed): see lib/moments decideMoment.
  const [achievements, setAchievements] = useState<UnlockedAchievement[] | null>(null);
  const [seen, setSeen] = useState<Seen | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const serverRef = useRef<number | null>(null);
  const lastLocalRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uidRef = useRef<string | null>(uid);
  uidRef.current = uid;

  const fetchTotal = useCallback(async () => {
    const forUid = uidRef.current;
    if (!forUid) return;
    const { data, error } = await supabase.from('user_xp').select('total').maybeSingle();
    if (error || uidRef.current !== forUid) return;
    const next = (data?.total as number | undefined) ?? 0;
    const gain = serverRef.current == null ? 0 : next - serverRef.current;
    serverRef.current = next;
    setServerTotal(next);
    setConfirmed(true);
    AsyncStorage.setItem(kTotal(forUid), String(next)).catch(() => {});

    // Achievements ride along with every total fetch (same triggers). A
    // failure leaves the previous value (or "unknown") in place.
    try {
      const ach = await supabase.from('user_achievements').select('key, unlocked_at');
      if (!ach.error && uidRef.current === forUid) {
        setAchievements((ach.data ?? []).map(r => ({ key: r.key as string, unlockedAt: r.unlocked_at as string })));
      }
    } catch { /* keep going: pending reconciliation below must still run */ }

    const queue = await getQueue().catch(() => []);
    const mine = queue.filter(q => (q.owner ?? q.payload.user_id) === forUid);
    const quiet = Date.now() - lastLocalRef.current > QUIET_MS;
    setPending(p => {
      if (mine.length === 0 && quiet) return 0;
      const left = p > 0 ? Math.max(0, p - Math.max(0, gain)) : p;
      if (left !== 0) schedule(RETRY_MS);
      return left;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedule = useCallback((ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { fetchTotal().catch(() => {}); }, ms);
  }, [fetchTotal]);

  // Sign-in / sign-out: load cache, then server. Keep the device's time zone
  // on the profile so the server's "today" matches the user's (FR-009).
  useEffect(() => {
    serverRef.current = null;
    setServerTotal(null);
    setConfirmed(false);
    setPending(0);
    setAchievements(null);
    setSeen(null);
    setMoment(null);
    if (!uid) return;

    Promise.all([AsyncStorage.getItem(kSeenLevel(uid)), AsyncStorage.getItem(kSeenAchievements(uid))])
      .then(([lvl, ach]) => {
        if (uidRef.current !== uid) return;
        let list: string[] | null = null;
        try { list = ach == null ? null : (JSON.parse(ach) as string[]); } catch { list = null; }
        setSeen({ level: lvl == null ? null : Number(lvl), achievements: list });
      })
      .catch(() => { if (uidRef.current === uid) setSeen({ level: null, achievements: null }); });

    AsyncStorage.getItem(kTotal(uid)).then(v => {
      if (v != null && serverRef.current == null && uidRef.current === uid) setServerTotal(Number(v));
    }).catch(() => {});
    fetchTotal().catch(() => {});

    const tz = deviceTimezone();
    if (tz) {
      AsyncStorage.getItem(kTimezone(uid)).then(async saved => {
        if (saved === tz) return;
        const { error } = await supabase.from('profiles').update({ timezone: tz }).eq('user_id', uid);
        if (!error) AsyncStorage.setItem(kTimezone(uid), tz).catch(() => {});
      }).catch(() => {});
    }
  }, [uid, fetchTotal]);

  // Local changes and refresh requests.
  useEffect(() => onXpChange(ev => {
    if ('delta' in ev) {
      lastLocalRef.current = Date.now();
      setPending(p => p + ev.delta);
      schedule(LOCAL_SETTLE_MS);
    } else {
      schedule(500);
    }
  }), [schedule]);

  // Back to foreground: refetch (other devices, travel/time zone change).
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') schedule(0);
    });
    return () => {
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [schedule]);

  // Level-ups and new achievements, from server-confirmed data only (no
  // optimistic flicker). First sight of a user on this device records what's
  // already earned silently: no celebration for levels or achievements gained
  // through a backfill (010 FR-014, 012 AS1.3). Seen state advances only when
  // the moment is dismissed, so a moment survives an app restart.
  useEffect(() => {
    if (!uid || !confirmed || serverTotal == null || !seen) return;
    const level = EARNED_XP ? levelFromXp(serverTotal).lvl.n : (seen.level ?? 1);
    const { seed, moment: next } = decideMoment(
      { level, achievements: achievements ? achievements.map(a => a.key) : null }, seen,
    );
    if (seed.level !== undefined || seed.achievements !== undefined) {
      const nextSeen: Seen = {
        level: seed.level ?? seen.level,
        achievements: seed.achievements ?? seen.achievements,
      };
      if (seed.level !== undefined) AsyncStorage.setItem(kSeenLevel(uid), String(seed.level)).catch(() => {});
      if (seed.achievements !== undefined) {
        AsyncStorage.setItem(kSeenAchievements(uid), JSON.stringify(seed.achievements)).catch(() => {});
      }
      setSeen(nextSeen);
      return; // re-runs with the seeded state
    }
    setMoment(next);
  }, [uid, confirmed, serverTotal, achievements, seen]);

  const dismissMoment = useCallback(() => {
    if (!uid || !moment || !seen) { setMoment(null); return; }
    if (moment.level !== null) track('level_reached', { level: moment.level });
    for (const key of moment.achievements) track('achievement_unlocked', { achievement: key });
    const next = afterDismiss(seen, moment, (achievements ?? []).map(a => a.key));
    if (next.level !== null) AsyncStorage.setItem(kSeenLevel(uid), String(next.level)).catch(() => {});
    // Achievements still unknown: don't record a seen list yet (it would hide
    // everything unlocked so far once they do load).
    if (achievements !== null || seen.achievements !== null) {
      AsyncStorage.setItem(kSeenAchievements(uid), JSON.stringify(next.achievements)).catch(() => {});
    }
    setMoment(null);
    setSeen({ level: next.level, achievements: achievements !== null || seen.achievements !== null ? next.achievements : null });
  }, [uid, moment, seen, achievements]);

  const value = useMemo<XpContextValue>(() => ({
    total: Math.max(0, (serverTotal ?? 0) + pending),
    ready: serverTotal != null,
    refresh: fetchTotal,
    achievements: achievements ?? [],
    moment,
    dismissMoment,
  }), [serverTotal, pending, fetchTotal, achievements, moment, dismissMoment]);

  return <XpContext.Provider value={value}>{children}</XpContext.Provider>;
}

export function useXp(): XpContextValue {
  const ctx = useContext(XpContext);
  if (!ctx) throw new Error('useXp must be called inside <XpProvider>');
  return ctx;
}

/** The one level everyone shows: Today, Profile, Level info. */
export function useLevel() {
  const { total, ready } = useXp();
  const { state } = useStore();
  // Until a server (or cached) total is known — e.g. the app shipped before
  // migrations 0026–0028 were applied — show the old level rather than
  // flashing everyone down to Level 1.
  const xp = EARNED_XP && ready ? total : legacyXpForGoals(state.goals);
  return { ...levelFromXp(xp), xp };
}
