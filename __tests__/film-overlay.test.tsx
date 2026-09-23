jest.mock('../store/plan', () => ({ usePlan: jest.fn() }));
jest.mock('../lib/paywall', () => ({ openPaywall: jest.fn() }));
jest.mock('../store/vision', () => ({ useVisionAssets: jest.fn() }));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Path: View };
});

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { FilmOverlay } from '../components/vision/FilmOverlay';
import { usePlan } from '../store/plan';
import { openPaywall } from '../lib/paywall';
import { useVisionAssets } from '../store/vision';

const requestRegen = jest.fn();
const props = { goalId: 'g1', goalTitle: 'Run a marathon', sphere: 'health' as const, caption: 'c', progress: 0.4 };

beforeEach(() => {
  jest.clearAllMocks();
  (useVisionAssets as jest.Mock).mockReturnValue({
    requestRegen, canRegen: () => true, getAsset: () => ({ status: 'ready' }),
  });
});

it('shows a locked regenerate button on Free that opens the paywall and regenerates after purchase', () => {
  (usePlan as jest.Mock).mockReturnValue({ plan: 'free' });
  const { getByLabelText } = render(<FilmOverlay {...props} />);
  fireEvent.press(getByLabelText('Regenerate vision (Goalify Beyond)'));
  expect(openPaywall).toHaveBeenCalledWith('vision_regen', expect.any(Function));
  (openPaywall as jest.Mock).mock.calls[0][1]();
  expect(requestRegen).toHaveBeenCalledWith('g1', 3, 'Run a marathon', 'health');
});

it('asks for confirmation on Beyond instead of opening the paywall', () => {
  (usePlan as jest.Mock).mockReturnValue({ plan: 'beyond' });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { getByLabelText } = render(<FilmOverlay {...props} />);
  fireEvent.press(getByLabelText('Regenerate vision'));
  expect(openPaywall).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith('Regenerate vision?', expect.any(String), expect.any(Array));
});
