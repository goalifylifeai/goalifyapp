// VisionBanner must not ask the server to generate an image until the user's
// saved images have loaded; otherwise every app launch fires a wasted
// generate-vision call per goal.
import React from 'react';
import { render } from '@testing-library/react-native';

const mockRequestGeneration = jest.fn();
let mockState: { assetsLoaded: boolean; asset: unknown } = { assetsLoaded: false, asset: undefined };

jest.mock('../store/vision', () => ({
  useVisionAssets: () => ({
    assetsLoaded: mockState.assetsLoaded,
    getAsset: () => mockState.asset,
    getSignedUrl: () => undefined,
    requestGeneration: mockRequestGeneration,
    isGenerating: () => false,
  }),
}));

import { VisionBanner } from '../components/vision/VisionBanner';

const props = {
  goalId: 'g1', goalTitle: 'Run a 10k', sphere: 'health' as const,
  caption: 'Morning light', fallbackColors: ['#fff', '#eee'] as [string, string],
  onPress: () => {},
};

beforeEach(() => mockRequestGeneration.mockClear());

it('waits while saved images are still loading', () => {
  mockState = { assetsLoaded: false, asset: undefined };
  render(<VisionBanner {...props} />);
  expect(mockRequestGeneration).not.toHaveBeenCalled();
});

it('requests generation once loaded and the goal has no image', () => {
  mockState = { assetsLoaded: false, asset: undefined };
  const { rerender } = render(<VisionBanner {...props} />);
  mockState = { assetsLoaded: true, asset: undefined };
  rerender(<VisionBanner {...props} />);
  expect(mockRequestGeneration).toHaveBeenCalledTimes(1);
  expect(mockRequestGeneration).toHaveBeenCalledWith('g1', 'Run a 10k', 'health');
});

it('does not request generation when the goal already has an image', () => {
  mockState = { assetsLoaded: true, asset: { status: 'ready' } };
  render(<VisionBanner {...props} />);
  expect(mockRequestGeneration).not.toHaveBeenCalled();
});
