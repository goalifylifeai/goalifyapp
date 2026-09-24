// Deleting a habit from the Habits tab: confirmed inline (Alert.alert is a
// no-op on web), then removed along with its reminder and calendar event.

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
      habits: [
        { id: 'h1', label: 'Walk', icon: '○', sphere: 'health', streak: 3, target: '1', doneToday: false, history: [], calendarEventId: 'ev-1' },
        { id: 'h2', label: 'Read', icon: '◇', sphere: 'career', streak: 0, target: '1', doneToday: false, history: [] },
      ],
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
jest.mock('../lib/calendar', () => ({
  exportHabitToCalendar: jest.fn(),
  removeHabitFromCalendar: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HabitsScreen from '../app/(tabs)/habits';

const notifications = () => jest.requireMock('../lib/notifications');
const calendar = () => jest.requireMock('../lib/calendar');

describe('deleting a habit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for confirmation before deleting', () => {
    const screen = render(<HabitsScreen />);
    fireEvent.press(screen.getByTestId('delete-habit-h1'));
    expect(screen.getByText('Delete this habit and its history?')).toBeTruthy();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('Cancel keeps the habit', () => {
    const screen = render(<HabitsScreen />);
    fireEvent.press(screen.getByTestId('delete-habit-h1'));
    fireEvent.press(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete this habit and its history?')).toBeNull();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('confirming removes the habit, its reminder and its calendar event', () => {
    const screen = render(<HabitsScreen />);
    fireEvent.press(screen.getByTestId('delete-habit-h1'));
    fireEvent.press(screen.getByTestId('confirm-delete-habit-h1'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'REMOVE_HABIT', id: 'h1' });
    expect(notifications().cancelHabitReminder).toHaveBeenCalledWith('h1');
    expect(calendar().removeHabitFromCalendar).toHaveBeenCalledWith('ev-1');
  });

  it('skips the calendar for a habit that was never exported', () => {
    const screen = render(<HabitsScreen />);
    fireEvent.press(screen.getByTestId('delete-habit-h2'));
    fireEvent.press(screen.getByTestId('confirm-delete-habit-h2'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'REMOVE_HABIT', id: 'h2' });
    expect(calendar().removeHabitFromCalendar).not.toHaveBeenCalled();
  });
});
