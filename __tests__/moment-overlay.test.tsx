// Spec 012: the moment overlay and the Level screen's achievements list.
const mockSegments = { current: ['(tabs)'] as string[] };
const mockXp = {
  moment: null as null | { level: number | null; achievements: string[] },
  dismissMoment: jest.fn(),
  total: 950,
  achievements: [] as { key: string; unlockedAt: string }[],
};

jest.mock('expo-router', () => ({
  useSegments: () => mockSegments.current,
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('../store/xp', () => ({
  useXp: () => mockXp,
  useLevel: () => {
    const { levelFromXp } = jest.requireActual('../constants/data');
    return { ...levelFromXp(mockXp.total), xp: mockXp.total };
  },
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { MomentOverlay } from '../components/MomentOverlay';
import LevelInfoScreen from '../app/level-info';
import { ACHIEVEMENTS } from '../lib/achievements';

beforeEach(() => {
  mockSegments.current = ['(tabs)'];
  mockXp.moment = null;
  mockXp.achievements = [];
  mockXp.total = 950;
  jest.clearAllMocks();
});

describe('<MomentOverlay />', () => {
  it('renders nothing without a moment', () => {
    expect(render(<MomentOverlay />).queryByTestId('moment-overlay')).toBeNull();
  });

  it('shows the new level, its name and the XP to the next one', () => {
    mockXp.moment = { level: 3, achievements: [] };
    const { getByTestId, getByText } = render(<MomentOverlay />);
    expect(getByTestId('moment-level')).toBeTruthy();
    expect(getByText('Builder.')).toBeTruthy();
    expect(getByText('1,050 XP to Level 4, Practiced.')).toBeTruthy();   // 2000 − 950
  });

  it('lists new achievements with their copy', () => {
    mockXp.moment = { level: null, achievements: ['balanced_week'] };
    const { getByText, queryByTestId } = render(<MomentOverlay />);
    expect(queryByTestId('moment-level')).toBeNull();
    expect(getByText('Achievement unlocked')).toBeTruthy();
    expect(getByText('Balanced week')).toBeTruthy();
  });

  it('waits while the user is mid-ritual or onboarding (AS1.2)', () => {
    mockXp.moment = { level: 3, achievements: [] };
    mockSegments.current = ['ritual', 'evening'];
    expect(render(<MomentOverlay />).queryByTestId('moment-overlay')).toBeNull();
    mockSegments.current = ['(onboarding)', 'name'];
    expect(render(<MomentOverlay />).queryByTestId('moment-overlay')).toBeNull();
  });

  it('Continue dismisses; "See all" dismisses and opens the Level screen', () => {
    mockXp.moment = { level: 3, achievements: [] };
    const { getByTestId } = render(<MomentOverlay />);
    fireEvent.press(getByTestId('moment-continue'));
    expect(mockXp.dismissMoment).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('moment-see-all'));
    expect(mockXp.dismissMoment).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenCalledWith('/level-info');
  });

  it('says so at the top level instead of pointing to a next one', () => {
    mockXp.total = 25000;
    mockXp.moment = { level: 8, achievements: [] };
    expect(render(<MomentOverlay />).getByText(/top of the ladder/)).toBeTruthy();
  });
});

describe('Level screen achievements (Story 2 AS4)', () => {
  it('shows every achievement, earned with a date and locked with how to earn it', () => {
    mockXp.achievements = [{ key: 'first:habit_done', unlockedAt: '2026-10-05T10:00:00Z' }, { key: 'from:future', unlockedAt: '2026-10-05T10:00:00Z' }];
    const { getByTestId, getAllByTestId } = render(<LevelInfoScreen />);
    expect(getByTestId('achievements-count').props.children.join('')).toBe(`1 of ${ACHIEVEMENTS.length} earned`);
    expect(getAllByTestId(/^achievement-/)).toHaveLength(ACHIEVEMENTS.length);
    expect(getByTestId('achievement-first:habit_done').props.accessibilityLabel).toMatch(/earned/);
    expect(getByTestId('achievement-balanced_week').props.accessibilityLabel)
      .toBe('Balanced week, locked. Make progress in all four spheres in one week (Mon–Sun).');
  });
});
