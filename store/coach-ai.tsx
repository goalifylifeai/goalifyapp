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
import type { SphereId } from '../constants/theme';

export type CoachInsight = { kind: 'pattern' | 'nudge' | 'win'; title: string; body: string };
export type CoachStat = { n: string; l: string };
export type CoachHighlight = { t: string; s: SphereId };
export type CoachNextStep = { title: string; when: string };

export type WeeklyReflection = {
  period: string;
  stats: CoachStat[];
  quote: string;
  wins: CoachHighlight[];
  challenges: CoachHighlight[];
  next_step: CoachNextStep;
};

type CoachAiContextValue = {
  insights: CoachInsight[] | null;
  insightsLoading: boolean;
  weekly: WeeklyReflection | null;
  weeklyLoading: boolean;
  refreshInsights: (force?: boolean) => void;
  refreshWeekly: (force?: boolean) => void;
  askCoach: (message: string) => Promise<string>;
};

const CoachAiContext = createContext<CoachAiContextValue | null>(null);

export function CoachAiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<CoachInsight[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyReflection | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  const invoke = useCallback((mode: string, extra?: Record<string, unknown>) => {
    return supabase.functions.invoke('ai-coach', { body: { mode, ...extra } });
  }, []);

  const refreshInsights = useCallback((force = false) => {
    if (!user) return;
    setInsightsLoading(true);
    invoke('insights', { force })
      .then(({ data, error }) => {
        if (error || !data) return;
        setInsights((data.content?.insights ?? null) as CoachInsight[] | null);
      })
      .finally(() => setInsightsLoading(false));
  }, [user, invoke]);

  const refreshWeekly = useCallback((force = false) => {
    if (!user) return;
    setWeeklyLoading(true);
    invoke('weekly', { force })
      .then(({ data, error }) => {
        if (error || !data) return;
        setWeekly((data.content ?? null) as WeeklyReflection | null);
      })
      .finally(() => setWeeklyLoading(false));
  }, [user, invoke]);

  const askCoach = useCallback(async (message: string): Promise<string> => {
    const { data, error } = await invoke('chat', { message });
    if (error || !data?.reply) {
      throw new Error(error?.message ?? 'The coach could not respond right now.');
    }
    return data.reply as string;
  }, [invoke]);

  useEffect(() => {
    if (!user) { setInsights(null); setWeekly(null); return; }
    refreshInsights();
    refreshWeekly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const value = useMemo<CoachAiContextValue>(() => ({
    insights, insightsLoading, weekly, weeklyLoading, refreshInsights, refreshWeekly, askCoach,
  }), [insights, insightsLoading, weekly, weeklyLoading, refreshInsights, refreshWeekly, askCoach]);

  return <CoachAiContext.Provider value={value}>{children}</CoachAiContext.Provider>;
}

export function useCoachAi(): CoachAiContextValue {
  const ctx = useContext(CoachAiContext);
  if (!ctx) throw new Error('useCoachAi must be called inside <CoachAiProvider>');
  return ctx;
}
