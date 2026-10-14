// Spec 012: XpProvider queues level-up / achievement moments from
// server-confirmed data and records them as seen only on dismiss.

let mockTotal = 100;
let mockAchievements: { key: string; unlocked_at: string }[] | 'error' = [];

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'user_xp') {
        return { select: () => ({ maybeSingle: async () => ({ data: { total: mockTotal }, error: null }) }) };
      }
      if (table === 'user_achievements') {
        return {
          select: async () => (mockAchievements === 'error'
            ? { data: null, error: { message: 'relation "user_achievements" does not exist' } }
            : { data: mockAchievements, error: null }),
        };
      }
      return { update: () => ({ eq: async () => ({ error: null }) }) };
    },
  },
}));
jest.mock('../store/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
jest.mock('../store/index', () => ({ useStore: () => ({ state: { goals: [] } }) }));
jest.mock('../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'Europe/Berlin' }] }));

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { XpProvider, useXp } from '../store/xp';
import { track } from '../lib/analytics';

const ach = (key: string) => ({ key, unlocked_at: '2026-10-01T10:00:00Z' });

function Probe() {
  const { moment, dismissMoment, achievements } = useXp();
  return (
    <>
      <Text testID="moment">{moment ? JSON.stringify(moment) : 'none'}</Text>
      <Text testID="count">{String(achievements.length)}</Text>
      <TouchableOpacity testID="dismiss" onPress={dismissMoment}><Text>ok</Text></TouchableOpacity>
    </>
  );
}

const mount = () => render(<XpProvider><Probe /></XpProvider>);
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

beforeEach(async () => {
  await AsyncStorage.clear();
  mockTotal = 100;
  mockAchievements = [];
  (track as jest.Mock).mockClear();
});

it('first sight on this device: records level and achievements silently (AS1.3)', async () => {
  mockTotal = 2500;                                    // Level 4
  mockAchievements = [ach('first:habit_done'), ach('streak:7')];
  const { getByTestId } = mount();
  await waitFor(() => expect(getByTestId('count').props.children).toBe('2'));
  await flush();
  expect(getByTestId('moment').props.children).toBe('none');
  expect(await AsyncStorage.getItem('@goalify/xp_seen_level:u1')).toBe('4');
  expect(JSON.parse((await AsyncStorage.getItem('@goalify/achievements_seen:u1'))!)).toEqual(['first:habit_done', 'streak:7']);
  expect(track).not.toHaveBeenCalled();
});

it('celebrates a new level and new achievements, then records them on dismiss', async () => {
  await AsyncStorage.setItem('@goalify/xp_seen_level:u1', '2');
  await AsyncStorage.setItem('@goalify/achievements_seen:u1', JSON.stringify(['first:habit_done']));
  mockTotal = 950;                                     // Level 3
  mockAchievements = [ach('first:habit_done'), ach('balanced_week')];

  const { getByTestId } = mount();
  await waitFor(() => expect(JSON.parse(getByTestId('moment').props.children))
    .toEqual({ level: 3, achievements: ['balanced_week'] }));

  fireEvent.press(getByTestId('dismiss'));
  await flush();
  expect(getByTestId('moment').props.children).toBe('none');
  expect(await AsyncStorage.getItem('@goalify/xp_seen_level:u1')).toBe('3');
  expect(JSON.parse((await AsyncStorage.getItem('@goalify/achievements_seen:u1'))!)).toEqual(['first:habit_done', 'balanced_week']);
  expect(track).toHaveBeenCalledWith('level_reached', { level: 3 });
  expect(track).toHaveBeenCalledWith('achievement_unlocked', { achievement: 'balanced_week' });
});

it('an undismissed moment comes back after a restart', async () => {
  await AsyncStorage.setItem('@goalify/xp_seen_level:u1', '1');
  await AsyncStorage.setItem('@goalify/achievements_seen:u1', '[]');
  mockTotal = 400;                                     // Level 2
  const first = mount();
  await waitFor(() => expect(first.getByTestId('moment').props.children).not.toBe('none'));
  first.unmount();

  const again = mount();
  await waitFor(() => expect(JSON.parse(again.getByTestId('moment').props.children)).toEqual({ level: 2, achievements: [] }));
  expect(track).not.toHaveBeenCalled();               // tracked on dismiss only
});

it('without the achievements table (migration not applied) level-ups still work and nothing is seeded', async () => {
  await AsyncStorage.setItem('@goalify/xp_seen_level:u1', '1');
  mockAchievements = 'error';
  mockTotal = 400;
  const { getByTestId } = mount();
  await waitFor(() => expect(JSON.parse(getByTestId('moment').props.children)).toEqual({ level: 2, achievements: [] }));
  fireEvent.press(getByTestId('dismiss'));
  await flush();
  expect(await AsyncStorage.getItem('@goalify/xp_seen_level:u1')).toBe('2');
  expect(await AsyncStorage.getItem('@goalify/achievements_seen:u1')).toBeNull();
});
