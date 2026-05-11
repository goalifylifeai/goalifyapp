import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@goalify/notification_times';

export type NotificationTimes = {
  morningHour: number;
  morningMinute: number;
  eveningHour: number;
  eveningMinute: number;
};

const DEFAULTS: NotificationTimes = {
  morningHour: 6,
  morningMinute: 0,
  eveningHour: 21,
  eveningMinute: 30,
};

export async function getNotificationTimes(): Promise<NotificationTimes> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export async function saveNotificationTimes(times: Partial<NotificationTimes>): Promise<void> {
  const current = await getNotificationTimes();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...times }));
}

export { DEFAULTS as DEFAULT_NOTIFICATION_TIMES };
