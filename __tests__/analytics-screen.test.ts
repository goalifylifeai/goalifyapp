import { notificationKind, screenName } from '../lib/analytics-screen';

describe('screenName', () => {
  it('drops route groups and index', () => {
    expect(screenName(['(tabs)', 'journal'])).toBe('journal');
    expect(screenName(['(tabs)'])).toBe('home');
    expect(screenName(['(tabs)', 'index'])).toBe('home');
    expect(screenName(['(onboarding)', 'future-letter'])).toBe('future-letter');
    expect(screenName(['(auth)'])).toBe('auth');
  });
  it('keeps dynamic segments as templates, never ids', () => {
    expect(screenName(['vision', '[goalId]'])).toBe('vision/[goalid]');
    expect(screenName(['circles', '[id]'])).toBe('circles/[id]');
  });
});

describe('notificationKind', () => {
  it('maps identifiers to kinds without habit ids', () => {
    expect(notificationKind('ritual-morning')).toBe('morning');
    expect(notificationKind('habit-reminder-abc123')).toBe('habit_reminder');
    expect(notificationKind('trial-ending')).toBe('trial_ending');
    expect(notificationKind('something-else')).toBe('other');
  });
});
