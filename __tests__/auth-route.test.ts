import { decideRoute } from '../lib/auth-route';

describe('decideRoute (AuthGate)', () => {
  it('does nothing while loading', () => {
    expect(
      decideRoute({
        status: 'loading',
        currentGroup: '(auth)',
        onboardingLoaded: false,
        onboardingCompleted: false,
        currentStep: null,
      }),
    ).toBeNull();
  });

  it('signed-out user inside (tabs) is redirected to (auth)', () => {
    expect(
      decideRoute({
        status: 'signed-out',
        currentGroup: '(tabs)',
        onboardingLoaded: false,
        onboardingCompleted: false,
        currentStep: null,
      }),
    ).toBe('/(auth)');
  });

  it('signed-out user already in (auth) is left alone', () => {
    expect(
      decideRoute({
        status: 'signed-out',
        currentGroup: '(auth)',
        onboardingLoaded: false,
        onboardingCompleted: false,
        currentStep: null,
      }),
    ).toBeNull();
  });

  it('signed-in user with onboarding still loading waits', () => {
    expect(
      decideRoute({
        status: 'signed-in',
        currentGroup: '(auth)',
        onboardingLoaded: false,
        onboardingCompleted: false,
        currentStep: null,
      }),
    ).toBeNull();
  });

  it('signed-in but not completed routes to current step', () => {
    expect(
      decideRoute({
        status: 'signed-in',
        currentGroup: '(auth)',
        onboardingLoaded: true,
        onboardingCompleted: false,
        currentStep: 'spheres',
      }),
    ).toBe('/(onboarding)/spheres');
  });

  it('signed-in + completed user inside (auth) goes to (tabs)', () => {
    expect(
      decideRoute({
        status: 'signed-in',
        currentGroup: '(auth)',
        onboardingLoaded: true,
        onboardingCompleted: true,
        currentStep: 'complete',
      }),
    ).toBe('/(tabs)');
  });

  it('signed-in + completed user already in (tabs) is left alone', () => {
    expect(
      decideRoute({
        status: 'signed-in',
        currentGroup: '(tabs)',
        onboardingLoaded: true,
        onboardingCompleted: true,
        currentStep: 'complete',
      }),
    ).toBeNull();
  });

  it('signed-in + completed user inside (onboarding) goes to (tabs)', () => {
    expect(
      decideRoute({
        status: 'signed-in',
        currentGroup: '(onboarding)',
        onboardingLoaded: true,
        onboardingCompleted: true,
        currentStep: 'complete',
      }),
    ).toBe('/(tabs)');
  });
});
