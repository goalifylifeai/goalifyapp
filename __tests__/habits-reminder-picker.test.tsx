// The Android time picker reports a Cancel as onChange({ type: 'dismissed' },
// originalValue). That must not save a reminder.

jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: (props: any) => <View testID="time-picker" {...props} /> };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const mockDispatch = jest.fn();
jest.mock('../store', () => ({
  useStore: () => ({
    state: {
      habits: [{ id: 'h1', label: 'Walk', icon: '○', sphere: 'health', streak: 0, target: '1', doneToday: false, history: [] }],
      goals: [], journal: [], todayActions: [],
    },
    dispatch: mockDispatch,
  }),
}));
jest.mock('../lib/notifications', () => ({
  requestNotificationPermission: jest.fn().mockResolvedValue(true),
  scheduleHabitReminder: jest.fn().mockResolvedValue(undefined),
  cancelHabitReminder: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../lib/calendar', () => ({ exportHabitToCalendar: jest.fn() }));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import HabitsScreen from '../app/(tabs)/habits';

const notifications = () => jest.requireMock('../lib/notifications');

async function openPicker() {
  const screen = render(<HabitsScreen />);
  fireEvent.press(screen.getByText('Add reminder'));
  return screen;
}

describe('habit reminder picker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Cancel (dismissed) closes the picker without saving a reminder', async () => {
    const screen = await openPicker();
    const eight = new Date(); eight.setHours(8, 0, 0, 0);

    await act(async () => {
      fireEvent(screen.getByTestId('time-picker'), 'onChange', { type: 'dismissed' }, eight);
    });

    expect(screen.queryByTestId('time-picker')).toBeNull();
    expect(notifications().scheduleHabitReminder).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_HABIT_REMINDER' }));
  });

  it('a picked time (set) saves the reminder', async () => {
    const screen = await openPicker();
    const seven = new Date(); seven.setHours(7, 30, 0, 0);

    await act(async () => {
      fireEvent(screen.getByTestId('time-picker'), 'onChange', { type: 'set' }, seven);
    });

    expect(notifications().scheduleHabitReminder).toHaveBeenCalledWith('h1', 'Walk', 7, 30);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_HABIT_REMINDER', id: 'h1', hour: 7, minute: 30 });
  });
});
