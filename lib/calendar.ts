import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import type { HabitItem } from '../store';

const CALENDAR_TITLE = 'Goalify';

async function getOrCreateGoalifyCalendar(): Promise<string> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') throw new Error('Calendar permission denied');

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find(c => c.title === CALENDAR_TITLE && !(c as { isImmutable?: boolean }).isImmutable);
  if (existing) return existing.id;

  let source: Calendar.Source;
  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    source = defaultCalendar.source;
  } else {
    source = { isLocalAccount: true, name: CALENDAR_TITLE, type: Calendar.SourceType.LOCAL, id: '' };
  }

  return Calendar.createCalendarAsync({
    title: CALENDAR_TITLE,
    color: '#1a1a1a',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: source.id,
    source,
    name: 'goalify',
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

export async function exportHabitToCalendar(habit: HabitItem): Promise<string> {
  const calendarId = await getOrCreateGoalifyCalendar();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 0);

  return Calendar.createEventAsync(calendarId, {
    title: `${habit.icon} ${habit.label}`,
    notes: `Goalify · ${habit.sphere} · ${habit.target}`,
    startDate: today,
    endDate: end,
    allDay: true,
    recurrenceRule: { frequency: Calendar.Frequency.DAILY },
  });
}

export async function removeHabitFromCalendar(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId, { futureEvents: true });
  } catch {
    // event may have been deleted from the calendar app already
  }
}

export async function syncHabitsToCalendar(
  habits: HabitItem[],
  onSynced: (habitId: string, eventId: string) => void,
): Promise<void> {
  for (const habit of habits) {
    if (habit.calendarEventId) continue;
    const eventId = await exportHabitToCalendar(habit);
    onSynced(habit.id, eventId);
  }
}

export async function removeAllHabitsFromCalendar(habits: HabitItem[]): Promise<void> {
  for (const habit of habits) {
    if (habit.calendarEventId) {
      await removeHabitFromCalendar(habit.calendarEventId);
    }
  }
}
