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
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: morningHour,
      minute: morningMinute,
      repeats: true,
    },
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
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 12,
      minute: 30,
      repeats: false,
    },
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
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: eveningHour,
      minute: eveningMinute,
      repeats: true,
    },
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
