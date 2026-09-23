import type { Plan } from './plan-state';

const DAY_MS = 24 * 60 * 60 * 1000;

/** U3: a quiet line under Free users' insights once they're over a day old. */
export function showInsightsUpsell(plan: Plan, insightsUpdatedAt: string | null, now: Date): boolean {
  if (plan !== 'free' || !insightsUpdatedAt) return false;
  return now.getTime() - Date.parse(insightsUpdatedAt) > DAY_MS;
}
