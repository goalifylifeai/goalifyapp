// ── Mocks ─────────────────────────────────────────────────────────
const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => { store[key] = value; return Promise.resolve(); }),
}));

import {
  getNotificationTimes,
  saveNotificationTimes,
  DEFAULT_NOTIFICATION_TIMES,
} from '../lib/notification-prefs';

const KEY = '@goalify/notification_times';

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  jest.clearAllMocks();
});

// ── getNotificationTimes ──────────────────────────────────────────
describe('getNotificationTimes', () => {
  it('returns defaults when nothing is stored', async () => {
    const times = await getNotificationTimes();
    expect(times).toEqual(DEFAULT_NOTIFICATION_TIMES);
  });

  it('returns stored values when present', async () => {
    store[KEY] = JSON.stringify({ morningHour: 7, morningMinute: 30, eveningHour: 22, eveningMinute: 0 });
    const times = await getNotificationTimes();
    expect(times).toEqual({ morningHour: 7, morningMinute: 30, eveningHour: 22, eveningMinute: 0 });
  });

  it('merges stored partial values with defaults', async () => {
    store[KEY] = JSON.stringify({ morningHour: 8 });
    const times = await getNotificationTimes();
    expect(times.morningHour).toBe(8);
    expect(times.morningMinute).toBe(DEFAULT_NOTIFICATION_TIMES.morningMinute);
    expect(times.eveningHour).toBe(DEFAULT_NOTIFICATION_TIMES.eveningHour);
    expect(times.eveningMinute).toBe(DEFAULT_NOTIFICATION_TIMES.eveningMinute);
  });

  it('returns defaults when stored JSON is corrupt', async () => {
    store[KEY] = 'not-valid-json{{';
    const times = await getNotificationTimes();
    expect(times).toEqual(DEFAULT_NOTIFICATION_TIMES);
  });
});

// ── saveNotificationTimes ─────────────────────────────────────────
describe('saveNotificationTimes', () => {
  it('persists a full set of times', async () => {
    await saveNotificationTimes({ morningHour: 5, morningMinute: 45, eveningHour: 20, eveningMinute: 15 });
    const stored = JSON.parse(store[KEY]);
    expect(stored).toMatchObject({ morningHour: 5, morningMinute: 45, eveningHour: 20, eveningMinute: 15 });
  });

  it('merges a partial update without overwriting other fields', async () => {
    store[KEY] = JSON.stringify({ morningHour: 7, morningMinute: 0, eveningHour: 21, eveningMinute: 30 });
    await saveNotificationTimes({ morningHour: 9 });
    const stored = JSON.parse(store[KEY]);
    expect(stored.morningHour).toBe(9);
    expect(stored.morningMinute).toBe(0);
    expect(stored.eveningHour).toBe(21);
    expect(stored.eveningMinute).toBe(30);
  });

  it('can be read back correctly after saving', async () => {
    await saveNotificationTimes({ eveningHour: 23, eveningMinute: 59 });
    const times = await getNotificationTimes();
    expect(times.eveningHour).toBe(23);
    expect(times.eveningMinute).toBe(59);
  });

  it('saves over a previously stored value', async () => {
    await saveNotificationTimes({ morningHour: 6 });
    await saveNotificationTimes({ morningHour: 8 });
    const times = await getNotificationTimes();
    expect(times.morningHour).toBe(8);
  });
});
