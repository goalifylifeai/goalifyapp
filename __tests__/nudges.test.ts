// ── Mocks ─────────────────────────────────────────────────────────
const mockInvoke = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

const mockScheduleStreakRiskNudge = jest.fn().mockResolvedValue(undefined);
const mockScheduleSentimentCheckIn = jest.fn().mockResolvedValue(undefined);

jest.mock('../lib/notifications', () => ({
  scheduleStreakRiskNudge: (...args: unknown[]) => mockScheduleStreakRiskNudge(...args),
  scheduleSentimentCheckIn: (...args: unknown[]) => mockScheduleSentimentCheckIn(...args),
}));

import { requestStreakRiskNudge, requestSentimentCheckIn } from '../lib/nudges';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('requestStreakRiskNudge', () => {
  it('does nothing when the must-do is already done', async () => {
    await requestStreakRiskNudge(true);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockScheduleStreakRiskNudge).not.toHaveBeenCalled();
  });

  it('asks ai-coach and schedules the returned copy when a nudge is warranted', async () => {
    mockInvoke.mockResolvedValue({
      data: { shouldNudge: true, title: 'Your streak needs you', body: 'One more day.' },
      error: null,
    });
    await requestStreakRiskNudge(false);
    expect(mockInvoke).toHaveBeenCalledWith('ai-coach', { body: { mode: 'nudge-streak' } });
    expect(mockScheduleStreakRiskNudge).toHaveBeenCalledWith('Your streak needs you', 'One more day.');
  });

  it('does not schedule anything when ai-coach says not to nudge', async () => {
    mockInvoke.mockResolvedValue({ data: { shouldNudge: false }, error: null });
    await requestStreakRiskNudge(false);
    expect(mockScheduleStreakRiskNudge).not.toHaveBeenCalled();
  });

  it('swallows ai-coach errors without throwing', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('network down') });
    await expect(requestStreakRiskNudge(false)).resolves.toBeUndefined();
    expect(mockScheduleStreakRiskNudge).not.toHaveBeenCalled();
  });
});

describe('requestSentimentCheckIn', () => {
  it('asks ai-coach and schedules the returned copy when a check-in is warranted', async () => {
    mockInvoke.mockResolvedValue({
      data: { shouldNudge: true, title: 'Checking in', body: 'The last few days have felt heavy.' },
      error: null,
    });
    await requestSentimentCheckIn();
    expect(mockInvoke).toHaveBeenCalledWith('ai-coach', { body: { mode: 'nudge-sentiment' } });
    expect(mockScheduleSentimentCheckIn).toHaveBeenCalledWith('Checking in', 'The last few days have felt heavy.');
  });

  it('does not schedule anything when ai-coach says not to nudge', async () => {
    mockInvoke.mockResolvedValue({ data: { shouldNudge: false }, error: null });
    await requestSentimentCheckIn();
    expect(mockScheduleSentimentCheckIn).not.toHaveBeenCalled();
  });

  it('swallows ai-coach errors without throwing', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('network down') });
    await expect(requestSentimentCheckIn()).resolves.toBeUndefined();
    expect(mockScheduleSentimentCheckIn).not.toHaveBeenCalled();
  });
});
