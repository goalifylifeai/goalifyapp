// ── Mocks ─────────────────────────────────────────────────────────
let mockScheduled: { identifier: string }[] = [];

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockImplementation(({ identifier }: { identifier: string }) => {
    mockScheduled = mockScheduled.filter(n => n.identifier !== identifier);
    mockScheduled.push({ identifier });
    return Promise.resolve(identifier);
  }),
  cancelScheduledNotificationAsync: jest.fn().mockImplementation((identifier: string) => {
    mockScheduled = mockScheduled.filter(n => n.identifier !== identifier);
    return Promise.resolve();
  }),
  getAllScheduledNotificationsAsync: jest.fn().mockImplementation(() => Promise.resolve(mockScheduled)),
  SchedulableTriggerInputTypes: { CALENDAR: 'calendar', DAILY: 'daily', DATE: 'date' },
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('../lib/notification-prefs', () => ({
  getNotificationTimes: jest.fn().mockResolvedValue({ morningHour: 7, morningMinute: 0, eveningHour: 21, eveningMinute: 0 }),
}));

import * as Notifications from 'expo-notifications';
import {
  scheduleHabitReminder,
  cancelHabitReminder,
  ensureHabitRemindersScheduled,
  scheduleMorningNotification,
  scheduleLunchNudge,
  scheduleEveningClose,
} from '../lib/notifications';

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(() => {
  mockScheduled = [];
  jest.clearAllMocks();
});

// ── Cross-platform trigger regression guard ─────────────────────────
// SchedulableTriggerInputTypes.CALENDAR is iOS-only ("Trigger of type:
// calendar is not supported on Android"). Every repeating daily notification
// must use DAILY, and the one-time lunch nudge must use DATE, never CALENDAR.
describe('daily notification triggers (Android compatibility)', () => {
  it('scheduleMorningNotification uses a DAILY trigger, not CALENDAR', async () => {
    await scheduleMorningNotification();
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: { type: 'daily', hour: 7, minute: 0 } }),
    );
  });

  it('scheduleEveningClose uses a DAILY trigger, not CALENDAR', async () => {
    await scheduleEveningClose();
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: { type: 'daily', hour: 21, minute: 0 } }),
    );
  });

  it('scheduleLunchNudge uses a one-time DATE trigger, not CALENDAR', async () => {
    await scheduleLunchNudge();
    const call = mockNotifications.scheduleNotificationAsync.mock.calls[0][0];
    const trigger = call.trigger as { type: string; date: unknown };
    expect(trigger.type).toBe('date');
    expect(trigger.date).toBeInstanceOf(Date);
  });
});

// ── scheduleHabitReminder ──────────────────────────────────────────
describe('scheduleHabitReminder', () => {
  it('schedules a daily-repeating notification at the given time (Android has no CALENDAR trigger)', async () => {
    await scheduleHabitReminder('h1', 'Meditate', 8, 30);
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'habit-reminder-h1',
        trigger: { type: 'daily', hour: 8, minute: 30 },
      }),
    );
  });

  it('cancels any existing reminder for the habit before scheduling a new one', async () => {
    await scheduleHabitReminder('h1', 'Meditate', 8, 0);
    await scheduleHabitReminder('h1', 'Meditate', 9, 0);
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit-reminder-h1');
    const scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
    expect(scheduled.filter(n => n.identifier === 'habit-reminder-h1')).toHaveLength(1);
  });
});

// ── cancelHabitReminder ─────────────────────────────────────────────
describe('cancelHabitReminder', () => {
  it('cancels the notification for the given habit id', async () => {
    await scheduleHabitReminder('h1', 'Meditate', 8, 0);
    await cancelHabitReminder('h1');
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit-reminder-h1');
    const scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
    expect(scheduled).toHaveLength(0);
  });
});

// ── ensureHabitRemindersScheduled ────────────────────────────────────
describe('ensureHabitRemindersScheduled', () => {
  it('schedules reminders for habits with a reminder time that are not yet scheduled', async () => {
    await ensureHabitRemindersScheduled([
      { id: 'h1', label: 'Meditate', reminderHour: 8, reminderMinute: 0 },
      { id: 'h2', label: 'Journal', reminderHour: null, reminderMinute: null },
    ]);
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
    expect(scheduled.map(n => n.identifier)).toEqual(['habit-reminder-h1']);
  });

  it('does not reschedule a habit reminder that is already scheduled', async () => {
    await scheduleHabitReminder('h1', 'Meditate', 8, 0);
    jest.clearAllMocks();
    await ensureHabitRemindersScheduled([{ id: 'h1', label: 'Meditate', reminderHour: 8, reminderMinute: 0 }]);
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels stale reminders for habits that no longer have one set', async () => {
    await scheduleHabitReminder('h1', 'Meditate', 8, 0);
    await scheduleHabitReminder('h2', 'Journal', 9, 0);
    jest.clearAllMocks();
    await ensureHabitRemindersScheduled([{ id: 'h1', label: 'Meditate', reminderHour: 8, reminderMinute: 0 }]);
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit-reminder-h2');
    const scheduled = await mockNotifications.getAllScheduledNotificationsAsync();
    expect(scheduled.map(n => n.identifier)).toEqual(['habit-reminder-h1']);
  });

  it('does nothing when notification permission is not granted', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as any);
    await ensureHabitRemindersScheduled([{ id: 'h1', label: 'Meditate', reminderHour: 8, reminderMinute: 0 }]);
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
