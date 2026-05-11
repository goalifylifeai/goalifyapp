// ── Mocks ─────────────────────────────────────────────────────────
let mockNextEventId = 1;
const mockCreatedEvents: Record<string, object> = {};

jest.mock('expo-calendar', () => ({
  EntityTypes: { EVENT: 'event' },
  SourceType: { LOCAL: 'local' },
  Frequency: { DAILY: 'daily' },
  CalendarAccessLevel: { OWNER: 'owner' },
  requestCalendarPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCalendarsAsync: jest.fn().mockResolvedValue([]),
  getDefaultCalendarAsync: jest.fn().mockResolvedValue({ source: { id: 'src-1', name: 'Default' } }),
  createCalendarAsync: jest.fn().mockResolvedValue('cal-goalify'),
  createEventAsync: jest.fn().mockImplementation((_calId: string, event: object) => {
    const id = `evt-${mockNextEventId++}`;
    mockCreatedEvents[id] = event;
    return Promise.resolve(id);
  }),
  deleteEventAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import * as Calendar from 'expo-calendar';
import {
  exportHabitToCalendar,
  removeHabitFromCalendar,
  syncHabitsToCalendar,
  removeAllHabitsFromCalendar,
} from '../lib/calendar';
import type { HabitItem } from '../store';

const mockCalendar = Calendar as jest.Mocked<typeof Calendar>;

function makeHabit(overrides: Partial<HabitItem> = {}): HabitItem {
  return {
    id: `h-${Math.random().toString(36).slice(2)}`,
    label: 'Morning Run',
    icon: '◐',
    sphere: 'health',
    streak: 3,
    target: '30 min',
    doneToday: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockNextEventId = 1;
  Object.keys(mockCreatedEvents).forEach(k => delete mockCreatedEvents[k]);
  jest.clearAllMocks();
  // Reset default mock values after clearAllMocks
  mockCalendar.requestCalendarPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
  mockCalendar.getCalendarsAsync.mockResolvedValue([]);
  mockCalendar.getDefaultCalendarAsync.mockResolvedValue({ source: { id: 'src-1', name: 'Default' } } as any);
  mockCalendar.createCalendarAsync.mockResolvedValue('cal-goalify' as any);
  mockCalendar.createEventAsync.mockImplementation((_calId: string, event: object) => {
    const id = `evt-${mockNextEventId++}`;
    mockCreatedEvents[id] = event;
    return Promise.resolve(id);
  });
  mockCalendar.deleteEventAsync.mockResolvedValue(undefined);
});

// ── exportHabitToCalendar ─────────────────────────────────────────
describe('exportHabitToCalendar', () => {
  it('requests calendar permission', async () => {
    const habit = makeHabit();
    await exportHabitToCalendar(habit);
    expect(mockCalendar.requestCalendarPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing Goalify calendar', async () => {
    mockCalendar.getCalendarsAsync.mockResolvedValue([
      { id: 'cal-existing', title: 'Goalify', isImmutable: false } as any,
    ]);
    const habit = makeHabit();
    await exportHabitToCalendar(habit);
    expect(mockCalendar.createCalendarAsync).not.toHaveBeenCalled();
    expect(mockCalendar.createEventAsync).toHaveBeenCalledWith('cal-existing', expect.any(Object));
  });

  it('creates a new Goalify calendar when none exists', async () => {
    const habit = makeHabit();
    await exportHabitToCalendar(habit);
    expect(mockCalendar.createCalendarAsync).toHaveBeenCalledTimes(1);
    expect(mockCalendar.createEventAsync).toHaveBeenCalledWith('cal-goalify', expect.any(Object));
  });

  it('returns the created event id', async () => {
    const habit = makeHabit();
    const eventId = await exportHabitToCalendar(habit);
    expect(eventId).toBe('evt-1');
  });

  it('creates an all-day daily recurring event with the habit title', async () => {
    const habit = makeHabit({ label: 'Meditate', icon: '○', sphere: 'mind' });
    await exportHabitToCalendar(habit);
    expect(mockCalendar.createEventAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        title: '○ Meditate',
        allDay: true,
        recurrenceRule: { frequency: 'daily' },
      }),
    );
  });

  it('throws when permission is denied', async () => {
    mockCalendar.requestCalendarPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
    await expect(exportHabitToCalendar(makeHabit())).rejects.toThrow('Calendar permission denied');
  });
});

// ── removeHabitFromCalendar ───────────────────────────────────────
describe('removeHabitFromCalendar', () => {
  it('deletes the event with futureEvents: true', async () => {
    await removeHabitFromCalendar('evt-42');
    expect(mockCalendar.deleteEventAsync).toHaveBeenCalledWith('evt-42', { futureEvents: true });
  });

  it('does not throw if the event is already gone', async () => {
    mockCalendar.deleteEventAsync.mockRejectedValue(new Error('not found'));
    await expect(removeHabitFromCalendar('evt-missing')).resolves.toBeUndefined();
  });
});

// ── syncHabitsToCalendar ──────────────────────────────────────────
describe('syncHabitsToCalendar', () => {
  it('exports habits that have no calendarEventId', async () => {
    const habits = [makeHabit({ id: 'h1' }), makeHabit({ id: 'h2' })];
    const synced: Array<{ habitId: string; eventId: string }> = [];

    await syncHabitsToCalendar(habits, (habitId, eventId) => synced.push({ habitId, eventId }));

    expect(mockCalendar.createEventAsync).toHaveBeenCalledTimes(2);
    expect(synced).toHaveLength(2);
    expect(synced.map(s => s.habitId)).toEqual(['h1', 'h2']);
  });

  it('skips habits that already have a calendarEventId', async () => {
    const habits = [
      makeHabit({ id: 'h1', calendarEventId: 'evt-already' }),
      makeHabit({ id: 'h2' }),
    ];
    const synced: string[] = [];

    await syncHabitsToCalendar(habits, (habitId) => synced.push(habitId));

    expect(mockCalendar.createEventAsync).toHaveBeenCalledTimes(1);
    expect(synced).toEqual(['h2']);
  });

  it('calls onSynced with the returned event id', async () => {
    const habit = makeHabit({ id: 'h1' });
    let capturedEventId = '';

    await syncHabitsToCalendar([habit], (_id, eventId) => { capturedEventId = eventId; });

    expect(capturedEventId).toBe('evt-1');
  });

  it('handles an empty habits list without error', async () => {
    await expect(syncHabitsToCalendar([], jest.fn())).resolves.toBeUndefined();
    expect(mockCalendar.createEventAsync).not.toHaveBeenCalled();
  });
});

// ── removeAllHabitsFromCalendar ───────────────────────────────────
describe('removeAllHabitsFromCalendar', () => {
  it('removes events for all habits that have a calendarEventId', async () => {
    const habits = [
      makeHabit({ calendarEventId: 'evt-10' }),
      makeHabit({ calendarEventId: 'evt-11' }),
      makeHabit(),
    ];

    await removeAllHabitsFromCalendar(habits);

    expect(mockCalendar.deleteEventAsync).toHaveBeenCalledTimes(2);
    expect(mockCalendar.deleteEventAsync).toHaveBeenCalledWith('evt-10', { futureEvents: true });
    expect(mockCalendar.deleteEventAsync).toHaveBeenCalledWith('evt-11', { futureEvents: true });
  });

  it('does nothing when no habits have calendar events', async () => {
    await removeAllHabitsFromCalendar([makeHabit(), makeHabit()]);
    expect(mockCalendar.deleteEventAsync).not.toHaveBeenCalled();
  });

  it('handles an empty habits list', async () => {
    await expect(removeAllHabitsFromCalendar([])).resolves.toBeUndefined();
  });
});
