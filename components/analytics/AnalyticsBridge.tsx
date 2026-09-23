// Renders nothing. Keeps PostHog in step with the app: who the user is, their
// plan (as super properties on every event), a few counts, and screen views.

import { useEffect, useRef } from 'react';
import { usePathname, useSegments } from 'expo-router';
import { useAuth } from '../../store/auth';
import { usePlan } from '../../store/plan';
import { useStore } from '../../store';
import {
  identify, initAnalytics, registerSuperProps, resetAnalytics, screen, setPersonProps, useAnalyticsConsent,
} from '../../lib/analytics';
import { screenName } from '../../lib/analytics-screen';
import { setAnalyticsConsentAttribute } from '../../lib/purchases';

export function AnalyticsBridge() {
  const { user } = useAuth();
  const plan = usePlan();
  const { state } = useStore();
  const consent = useAnalyticsConsent();
  const segments = useSegments();
  const pathname = usePathname();

  useEffect(() => { initAnalytics(); }, []);

  // Identity: identify on sign-in (and cold start with a session), reset on sign-out.
  const userId = user?.id ?? null;
  const signupDate = user?.created_at?.slice(0, 10);
  const lastUser = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastUser.current;
    lastUser.current = userId;
    if (userId && userId !== prev) {
      if (prev) resetAnalytics();
      identify(userId, {}, signupDate ? { signup_date: signupDate } : {});
    } else if (!userId && prev) {
      resetAnalytics();
    }
  }, [userId, signupDate]);

  // Plan: only once a source confirmed it, so an offline cold start's Free placeholder isn't recorded.
  useEffect(() => {
    if (!userId || !plan.loaded || !plan.confirmed) return;
    const props = { plan: plan.plan, is_trial: plan.isTrial };
    registerSuperProps(props);
    setPersonProps({
      ...props,
      will_renew: plan.willRenew,
      ...(plan.store ? { store: plan.store.toLowerCase() } : {}),
    });
  }, [userId, plan.loaded, plan.confirmed, plan.plan, plan.isTrial, plan.willRenew, plan.store]);

  const goals = state.goals.length;
  const habits = state.habits.length;
  useEffect(() => {
    if (!userId) return;
    setPersonProps({ goals_count: goals, habits_count: habits });
  }, [userId, goals, habits]);

  // The webhook reads this attribute before forwarding subscription events.
  useEffect(() => {
    if (!plan.available || (consent !== 'granted' && consent !== 'denied')) return;
    setAnalyticsConsentAttribute(consent === 'granted');
  }, [plan.available, consent]);

  // Screens: named from route templates (never resolved params), once per navigation.
  const name = screenName(segments);
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    screen(name);
  }, [pathname, name]);

  return null;
}
