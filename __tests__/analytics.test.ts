jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { posthogApiKey: 'phc_test', posthogHost: 'https://eu.i.posthog.com' } } },
}));

const mockClient = {
  capture: jest.fn(), screen: jest.fn(), identify: jest.fn(), register: jest.fn(),
  reset: jest.fn(), optOut: jest.fn(() => Promise.resolve()), optIn: jest.fn(() => Promise.resolve()),
};
const mockCtor = jest.fn(() => mockClient);
jest.mock('posthog-react-native', () => ({ PostHog: mockCtor }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __resetForTests, getAnalyticsConsent, trackAccountDeleted, identify, initAnalytics, sanitize, screen, setAnalyticsConsent, stripUrls, track,
} from '../lib/analytics';

const flush = () => new Promise(r => setImmediate(r));

beforeEach(async () => {
  __resetForTests();
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('sanitize', () => {
  it('keeps numbers, booleans and enum-like strings', () => {
    expect(sanitize({ n: 3, b: false, s: 'chat_limit', route: 'vision/[goalid]' }))
      .toEqual({ n: 3, b: false, s: 'chat_limit', route: 'vision/[goalid]' });
  });
  it('drops free text, long strings, objects and non-finite numbers', () => {
    expect(sanitize({
      title: 'Run a marathon', email: 'a@b.co', upper: 'Health', long: 'x'.repeat(41),
      obj: { a: 1 }, nan: NaN, missing: undefined,
    })).toEqual({});
  });
  it('filters lists down to enum-like strings', () => {
    expect(sanitize({ fields: ['due', 'My secret title', 'sphere'] })).toEqual({ fields: ['due', 'sphere'] });
  });
});

describe('stripUrls', () => {
  it('removes URL properties the SDK adds to its own events', () => {
    expect(stripUrls({ event: 'Application Opened', properties: { url: 'goalify://vision/abc', $current_url: 'x', $os_name: 'iOS' } }))
      .toEqual({ event: 'Application Opened', properties: { $os_name: 'iOS' } });
    expect(stripUrls(null)).toBeNull();
  });
});

describe('consent', () => {
  it('buffers events until consent, then sends them in order', async () => {
    await initAnalytics();
    expect(getAnalyticsConsent()).toBe('unset');
    identify('11111111-1111-1111-1111-111111111111');
    track('signed_up', { method: 'email' });
    screen('onboarding/name');
    expect(mockCtor).not.toHaveBeenCalled();

    await setAnalyticsConsent(true);
    expect(mockCtor).toHaveBeenCalledTimes(1);
    expect(mockClient.identify).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', { $set: {}, $set_once: {} });
    expect(mockClient.capture.mock.calls.map(c => c[0])).toEqual(['signed_up', 'analytics_consent_changed']);
    expect(mockClient.screen).toHaveBeenCalledWith('onboarding/name', {});
    expect(await AsyncStorage.getItem('@goalify/analytics-consent')).toBe('granted');
  });

  it('drops buffered events and never creates a client when declined', async () => {
    await initAnalytics();
    track('signed_up', { method: 'email' });
    await setAnalyticsConsent(false);
    track('coach_message_sent');
    expect(mockCtor).not.toHaveBeenCalled();
    expect(getAnalyticsConsent()).toBe('denied');
  });

  it('restores a stored grant on launch and sends straight away', async () => {
    await AsyncStorage.setItem('@goalify/analytics-consent', 'granted');
    await initAnalytics();
    track('coach_message_sent');
    await flush();
    expect(mockClient.capture).toHaveBeenCalledWith('coach_message_sent', {});
  });

  it('opts out and resets the client when consent is withdrawn', async () => {
    await initAnalytics();
    await setAnalyticsConsent(true);
    await setAnalyticsConsent(false);
    expect(mockClient.reset).toHaveBeenCalled();
    expect(mockClient.optOut).toHaveBeenCalled();
    mockClient.capture.mockClear();
    track('coach_message_sent');
    expect(mockClient.capture).not.toHaveBeenCalled();
  });

  it('sends again after consent is withdrawn and then granted again', async () => {
    // optOut() is persisted by PostHog and survives reset(); the next client
    // would read it and drop everything unless it is opted back in.
    await initAnalytics();
    await setAnalyticsConsent(true);
    await setAnalyticsConsent(false);
    mockClient.optIn.mockClear();
    mockClient.capture.mockClear();

    await setAnalyticsConsent(true);
    track('coach_message_sent');

    expect(mockClient.optIn).toHaveBeenCalled();
    expect(mockClient.capture).toHaveBeenCalledWith('coach_message_sent', {});
  });

  it('account_deleted goes out under a fresh anonymous identity, after the reset', async () => {
    // The delete-account function already deleted the PostHog person; an event
    // on the old distinct id would create them again.
    await initAnalytics();
    await setAnalyticsConsent(true);
    const order: string[] = [];
    mockClient.reset.mockImplementation(() => { order.push('reset'); });
    mockClient.capture.mockImplementation((name: string) => { order.push(name); });

    trackAccountDeleted();

    expect(order).toEqual(['reset', 'account_deleted']);
  });

  it('strips free text even if a caller passes it', async () => {
    await initAnalytics();
    await setAnalyticsConsent(true);
    track('onboarding_step_completed', { step: 'Pulkit Sharma' as string });
    expect(mockClient.capture).toHaveBeenCalledWith('onboarding_step_completed', {});
  });
});
