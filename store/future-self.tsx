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

export type FutureLetterHorizon = '1m' | '3m' | '6m' | '1y';
export type FutureLetterType = 'original' | 'quarterly_update' | 'yearend_reflection';

export type FutureLetter = {
  id: string;
  user_id: string;
  horizon: FutureLetterHorizon;
  letter_type: FutureLetterType;
  body: string;
  audio_url: string | null;
  period_label: string | null;
  created_at: string;
};

type FutureSelfContextValue = {
  letters: FutureLetter[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveLetter: (params: { horizon: FutureLetterHorizon; body: string }) => Promise<{ error: string | null }>;
  originalLetter: FutureLetter | null;
};

const FutureSelfContext = createContext<FutureSelfContextValue | null>(null);

const COLUMNS = 'id, user_id, horizon, letter_type, body, audio_url, period_label, created_at';

export function FutureSelfProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [letters, setLetters] = useState<FutureLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLetters = useCallback(async () => {
    if (!user) { setLetters([]); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('future_self_letters')
      .select(COLUMNS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setLetters((data ?? []) as FutureLetter[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLetters(); }, [fetchLetters]);

  const saveLetter = useCallback(async ({ horizon, body }: { horizon: FutureLetterHorizon; body: string }) => {
    if (!user) return { error: 'Not signed in' };
    const { data, error: err } = await supabase
      .from('future_self_letters')
      .insert({ user_id: user.id, horizon, body, letter_type: 'original' })
      .select(COLUMNS)
      .single();
    if (err) return { error: err.message };
    setLetters(prev => [data as FutureLetter, ...prev]);
    return { error: null };
  }, [user]);

  const originalLetter = useMemo(
    () => letters.find(l => l.letter_type === 'original') ?? null,
    [letters],
  );

  const value = useMemo<FutureSelfContextValue>(
    () => ({ letters, loading, error, refresh: fetchLetters, saveLetter, originalLetter }),
    [letters, loading, error, fetchLetters, saveLetter, originalLetter],
  );

  return <FutureSelfContext.Provider value={value}>{children}</FutureSelfContext.Provider>;
}

export function useFutureSelf(): FutureSelfContextValue {
  const ctx = useContext(FutureSelfContext);
  if (!ctx) throw new Error('useFutureSelf must be called inside <FutureSelfProvider>');
  return ctx;
}
