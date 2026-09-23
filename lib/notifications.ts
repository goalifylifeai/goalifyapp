import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DailyIntention } from '../store/daily-ritual';
import { getNotificationTimes } from './notification-prefs';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const IDS = {
  morning: 'ritual-morning',
  lunch: 'ritual-lunch',
  evening: 'ritual-evening',
  sentimentCheckIn: 'sentiment-check-in',
  trialEnding: 'trial-ending',
} as const;

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function cancelNotification(id: string) {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

// `SchedulableTriggerInputTypes.CALENDAR` maps to iOS's UNCalendarNotificationTrigger
// and is not supported on Android (throws "Trigger of type: calendar is not
// supported on Android" at schedule time). DAILY is the cross-platform
// equivalent for a notification that repeats every day at hour:minute.
function dailyTrigger(hour: number, minute: number): Notifications.DailyTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute };
}

// One-time trigger for the next occurrence of hour:minute (today, or tomorrow
// if that time has already passed today) — the cross-platform equivalent of
// a non-repeating CALENDAR trigger with only hour/minute set.
function nextOccurrenceDateTrigger(hour: number, minute: number): Notifications.DateTriggerInput {
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target };
}

export async function scheduleMorningNotification() {
  const { morningHour, morningMinute } = await getNotificationTimes();
  await cancelNotification(IDS.morning);
  await Notifications.scheduleNotificationAsync({
    identifier: IDS.morning,
    content: {
      title: 'Good morning.',
      body: 'Pick today\'s One. 30 seconds, then you\'re set.',
      data: { screen: 'morning' },
    },
    trigger: dailyTrigger(morningHour, morningMinute),
  });
}

export async function scheduleLunchNudge() {
  await cancelNotification(IDS.lunch);
  await Notifications.scheduleNotificationAsync({
    identifier: IDS.lunch,
    content: {
      title: 'Your One still needs you.',
      body: 'Quick check-in?',
      data: { screen: 'morning' },
    },
    trigger: nextOccurrenceDateTrigger(12, 30),
  });
}

export async function scheduleEveningClose() {
  const { eveningHour, eveningMinute } = await getNotificationTimes();
  await cancelNotification(IDS.evening);
  await Notifications.scheduleNotificationAsync({
    identifier: IDS.evening,
    content: {
      title: 'Close the day.',
      body: 'See your streak.',
      data: { screen: 'evening' },
    },
    trigger: dailyTrigger(eveningHour, eveningMinute),
  });
}

// Call after morning ritual is locked.
export async function onMorningLocked(mustDoDone: boolean) {
  await cancelNotification(IDS.morning);
  if (!mustDoDone) {
    await scheduleLunchNudge();
  }
  await scheduleEveningClose();
}

// Call after evening close completes.
export async function onEveningClosed() {
  await cancelNotification(IDS.lunch);
  await cancelNotification(IDS.evening);
}

// Call at app launch to ensure morning notification is scheduled if no intention exists today.
export async function ensureNotificationsScheduled(intention: DailyIntention | null) {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const hasMorning = scheduled.some(n => n.identifier === IDS.morning);

  if (!hasMorning && !intention) {
    await scheduleMorningNotification();
  }

  const hasEvening = scheduled.some(n => n.identifier === IDS.evening);
  if (!hasEvening && intention && !intention.closed_at) {
    await scheduleEveningClose();
  }
}

export async function cancelTodayNotifications() {
  await Promise.all([
    cancelNotification(IDS.morning),
    cancelNotification(IDS.lunch),
    cancelNotification(IDS.evening),
  ]);
}

// AI-decided nudges (ai-coach edge function supplies the copy) ────────
// Reuses the evening-close slot rather than adding a second notification —
// see lib/nudges.ts for the decision logic that calls this.
export async function scheduleStreakRiskNudge(title: string, body: string) {
  const { eveningHour, eveningMinute } = await getNotificationTimes();
  await cancelNotification(IDS.evening);
  await Notifications.scheduleNotificationAsync({
    identifier: IDS.evening,
    content: { title, body, data: { screen: 'evening' } },
    trigger: dailyTrigger(eveningHour, eveningMinute),
  });
}

export async function scheduleSentimentCheckIn(title: string, body: string) {
  await cancelNotification(IDS.sentimentCheckIn);
  const { morningHour, morningMinute } = await getNotificationTimes();
  await Notifications.scheduleNotificationAsync({
    identifier: IDS.sentimentCheckIn,
    content: { title, body, data: { screen: 'journal' } },
    trigger: nextOccurrenceDateTrigger(morningHour, morningMinute),
  });
}

// ── Per-habit reminders ─────────────────────────────────────────────
const habitReminderId = (habitId: string) => `habit-reminder-${habitId}`;

export async function scheduleHabitReminder(habitId: string, label: string, hour: number, minute: number) {
  if (Platform.OS === 'web') return;
  const id = habitReminderId(habitId);
  await cancelNotification(id);
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: 'Habit reminder',
      body: `Time for "${label}".`,
      data: { screen: 'habits' },
    },
    trigger: dailyTrigger(hour, minute),
  });
}

export async function cancelHabitReminder(habitId: string) {
  await cancelNotification(habitReminderId(habitId));
}

export async function scheduleTrialEndingReminder(at: Date, body: string) {
  if (Platform.OS === 'web') return;
  await cancelNotification(IDS.trialEnding);
  await Notifications.scheduleNotificationAsync({
    identifier: IDS.trialEnding,
    content: { title: 'Your Goalify Beyond trial', body, data: { screen: 'profile' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

export async function cancelTrialEndingReminder() {
  await cancelNotification(IDS.trialEnding);
}

// Reconcile scheduled habit reminders with the current habit list — call on
// launch/hydrate so reminders survive reinstalls and cross-device edits.
export async function ensureHabitRemindersScheduled(
  habits: { id: string; label: string; reminderHour?: number | null; reminderMinute?: number | null }[],
) {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIds = new Set(scheduled.map(n => n.identifier));
  const wantedIds = new Set<string>();

  for (const h of habits) {
    if (h.reminderHour == null || h.reminderMinute == null) continue;
    const id = habitReminderId(h.id);
    wantedIds.add(id);
    if (!scheduledIds.has(id)) {
      await scheduleHabitReminder(h.id, h.label, h.reminderHour, h.reminderMinute);
    }
  }

  // Cancel reminders for habits that were deleted or had their reminder cleared.
  for (const n of scheduled) {
    if (n.identifier.startsWith('habit-reminder-') && !wantedIds.has(n.identifier)) {
      await cancelNotification(n.identifier);
    }
  }
}
