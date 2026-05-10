import { nextStep, mergeSelections, STEP_ORDER, type OnboardingSelections } from '../store/onboarding-machine';

describe('onboarding step machine', () => {
  it('advances forward through every step', () => {
    expect(nextStep('name')).toBe('spheres');
    expect(nextStep('spheres')).toBe('tone');
    expect(nextStep('tone')).toBe('pronouns');
    expect(nextStep('pronouns')).toBe('future_letter');
    expect(nextStep('future_letter')).toBe('complete');
  });

  it('clamps at complete', () => {
    expect(nextStep('complete')).toBe('complete');
  });

  it('STEP_ORDER ends with complete', () => {
    expect(STEP_ORDER[STEP_ORDER.length - 1]).toBe('complete');
  });
});

describe('mergeSelections', () => {
  it('inserts a key into an empty selections object', () => {
    const next = mergeSelections({}, 'display_name', 'Maya');
    expect(next).toEqual({ display_name: 'Maya' });
  });

  it('overwrites an existing key (last write wins)', () => {
    const prev: OnboardingSelections = { display_name: 'Old', spheres: ['health'] };
    const next = mergeSelections(prev, 'display_name', 'New');
    expect(next.display_name).toBe('New');
    expect(next.spheres).toEqual(['health']);
  });

  it('does not mutate the input', () => {
    const prev: OnboardingSelections = { display_name: 'Maya' };
    const snapshot = { ...prev };
    mergeSelections(prev, 'pronouns', 'they/them');
    expect(prev).toEqual(snapshot);
  });
});
