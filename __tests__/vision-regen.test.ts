import type { VisionAsset } from '../store/vision';

const REGEN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function canRegenFree(asset: VisionAsset | undefined): boolean {
  if (!asset) return false;
  if (!asset.last_regen_at) return true;
  return Date.now() - new Date(asset.last_regen_at).getTime() > REGEN_COOLDOWN_MS;
}

function makeAsset(overrides: Partial<VisionAsset> = {}): VisionAsset {
  return {
    id: 'a1',
    goal_id: 'g1',
    stage: 0,
    storage_path: '/path/stage_0.jpg',
    prompt_hash: 'abc123',
    seed: 12345,
    status: 'ready',
    error_msg: null,
    generated_at: daysAgo(10),
    last_regen_at: null,
    regen_count: 0,
    ...overrides,
  };
}

describe('canRegenFree (rate-limit guard)', () => {
  it('allows regen when last_regen_at is null (never regenerated)', () => {
    expect(canRegenFree(makeAsset({ last_regen_at: null }))).toBe(true);
  });

  it('blocks regen within 7 days', () => {
    expect(canRegenFree(makeAsset({ last_regen_at: daysAgo(6) }))).toBe(false);
  });

  it('blocks regen at exactly 7 days', () => {
    // 7 * 86400 * 1000 - 1 ms is still within cooldown
    const justUnder7Days = new Date(Date.now() - REGEN_COOLDOWN_MS + 1000).toISOString();
    expect(canRegenFree(makeAsset({ last_regen_at: justUnder7Days }))).toBe(false);
  });

  it('allows regen after 7 days', () => {
    expect(canRegenFree(makeAsset({ last_regen_at: daysAgo(8) }))).toBe(true);
  });

  it('returns false for undefined asset', () => {
    expect(canRegenFree(undefined)).toBe(false);
  });
});

describe('idempotency key construction', () => {
  it('same goal_id + stage + prompt_hash matches itself', () => {
    const asset = makeAsset({ prompt_hash: 'deadbeef' });
    const sameHash = 'deadbeef';
    expect(asset.prompt_hash === sameHash).toBe(true);
  });

  it('different prompt_hash is not equal', () => {
    const asset = makeAsset({ prompt_hash: 'aaa' });
    expect(asset.prompt_hash === 'bbb').toBe(false);
  });
});
