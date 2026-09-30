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
import { useAuth } from './auth';
import { useStore } from './index';

const LOCAL_SETTLE_MS = 2500;   // wait for fire-and-forget sync to land
const QUIET_MS = 2000;          // no local change for this long = safe to trust server
const RETRY_MS = 5000;

const kTotal = (uid: string) => `@goalify/xp_total:${uid}`;
const kSeenLevel = (uid: string) => `@goalify/xp_seen_level:${uid}`;
const kTimezone = (uid: string) => `@goalify/timezone:${uid}`;

type XpContextValue = {
  /** Server total + pending local estimate (never below 0). */
  total: number;
  /** True once a server total (or cached one) is known. */
  ready: boolean;
  refresh: () => Promise<void>;
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
    if (!uid) return;

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

  // Level-up tracking from server-confirmed XP only (no optimistic flicker).
  // First sight of a user records the level silently: no celebration for
  // levels gained through the migration backfill (FR-014).
  useEffect(() => {
    if (!uid || !confirmed || serverTotal == null) return;
    const level = levelFromXp(serverTotal).lvl.n;
    AsyncStorage.getItem(kSeenLevel(uid)).then(seen => {
      if (seen != null && level > Number(seen)) track('level_reached', { level });
      if (seen == null || level > Number(seen)) {
        AsyncStorage.setItem(kSeenLevel(uid), String(level)).catch(() => {});
      }
    }).catch(() => {});
  }, [uid, confirmed, serverTotal]);

  const value = useMemo<XpContextValue>(() => ({
    total: Math.max(0, (serverTotal ?? 0) + pending),
    ready: serverTotal != null,
    refresh: fetchTotal,
  }), [serverTotal, pending, fetchTotal]);

  return <XpContext.Provider value={value}>{children}</XpContext.Provider>;
}

export function useXp(): XpContextValue {
  const ctx = useContext(XpContext);
  if (!ctx) throw new Error('useXp must be called inside <XpProvider>');
  return ctx;
}

/** The one level everyone shows: Today, Profile, Level info. */
export function useLevel() {
  const { total } = useXp();
  const { state } = useStore();
  return levelFromXp(EARNED_XP ? total : legacyXpForGoals(state.goals));
}
