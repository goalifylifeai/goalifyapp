import type { VisionAsset } from '../store/vision';
import type { Plan } from './plan-state';

/** generate-vision returns `error: 'image_limit'` rows for goals it refused to draw. */
export function splitGenerationResults(
  rows: Array<VisionAsset & { error?: string }>,
): { assets: VisionAsset[]; limitedGoalIds: string[] } {
  const assets: VisionAsset[] = [];
  const limitedGoalIds: string[] = [];
  for (const row of rows) {
    if (row.error === 'image_limit') limitedGoalIds.push(row.goal_id);
    else assets.push(row);
  }
  return { assets, limitedGoalIds };
}

export function imageLimitCaption(plan: Plan): string {
  return plan === 'free'
    ? 'Vision images for every goal with Beyond'
    : "This month's vision images are used up. More on the 1st.";
}
