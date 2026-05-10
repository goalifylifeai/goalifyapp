// Pure helpers for the onboarding step machine. Lives outside store/onboarding.tsx
// so it can be imported in tests without pulling in supabase / RN.

import type { SphereId } from '../constants/theme';

export type OnboardingStep = 'name' | 'spheres' | 'tone' | 'pronouns' | 'future_letter' | 'complete';

export type OnboardingSelections = {
  display_name?: string;
  spheres?: SphereId[];
  coaching_tone?: 'warm' | 'direct' | 'playful';
  pronouns?: string;
};

export const STEP_ORDER: OnboardingStep[] = ['name', 'spheres', 'tone', 'pronouns', 'future_letter', 'complete'];

export function nextStep(step: OnboardingStep): OnboardingStep {
  const idx = STEP_ORDER.indexOf(step);
  return STEP_ORDER[Math.min(idx + 1, STEP_ORDER.length - 1)];
}

export function mergeSelections(
  prev: OnboardingSelections,
  key: keyof OnboardingSelections,
  value: OnboardingSelections[keyof OnboardingSelections],
): OnboardingSelections {
  return { ...prev, [key]: value };
}
