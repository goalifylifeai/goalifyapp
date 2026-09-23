const mockInvoke = jest.fn();
const mockRows = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    from: () => ({ select: () => ({ eq: () => mockRows() }) }),
    storage: { from: () => ({ createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://img' } }) }) },
  },
}));
const mockUser = { id: 'u1' };
jest.mock('../store/auth', () => ({ useAuth: () => ({ user: mockUser }) }));
let mockPlan: { plan: 'free' | 'beyond'; loaded: boolean } = { plan: 'free', loaded: true };
jest.mock('../store/plan', () => ({ usePlan: () => mockPlan }));

import React from 'react';
import { Alert } from 'react-native';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { VisionAssetsProvider, useVisionAssets, type VisionAsset } from '../store/vision';
import { FINAL_STAGE } from '../lib/vision-stage';

const wrapper = ({ children }: { children: React.ReactNode }) => <VisionAssetsProvider>{children}</VisionAssetsProvider>;
const ready: VisionAsset = {
  id: 'a1', goal_id: 'g1', stage: FINAL_STAGE, storage_path: 'u1/g1.jpg', prompt_hash: 'h', seed: 1,
  status: 'ready', error_msg: null, generated_at: '2026-09-01T00:00:00Z', last_regen_at: null, regen_count: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPlan = { plan: 'free', loaded: true };
  mockRows.mockResolvedValue({ data: [ready], error: null });
});

describe('I3: requestRegen failure', () => {
  it.each([
    ['an error response', () => mockInvoke.mockResolvedValue({ data: null, error: { message: 'pro_required' } })],
    ['a rejected call', () => mockInvoke.mockRejectedValue(new Error('offline'))],
  ])('restores the asset and tells the user on %s', async (_, arrange) => {
    arrange();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useVisionAssets(), { wrapper });
    await waitFor(() => expect(result.current.getAsset('g1', FINAL_STAGE)?.status).toBe('ready'));

    await act(async () => { result.current.requestRegen('g1', FINAL_STAGE, 'Learn Spanish', 'career'); });
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Couldn't regenerate", 'Please try again later.'));
    expect(result.current.getAsset('g1', FINAL_STAGE)?.status).toBe('ready');
    alert.mockRestore();
  });
});

describe('I4: image cap', () => {
  it('clears the cap caption when the user becomes Beyond by any route', async () => {
    mockRows.mockResolvedValue({ data: [], error: null });
    mockInvoke.mockResolvedValue({ data: [{ goal_id: 'g1', stage: FINAL_STAGE, error: 'image_limit' }], error: null });
    const { result, rerender } = renderHook(() => useVisionAssets(), { wrapper });
    await act(async () => { result.current.requestGeneration('g1', 'Learn Spanish', 'career'); });
    await waitFor(() => expect(result.current.isImageLimited('g1')).toBe(true));

    mockPlan = { plan: 'beyond', loaded: true };
    rerender({});
    expect(result.current.isImageLimited('g1')).toBe(false);
  });

  it('keeps the cap for a user who was already Beyond when the plan loaded', async () => {
    mockPlan = { plan: 'free', loaded: false };
    mockRows.mockResolvedValue({ data: [], error: null });
    mockInvoke.mockResolvedValue({ data: [{ goal_id: 'g1', stage: FINAL_STAGE, error: 'image_limit' }], error: null });
    const { result, rerender } = renderHook(() => useVisionAssets(), { wrapper });
    await act(async () => { result.current.requestGeneration('g1', 'Learn Spanish', 'career'); });
    await waitFor(() => expect(result.current.isImageLimited('g1')).toBe(true));

    mockPlan = { plan: 'beyond', loaded: true };
    rerender({});
    expect(result.current.isImageLimited('g1')).toBe(true);
  });
});
