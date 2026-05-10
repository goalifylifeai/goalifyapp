export type VisionStage = 0 | 1 | 2 | 3;

export function stageFromProgress(progress: number): VisionStage {
  if (progress < 0.25) return 0;
  if (progress < 0.50) return 1;
  if (progress < 0.75) return 2;
  return 3;
}

export const STAGE_LABELS: Record<VisionStage, string> = {
  0: 'Beginning',
  1: 'Building',
  2: 'Momentum',
  3: 'Arriving',
};
