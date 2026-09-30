// XpProvider: server total + optimistic pending, reconciled on fetch.

let mockServerTotal = 100;
const mockUpdate = jest.fn(() => ({ eq: jest.fn(async () => ({ error: null })) }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => table === 'user_xp'
      ? { select: () => ({ maybeSingle: async () => ({ data: { total: mockServerTotal }, error: null }) }) }
      : { update: mockUpdate },
  },
}));
jest.mock('../store/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
jest.mock('../store/index', () => ({ useStore: () => ({ state: { goals: [] } }) }));
jest.mock('../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'Europe/Berlin' }] }));

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { XpProvider, useXp, useLevel } from '../store/xp';
import { emitLocalXp } from '../lib/xp';
import AsyncStorage from '@react-native-async-storage/async-storage';

function Probe() {
  const { total } = useXp();
  const lvl = useLevel();
  return <Text testID="xp">{`${total}|${lvl.lvl.n}`}</Text>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useFakeTimers();
  mockServerTotal = 100;
  mockUpdate.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

it('shows the server total, adds pending, then trusts the server once synced', async () => {
  const { getByTestId } = render(<XpProvider><Probe /></XpProvider>);
  await waitFor(() => expect(getByTestId('xp').props.children).toBe('100|1'));

  act(() => { emitLocalXp(10); });
  expect(getByTestId('xp').props.children).toBe('110|1');   // instant

  mockServerTotal = 160;               // server applied the subtask + first bonus
  await act(async () => { jest.advanceTimersByTime(5000); });
  await waitFor(() => expect(getByTestId('xp').props.children).toBe('160|1'));
});

it('writes the device time zone to the profile', async () => {
  render(<XpProvider><Probe /></XpProvider>);
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ timezone: 'Europe/Berlin' }));
});

it('does not rewrite an unchanged time zone', async () => {
  await AsyncStorage.setItem('@goalify/timezone:u1', 'Europe/Berlin');
  const { getByTestId } = render(<XpProvider><Probe /></XpProvider>);
  await waitFor(() => expect(getByTestId('xp').props.children).toBe('100|1'));
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('crossing a threshold changes the level', async () => {
  mockServerTotal = 290;
  const { getByTestId } = render(<XpProvider><Probe /></XpProvider>);
  await waitFor(() => expect(getByTestId('xp').props.children).toBe('290|1'));
  act(() => { emitLocalXp(10); });
  expect(getByTestId('xp').props.children).toBe('300|2');
});
