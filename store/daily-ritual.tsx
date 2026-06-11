import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';
import { localDateISO, addDaysISO } from '../lib/date';
import { buildWidgetSnapshot, activeDatesFromIntentions } from '../lib/widget-snapshot';
import { writeWidgetSnapshot } from '../lib/widget-bridge';
import type { SphereId } from '../constants/theme';

export type RitualActionSource = 'goal_subtask' | 'habit' | 'free';

export type RitualAction = {
  id: string;
  text: string;
  sphere: SphereId;
  is_must_do: boolean;
  done: boolean;
  source: RitualActionSource;
};

export type DailyIntention = {
  id: string;
  user_id: string;
  date: string;
  focus_sphere: SphereId;
  actions: RitualAction[];
  must_do_done: boolean;
  journal_line: string | null;
  next_sphere: SphereId | null;
  closed_at: string | null;
  created_at: string;
};

type DailyRitualContextValue = {
  intention: DailyIntention | null;
  loading: boolean;
  error: string | null;
  isMorningDone: boolean;
  isEveningDone: boolean;
  /** Consecutive days the ritual was completed, ending today. */
  streak: number;
  /** Local YYYY-MM-DD dates that count toward the streak (for calendars/grids). */
  activeDates: string[];
  yesterdayNextSphere: SphereId | null;
  lockMorning: (sphere: SphereId, actions: RitualAction[]) => Promise<{ error: string | null }>;
  toggleRitualAction: (actionId: string) => Promise<void>;
  closeEvening: (journalLine: string, nextSphere: SphereId) => Promise<{ error: string | null }>;
  refresh: () => Promise<void>;
};

const DailyRitualContext = createContext<DailyRitualContextValue | null>(null);

const COLUMNS = 'id, user_id, date, focus_sphere, actions, must_do_done, journal_line, next_sphere, closed_at, created_at';

function todayDate(): string {
  return localDateISO();
}

function yesterdayDate(): string {
  return addDaysISO(localDateISO(), -1);
}

export function DailyRitualProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [intention, setIntention] = useState<DailyIntention | null>(null);
  const [yesterdayNextSphere, setYesterdayNextSphere] = useState<SphereId | null>(null);
  // Past days (excluding today) used to compute the streak. Today is layered on
  // from the live `intention` so toggles update the streak immediately.
  const [pastActiveDates, setPastActiveDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchToday = useCallback(async () => {
    if (!user) { setIntention(null); setPastActiveDates([]); return; }
    setLoading(true);
    setError(null);

    const today = todayDate();
    const yesterday = yesterdayDate();
    const since = addDaysISO(today, -400);

    const [todayRes, yesterdayRes, historyRes] = await Promise.all([
      supabase.from('daily_intentions').select(COLUMNS).eq('user_id', user.id).eq('date', today).maybeSingle(),
      supabase.from('daily_intentions').select('next_sphere').eq('user_id', user.id).eq('date', yesterday).maybeSingle(),
      supabase.from('daily_intentions')
        .select('date, must_do_done, closed_at')
        .eq('user_id', user.id)
        .gte('date', since)
        .lt('date', today),
    ]);

    if (todayRes.error) setError(todayRes.error.message);
    else setIntention((todayRes.data ?? null) as DailyIntention | null);

    if (yesterdayRes.data?.next_sphere) {
      setYesterdayNextSphere(yesterdayRes.data.next_sphere as SphereId);
    }

    setPastActiveDates(activeDatesFromIntentions(historyRes.data ?? []));

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  // Real streak + widget snapshot, derived from past active days plus today's
  // live ritual state. Recomputes on every toggle/close so the number is honest.
  const { snapshot, streak, activeDates } = useMemo(() => {
    const today = todayDate();
    const todayActive = !!(intention && (intention.must_do_done || intention.closed_at));
    const dates = todayActive ? [...pastActiveDates, today] : pastActiveDates;
    const snap = buildWidgetSnapshot({ intention, activeDates: dates, today });
    return { snapshot: snap, streak: snap.streak, activeDates: dates };
  }, [intention, pastActiveDates]);

  useEffect(() => { writeWidgetSnapshot(snapshot); }, [snapshot]);

  const lockMorning = useCallback(async (sphere: SphereId, actions: RitualAction[]) => {
    if (!user) return { error: 'Not signed in' };
    const today = todayDate();
    const mustDoDone = actions.some(a => a.is_must_do && a.done);

    const { data, error: err } = await supabase
      .from('daily_intentions')
      .upsert(
        { user_id: user.id, date: today, focus_sphere: sphere, actions, must_do_done: mustDoDone },
        { onConflict: 'user_id,date', ignoreDuplicates: false },
      )
      .select(COLUMNS)
      .single();

    if (err) return { error: err.message };
    setIntention(data as DailyIntention);
    return { error: null };
  }, [user]);

  const toggleRitualAction = useCallback(async (actionId: string) => {
    if (!intention) return;
    const updated = intention.actions.map(a =>
      a.id === actionId ? { ...a, done: !a.done } : a,
    );
    const mustDoDone = updated.some(a => a.is_must_do && a.done);
    const optimistic: DailyIntention = { ...intention, actions: updated, must_do_done: mustDoDone };
    setIntention(optimistic);

    await supabase
      .from('daily_intentions')
      .update({ actions: updated, must_do_done: mustDoDone })
      .eq('id', intention.id);
  }, [intention]);

  const closeEvening = useCallback(async (journalLine: string, nextSphere: SphereId) => {
    if (!intention) return { error: 'No active intention' };
    if (intention.closed_at) return { error: null };

    const closedAt = new Date().toISOString();
    const { data, error: err } = await supabase
      .from('daily_intentions')
      .update({ journal_line: journalLine || null, next_sphere: nextSphere, closed_at: closedAt })
      .eq('id', intention.id)
      .select(COLUMNS)
      .single();

    if (err) return { error: err.message };
    setIntention(data as DailyIntention);
    return { error: null };
  }, [intention]);

  const isMorningDone = intention !== null;
  const isEveningDone = intention?.closed_at !== null && intention?.closed_at !== undefined;

  const value = useMemo<DailyRitualContextValue>(() => ({
    intention,
    loading,
    error,
    isMorningDone,
    isEveningDone,
    streak,
    activeDates,
    yesterdayNextSphere,
    lockMorning,
    toggleRitualAction,
    closeEvening,
    refresh: fetchToday,
  }), [intention, loading, error, isMorningDone, isEveningDone, streak, activeDates, yesterdayNextSphere, lockMorning, toggleRitualAction, closeEvening, fetchToday]);

  return <DailyRitualContext.Provider value={value}>{children}</DailyRitualContext.Provider>;
}

export function useDailyRitual(): DailyRitualContextValue {
  const ctx = useContext(DailyRitualContext);
  if (!ctx) throw new Error('useDailyRitual must be called inside <DailyRitualProvider>');
  return ctx;
}
