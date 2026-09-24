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
import { track, setPersonProps } from '../lib/analytics';
import { useAuth } from './auth';
import {
  nextStep,
  type OnboardingStep,
  type OnboardingSelections,
} from './onboarding-machine';

export {
  STEP_ORDER,
  nextStep,
  mergeSelections,
  type OnboardingStep,
  type OnboardingSelections,
} from './onboarding-machine';

export type OnboardingState = {
  user_id: string;
  current_step: OnboardingStep;
  selections: OnboardingSelections;
  completed_at: string | null;
};

type OnboardingContextValue = {
  state: OnboardingState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  advance: (
    stepKey: keyof OnboardingSelections,
    value: OnboardingSelections[keyof OnboardingSelections],
  ) => Promise<{ error: string | null }>;
  complete: (final: OnboardingSelections) => Promise<{ error: string | null }>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const COLUMNS = 'user_id, current_step, selections, completed_at';

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keyed on the id, not the user object: that changes on every token refresh.
  const userId = user?.id ?? null;

  const fetchState = useCallback(async () => {
    if (!userId) {
      setState(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('onboarding_state')
      .select(COLUMNS)
      .eq('user_id', userId)
      .single();
    if (err) setError(err.message);
    else setState(data as OnboardingState);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // Don't route a newly signed-in account on the previous one's progress.
    setState(prev => (prev && prev.user_id !== userId ? null : prev));
    fetchState();
  }, [fetchState, userId]);

  const advance: OnboardingContextValue['advance'] = useCallback(
    async (stepKey, value) => {
      if (!user || !state) return { error: 'Not ready' };
      const merged: OnboardingSelections = { ...state.selections, [stepKey]: value };
      const next = nextStep(state.current_step);
      const { data, error: err } = await supabase
        .from('onboarding_state')
        .update({ current_step: next, selections: merged })
        .eq('user_id', user.id)
        .select(COLUMNS)
        .single();
      if (err) return { error: err.message };
      setState(data as OnboardingState);
      // advance() is also used after onboarding (e.g. adding a sphere from the welcome flow).
      if (state.current_step !== 'complete') {
        track('onboarding_step_completed', {
          step: state.current_step,
          ...(stepKey === 'spheres' ? { spheres_count: merged.spheres?.length ?? 0 } : {}),
          ...(stepKey === 'coaching_tone' && merged.coaching_tone ? { tone: merged.coaching_tone } : {}),
        });
      }
      return { error: null };
    },
    [user, state],
  );

  const complete: OnboardingContextValue['complete'] = useCallback(
    async (final) => {
      if (!user || !state) return { error: 'Not ready' };
      const merged = { ...state.selections, ...final };

      const { data, error: err } = await supabase
        .from('onboarding_state')
        .update({
          current_step: 'complete',
          selections: merged,
          completed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select(COLUMNS)
        .single();
      if (err) return { error: err.message };
      setState(data as OnboardingState);
      setPersonProps({
        onboarding_completed: true,
        spheres_count: merged.spheres?.length ?? 0,
        ...(merged.coaching_tone ? { onboarding_tone: merged.coaching_tone } : {}),
      });

      // Mirror display_name + pronouns into profile.
      const profilePatch: Record<string, unknown> = {};
      if (merged.display_name) profilePatch.display_name = merged.display_name;
      if (merged.pronouns !== undefined) profilePatch.pronouns = merged.pronouns || null;
      if (Object.keys(profilePatch).length > 0) {
        await supabase.from('profiles').update(profilePatch).eq('user_id', user.id);
      }

      return { error: null };
    },
    [user, state],
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({ state, loading, error, refresh: fetchState, advance, complete }),
    [state, loading, error, fetchState, advance, complete],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be called inside <OnboardingProvider>');
  return ctx;
}
