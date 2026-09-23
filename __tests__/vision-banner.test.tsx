// VisionBanner must not ask the server to generate an image until the user's
// saved images have loaded (otherwise every app launch fires a wasted
// generate-vision call per goal), and must show the image-cap caption instead
// of re-requesting once the server refused a goal for the monthly cap (U4).
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

const requestGeneration = jest.fn();
const retryGeneration = jest.fn();

function vision(over: Record<string, unknown> = {}) {
  return {
    assetsLoaded: true, getAsset: () => undefined, getSignedUrl: () => undefined,
    requestGeneration, isGenerating: () => false, isImageLimited: () => false, retryGeneration,
    ...over,
  };
}

const props = {
  goalId: 'g1', goalTitle: 'Learn Spanish', sphere: 'career' as const, caption: 'c',
  fallbackColors: ['#000', '#111'] as [string, string], onPress: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (usePlan as jest.Mock).mockReturnValue({ plan: 'free' });
});

describe('waiting for saved images', () => {
  it('waits while saved images are still loading', () => {
    (useVisionAssets as jest.Mock).mockReturnValue(vision({ assetsLoaded: false }));
    render(<VisionBanner {...props} />);
    expect(requestGeneration).not.toHaveBeenCalled();
  });

  it('requests generation once loaded and the goal has no image', () => {
    (useVisionAssets as jest.Mock).mockReturnValue(vision({ assetsLoaded: false }));
    const { rerender } = render(<VisionBanner {...props} />);
    (useVisionAssets as jest.Mock).mockReturnValue(vision({ assetsLoaded: true }));
    rerender(<VisionBanner {...props} />);
    expect(requestGeneration).toHaveBeenCalledTimes(1);
    expect(requestGeneration).toHaveBeenCalledWith('g1', 'Learn Spanish', 'career');
  });

  it('does not request generation when the goal already has an image', () => {
    (useVisionAssets as jest.Mock).mockReturnValue(vision({ getAsset: () => ({ status: 'ready' }) }));
    render(<VisionBanner {...props} />);
    expect(requestGeneration).not.toHaveBeenCalled();
  });
});

describe('monthly image cap (U4)', () => {
  it('shows the Beyond caption on Free and retries generation after purchase', () => {
    (useVisionAssets as jest.Mock).mockReturnValue(vision({ isImageLimited: () => true }));
    const { getByText } = render(<VisionBanner {...props} />);
    fireEvent.press(getByText('Vision images for every goal with Beyond'));
    expect(openPaywall).toHaveBeenCalledWith('vision_limit', expect.any(Function));
    (openPaywall as jest.Mock).mock.calls[0][1]();
    expect(retryGeneration).toHaveBeenCalledWith('g1', 'Learn Spanish', 'career');
  });

  it('does not request generation again while limited, even once loaded', () => {
    (usePlan as jest.Mock).mockReturnValue({ plan: 'beyond' });
    (useVisionAssets as jest.Mock).mockReturnValue(vision({ isImageLimited: () => true }));
    const { getByText } = render(<VisionBanner {...props} />);
    expect(getByText("This month's vision images are used up. More on the 1st.")).toBeTruthy();
    expect(requestGeneration).not.toHaveBeenCalled();
  });
});
