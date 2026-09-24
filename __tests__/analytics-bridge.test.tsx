// AnalyticsBridge re-sends identity and plan when consent comes back after a
// denial: while denied, run() drops those calls instead of buffering them.

let mockConsent = 'denied';
jest.mock('../lib/analytics', () => ({
  identify: jest.fn(), initAnalytics: jest.fn(), registerSuperProps: jest.fn(), resetAnalytics: jest.fn(),
  screen: jest.fn(), setPersonProps: jest.fn(),
  useAnalyticsConsent: () => mockConsent,
}));
jest.mock('expo-router', () => ({ usePathname: () => '/goals', useSegments: () => ['(tabs)', 'goals'] }));
jest.mock('../store/auth', () => ({ useAuth: () => ({ user: { id: 'user-1', created_at: '2026-05-10T00:00:00Z' } }) }));
jest.mock('../store/plan', () => ({
  usePlan: () => ({ loaded: true, confirmed: true, plan: 'free', isTrial: false, willRenew: false, store: null, available: false }),
}));
jest.mock('../store', () => ({ useStore: () => ({ state: { goals: [], habits: [] } }) }));
jest.mock('../lib/analytics-screen', () => ({ screenName: () => 'goals' }));
jest.mock('../lib/purchases', () => ({ setAnalyticsConsentAttribute: jest.fn() }));

import React from 'react';
import { render } from '@testing-library/react-native';
import { AnalyticsBridge } from '../components/analytics/AnalyticsBridge';

const analytics = () => jest.requireMock('../lib/analytics');

describe('AnalyticsBridge', () => {
  beforeEach(() => { jest.clearAllMocks(); mockConsent = 'denied'; });

  it('identifies the user and re-registers the plan when consent is granted after a denial', () => {
    const view = render(<AnalyticsBridge />);
    analytics().identify.mockClear();
    analytics().registerSuperProps.mockClear();

    mockConsent = 'granted';
    view.rerender(<AnalyticsBridge />);

    expect(analytics().identify).toHaveBeenCalledWith('user-1', {}, { signup_date: '2026-05-10' });
    expect(analytics().registerSuperProps).toHaveBeenCalledWith({ plan: 'free', is_trial: false });
    expect(analytics().resetAnalytics).not.toHaveBeenCalled();
  });

  it('does not re-identify on the first-launch grant, where calls were buffered', () => {
    mockConsent = 'unset';
    const view = render(<AnalyticsBridge />);
    expect(analytics().identify).toHaveBeenCalledTimes(1);

    mockConsent = 'granted';
    view.rerender(<AnalyticsBridge />);
    expect(analytics().identify).toHaveBeenCalledTimes(1);
  });
});
