jest.mock('../store/plan', () => ({ usePlan: jest.fn() }));
jest.mock('../lib/paywall', () => ({ openPaywall: jest.fn() }));
jest.mock('../store/vision', () => ({ useVisionAssets: jest.fn() }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VisionBanner } from '../components/vision/VisionBanner';
import { usePlan } from '../store/plan';
import { openPaywall } from '../lib/paywall';
import { useVisionAssets } from '../store/vision';

const retryGeneration = jest.fn();
const props = {
  goalId: 'g1', goalTitle: 'Learn Spanish', sphere: 'career' as const, caption: 'c',
  fallbackColors: ['#000', '#111'] as [string, string], onPress: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (useVisionAssets as jest.Mock).mockReturnValue({
    getAsset: () => undefined, getSignedUrl: () => undefined, requestGeneration: jest.fn(),
    isGenerating: () => false, isImageLimited: () => true, retryGeneration,
  });
});

it('shows the Beyond caption on Free and retries generation after purchase', () => {
  (usePlan as jest.Mock).mockReturnValue({ plan: 'free' });
  const { getByText } = render(<VisionBanner {...props} />);
  fireEvent.press(getByText('Vision images for every goal with Beyond'));
  expect(openPaywall).toHaveBeenCalledWith('vision_limit', expect.any(Function));
  (openPaywall as jest.Mock).mock.calls[0][1]();
  expect(retryGeneration).toHaveBeenCalledWith('g1', 'Learn Spanish', 'career');
});

it('does not request generation again while limited', () => {
  (usePlan as jest.Mock).mockReturnValue({ plan: 'beyond' });
  const requestGeneration = jest.fn();
  (useVisionAssets as jest.Mock).mockReturnValue({
    getAsset: () => undefined, getSignedUrl: () => undefined, requestGeneration,
    isGenerating: () => false, isImageLimited: () => true, retryGeneration,
  });
  const { getByText } = render(<VisionBanner {...props} />);
  expect(getByText("This month's vision images are used up. More on the 1st.")).toBeTruthy();
  expect(requestGeneration).not.toHaveBeenCalled();
});
