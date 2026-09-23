// Closing the day turns the evening line into a Journal entry.

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }));

const mockCloseEvening = jest.fn();
jest.mock('../store/daily-ritual', () => ({
  useDailyRitual: () => ({
    intention: { id: 'i1', focus_sphere: 'health', must_do_done: true, actions: [], closed_at: null },
    isMorningDone: true,
    isEveningDone: false,
    toggleRitualAction: jest.fn(),
    closeEvening: mockCloseEvening,
  }),
}));

const mockDispatch = jest.fn();
jest.mock('../store', () => ({ useStore: () => ({ state: { goals: [] }, dispatch: mockDispatch }) }));

jest.mock('../lib/notifications', () => ({ onEveningClosed: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../lib/nudges', () => ({ requestSentimentCheckIn: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../components/ritual/DoneReviewStep', () => ({ DoneReviewStep: () => null }));
jest.mock('../components/ritual/TomorrowPickStep', () => ({ TomorrowPickStep: () => null }));
jest.mock('../components/ritual/CloseCelebrationStep', () => ({ CloseCelebrationStep: () => null }));
jest.mock('../components/ritual/JournalLineStep', () => {
  const { TextInput } = require('react-native');
  return {
    JournalLineStep: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
      <TextInput testID="journal-line" value={value} onChangeText={onChange} />
    ),
  };
});

import React from 'react';
import { Animated } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import EveningRitualScreen from '../app/ritual/evening';
import { localDateISO } from '../lib/date';

// Step transitions wait on an animation; complete it synchronously.
jest.spyOn(Animated, 'timing').mockImplementation(() => ({
  start: (cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true }),
  stop: jest.fn(), reset: jest.fn(),
}) as unknown as Animated.CompositeAnimation);

async function walkToClose(screen: ReturnType<typeof render>, line: string | null) {
  fireEvent.press(screen.getByText('Next →'));             // Review → Reflect
  if (line === null) {
    fireEvent.press(screen.getByText('Skip journal'));      // Reflect → Tomorrow
  } else {
    fireEvent.changeText(screen.getByTestId('journal-line'), line);
    fireEvent.press(screen.getByText('Next →'));
  }
  await act(async () => { fireEvent.press(screen.getByText('Close the day →')); });
}

describe('evening close → journal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCloseEvening.mockResolvedValue({ error: null });
  });

  it('saves the evening line as a Journal entry dated today', async () => {
    const screen = render(<EveningRitualScreen />);
    await walkToClose(screen, '  Proud of the long run today.  ');

    expect(mockCloseEvening).toHaveBeenCalledWith('Proud of the long run today.', expect.any(String));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ADD_JOURNAL',
      entry: expect.objectContaining({ date: localDateISO(), body: 'Proud of the long run today.' }),
    });
  });

  it('writes nothing to the Journal when the user skips', async () => {
    const screen = render(<EveningRitualScreen />);
    fireEvent.press(screen.getByText('Next →'));
    fireEvent.changeText(screen.getByTestId('journal-line'), 'half a thought');
    fireEvent.press(screen.getByText('Skip journal'));
    await act(async () => { fireEvent.press(screen.getByText('Close the day →')); });

    expect(mockCloseEvening).toHaveBeenCalledWith('', expect.any(String));
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('does not add a Journal entry when closing the day fails', async () => {
    mockCloseEvening.mockResolvedValue({ error: 'network' });
    const screen = render(<EveningRitualScreen />);
    await walkToClose(screen, 'A good day.');

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
