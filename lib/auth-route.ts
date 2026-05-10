// Pure routing decision for AuthGate. Returns the path to redirect to,
// or null if the user is already in the right place.

import type { OnboardingStep } from '../store/onboarding-machine';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';
export type RouteGroup = '(auth)' | '(onboarding)' | '(tabs)' | string | undefined;

export type GateInput = {
  status: AuthStatus;
  currentGroup: RouteGroup;
  onboardingLoaded: boolean;
  onboardingCompleted: boolean;
  currentStep: OnboardingStep | null;
};

const STEP_ROUTE: Record<Exclude<OnboardingStep, 'complete'>, string> = {
  name: '/(onboarding)/name',
  spheres: '/(onboarding)/spheres',
  tone: '/(onboarding)/tone',
  pronouns: '/(onboarding)/pronouns',
  future_letter: '/(onboarding)/future-letter',
};

export function decideRoute(input: GateInput): string | null {
  if (input.status === 'loading') return null;

  if (input.status === 'signed-out') {
    return input.currentGroup === '(auth)' ? null : '/(auth)';
  }

  // signed-in
  if (!input.onboardingLoaded) return null;

  if (!input.onboardingCompleted) {
    if (!input.currentStep || input.currentStep === 'complete') return null;
    return STEP_ROUTE[input.currentStep];
  }

  // completed
  if (input.currentGroup === '(auth)' || input.currentGroup === '(onboarding)') {
    return '/(tabs)';
  }
  return null;
}
