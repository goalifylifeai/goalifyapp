import { splitGenerationResults, imageLimitCaption } from '../lib/vision-limit';
import type { VisionAsset } from '../store/vision';

const ready: VisionAsset = {
  id: 'a1', goal_id: 'g1', stage: 3, storage_path: 'p', prompt_hash: 'h', seed: 1, status: 'ready',
  error_msg: null, generated_at: null, last_regen_at: null, regen_count: 0,
};

describe('splitGenerationResults', () => {
  it('separates image_limit results from real assets', () => {
    const limited = { ...ready, id: '', goal_id: 'g2', status: 'pending' as const, error: 'image_limit' };
    expect(splitGenerationResults([ready, limited])).toEqual({ assets: [ready], limitedGoalIds: ['g2'] });
  });
});

describe('imageLimitCaption', () => {
  it('invites Free users to Beyond', () =>
    expect(imageLimitCaption('free')).toBe('Vision images for every goal with Beyond'));
  it('tells Beyond users when it resets', () =>
    expect(imageLimitCaption('beyond')).toBe("This month's vision images are used up. More on the 1st."));
});
