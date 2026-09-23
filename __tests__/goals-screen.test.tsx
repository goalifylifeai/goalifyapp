// Characterization tests for app/(tabs)/goals.tsx.
// Child components with heavy native/store dependencies (VisionBanner needs
// store/vision; DateTimePicker is a native module) are stubbed out so the
// test isolates goals.tsx's own logic: filtering, search, add/edit form
// state, subtask management, dispatch calls, and the habit-prompt handoff.

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('../store', () => ({
  useStore: jest.fn(),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: (props: any) => <View testID="date-picker" {...props} /> };
});

jest.mock('../components/vision/VisionBanner', () => ({
  VisionBanner: ({ goalTitle, onPress }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} testID={`vision-banner-${goalTitle}`}>
        <Text>{goalTitle}</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../components/HabitPromptModal', () => ({
  HabitPromptModal: ({ visible, goalTitle, onSave, onSkip }: any) => {
    if (!visible) return null;
    const { View, Text, TouchableOpacity } = require('react-native');
    return (
      <View testID="habit-prompt-modal">
        <Text>{`Habit for ${goalTitle}`}</Text>
        <TouchableOpacity onPress={() => onSave('Meditate 10 min')}>
          <Text>Save Habit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip}>
          <Text>Skip Habit</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import GoalsScreen from '../app/(tabs)/goals';
import { useStore } from '../store';
import { useLocalSearchParams, router } from 'expo-router';
import type { Goal } from '../store';

function getMocks() {
  return {
    useStoreMock: useStore as jest.Mock,
    useLocalSearchParamsMock: useLocalSearchParams as jest.Mock,
    routerMock: router as unknown as { push: jest.Mock; replace: jest.Mock },
  };
}

const g1: Goal = {
  id: 'g1', sphere: 'health', title: 'Run a 5k', due: 'Jun 1', progress: 0.5,
  sub: [{ id: 's1', t: 'Buy shoes', done: false }, { id: 's2', t: 'Sign up for a race', done: true }],
};
const g2: Goal = {
  id: 'g2', sphere: 'career', title: 'Ship the app', due: 'Jul 4', progress: 0, sub: [],
};

function mockStore(goals: Goal[] = [g1, g2]) {
  const dispatch = jest.fn();
  const { useStoreMock } = getMocks();
  useStoreMock.mockReturnValue({
    state: { goals, habits: [], journal: [], todayActions: [], coachMessages: [] },
    dispatch,
  });
  return dispatch;
}

describe('<GoalsScreen />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useLocalSearchParamsMock } = getMocks();
    useLocalSearchParamsMock.mockReturnValue({});
  });

  it('renders all goals when the filter is "all"', () => {
    mockStore();
    const { getAllByText, getByText } = render(<GoalsScreen />);
    // Title appears twice per goal: once in our stubbed VisionBanner, once in the card body.
    expect(getAllByText('Run a 5k').length).toBeGreaterThan(0);
    expect(getAllByText('Ship the app').length).toBeGreaterThan(0);
    expect(getByText('2 active · 12 completed')).toBeTruthy();
  });

  it('initializes the sphere filter from the `sphere` route param', () => {
    const { useLocalSearchParamsMock } = getMocks();
    useLocalSearchParamsMock.mockReturnValue({ sphere: 'career' });
    mockStore();

    const { getAllByText, queryByText } = render(<GoalsScreen />);
    expect(getAllByText('Ship the app').length).toBeGreaterThan(0);
    expect(queryByText('Run a 5k')).toBeNull();
  });

  it('filters goals by tapping a sphere pill', () => {
    mockStore();
    const { getAllByText, queryByText } = render(<GoalsScreen />);

    // The filter pill's rendered text is "<glyph> Career" (glyph + label
    // nested inside one <Text>), while the goal card also renders a bare
    // "Career" <Text>. The pill occurs first in the tree.
    const careerMatches = getAllByText(/Career/);
    fireEvent.press(careerMatches[0]);

    expect(getAllByText('Ship the app').length).toBeGreaterThan(0);
    expect(queryByText('Run a 5k')).toBeNull();
  });

  it('searches goals by title', () => {
    mockStore();
    const { getByPlaceholderText, getAllByText, queryByText } = render(<GoalsScreen />);

    fireEvent.changeText(getByPlaceholderText('Search goals…'), '5k');

    expect(getAllByText('Run a 5k').length).toBeGreaterThan(0);
    expect(queryByText('Ship the app')).toBeNull();
  });

  it('searches goals by subtask text', () => {
    mockStore();
    const { getByPlaceholderText, getAllByText, queryByText } = render(<GoalsScreen />);

    fireEvent.changeText(getByPlaceholderText('Search goals…'), 'race');

    expect(getAllByText('Run a 5k').length).toBeGreaterThan(0);
    expect(queryByText('Ship the app')).toBeNull();
  });

  it('toggles a subtask via dispatch', () => {
    const dispatch = mockStore();
    const { getByText } = render(<GoalsScreen />);

    fireEvent.press(getByText('Buy shoes'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_SUBTASK', goalId: 'g1', idx: 0 });
  });

  it('shows the new-goal form when "New goal" is pressed, and Save is disabled with an empty title', () => {
    mockStore();
    const { getByText } = render(<GoalsScreen />);

    fireEvent.press(getByText('New goal'));

    expect(getByText('New Goal')).toBeTruthy();
    const saveBtn = getByText('Save');
    expect(saveBtn.parent?.props.accessibilityState?.disabled).not.toBe(false);
  });

  it('adds a new goal with a subtask via dispatch and opens the habit prompt', () => {
    const dispatch = mockStore();
    const { getByText, getByPlaceholderText, queryByTestId } = render(<GoalsScreen />);

    fireEvent.press(getByText('New goal'));
    fireEvent.changeText(getByPlaceholderText('Goal title'), 'Learn Spanish');
    fireEvent.changeText(getByPlaceholderText('Add subtask'), 'Finish Duolingo tree');
    fireEvent.press(getByText('Save'));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_GOAL',
        goal: expect.objectContaining({
          title: 'Learn Spanish',
          sub: [expect.objectContaining({ t: 'Finish Duolingo tree', done: false })],
        }),
      }),
    );
    expect(queryByTestId('habit-prompt-modal')).toBeTruthy();
  });

  it('saving a habit from the prompt dispatches ADD_HABIT linked to the new goal', () => {
    const dispatch = mockStore();
    const { getByText, getByPlaceholderText } = render(<GoalsScreen />);

    fireEvent.press(getByText('New goal'));
    fireEvent.changeText(getByPlaceholderText('Goal title'), 'Learn Spanish');
    fireEvent.press(getByText('Save'));

    dispatch.mockClear();
    fireEvent.press(getByText('Save Habit'));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_HABIT',
        habit: expect.objectContaining({ label: 'Meditate 10 min', sphere: 'career' }),
      }),
    );
  });

  it('skipping the habit prompt dismisses it without dispatching ADD_HABIT', () => {
    const dispatch = mockStore();
    const { getByText, getByPlaceholderText, queryByTestId } = render(<GoalsScreen />);

    fireEvent.press(getByText('New goal'));
    fireEvent.changeText(getByPlaceholderText('Goal title'), 'Learn Spanish');
    fireEvent.press(getByText('Save'));

    dispatch.mockClear();
    fireEvent.press(getByText('Skip Habit'));

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ADD_HABIT' }));
    expect(queryByTestId('habit-prompt-modal')).toBeNull();
  });

  it('editing an existing goal pre-fills the form and dispatches UPDATE_GOAL on save', () => {
    const dispatch = mockStore();
    const { getAllByText, getByText, getByPlaceholderText, getByDisplayValue } = render(<GoalsScreen />);

    fireEvent.press(getAllByText('EDIT')[0]);

    expect(getByDisplayValue('Run a 5k')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('Goal title'), 'Run a 10k');
    fireEvent.press(getByText('Save'));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_GOAL',
        goalId: 'g1',
        patch: expect.objectContaining({ title: 'Run a 10k' }),
      }),
    );
  });

  it('removing a subtask in the edit form drops it before saving', () => {
    const dispatch = mockStore();
    const { getAllByText, getByText, getAllByText: getAll2 } = render(<GoalsScreen />);

    fireEvent.press(getAllByText('EDIT')[0]);
    // The "×" remove buttons appear once per existing subtask (2 for g1).
    const removeButtons = getAll2('×');
    fireEvent.press(removeButtons[0]);
    fireEvent.press(getByText('Save'));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_GOAL',
        goalId: 'g1',
        patch: expect.objectContaining({
          sub: [expect.objectContaining({ t: 'Sign up for a race' })],
        }),
      }),
    );
  });

  it('cancelling the add form clears fields and hides the form', () => {
    mockStore();
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(<GoalsScreen />);

    fireEvent.press(getByText('New goal'));
    fireEvent.changeText(getByPlaceholderText('Goal title'), 'Draft goal');
    fireEvent.press(getByText('Cancel'));

    expect(queryByPlaceholderText('Goal title')).toBeNull();
    expect(getByText('New goal')).toBeTruthy();
  });

  it('navigates to the vision detail screen when a vision banner is pressed', () => {
    mockStore();
    const { routerMock } = getMocks();
    const { getByTestId } = render(<GoalsScreen />);

    fireEvent.press(getByTestId('vision-banner-Run a 5k'));

    expect(routerMock.push).toHaveBeenCalledWith('/vision/g1');
  });
});
