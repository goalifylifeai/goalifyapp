import type { VisionAsset } from '../store/vision';
import type { Plan } from './plan-state';

/**
 * generate-vision returns `error: 'image_limit'` rows for goals it refused to
 * draw over the cap, and `error: 'images_disabled'` for accounts that never
 * get images (the QA account).
 */
export function splitGenerationResults(
  rows: Array<VisionAsset & { error?: string }>,
): { assets: VisionAsset[]; limitedGoalIds: string[]; disabledGoalIds: string[] } {
  const assets: VisionAsset[] = [];
  const limitedGoalIds: string[] = [];
  const disabledGoalIds: string[] = [];
  for (const row of rows) {
    if (row.error === 'image_limit') limitedGoalIds.push(row.goal_id);
    else if (row.error === 'images_disabled') disabledGoalIds.push(row.goal_id);
    else assets.push(row);
  }
  return { assets, limitedGoalIds, disabledGoalIds };
}

export function imageLimitCaption(plan: Plan): string {
  return plan === 'free'
    ? 'Vision images for every goal with Beyond'
    : "This month's vision images are used up. More on the 1st.";
}
