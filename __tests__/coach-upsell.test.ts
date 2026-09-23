import { showInsightsUpsell } from '../lib/coach-upsell';

const NOW = new Date('2026-10-01T12:00:00Z');

describe('showInsightsUpsell', () => {
  it('shows on Free once insights are more than a day old', () => {
    expect(showInsightsUpsell('free', '2026-09-30T11:00:00Z', NOW)).toBe(true);
  });
  it('hides while insights are fresh', () => {
    expect(showInsightsUpsell('free', '2026-10-01T02:00:00Z', NOW)).toBe(false);
  });
  it('hides on Beyond and when there are no insights', () => {
    expect(showInsightsUpsell('beyond', '2026-09-01T00:00:00Z', NOW)).toBe(false);
    expect(showInsightsUpsell('free', null, NOW)).toBe(false);
  });
});
