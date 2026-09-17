import { supabase } from './supabase';
import { scheduleStreakRiskNudge, scheduleSentimentCheckIn } from './notifications';

type NudgeDecision = { shouldNudge: boolean; title?: string; body?: string };

async function askAiCoach(mode: 'nudge-streak' | 'nudge-sentiment'): Promise<NudgeDecision | null> {
  const { data, error } = await supabase.functions.invoke('ai-coach', { body: { mode } });
  if (error || !data) return null;
  return data as NudgeDecision;
}

// Call after the morning ritual is locked. Best-effort: never throws, never
// blocks the ritual flow. Replaces the static evening-close notification
// with AI-written copy when the day's must-do is still undone.
export async function requestStreakRiskNudge(mustDoDone: boolean): Promise<void> {
  if (mustDoDone) return;
  const decision = await askAiCoach('nudge-streak').catch(() => null);
  if (!decision?.shouldNudge || !decision.title || !decision.body) return;
  await scheduleStreakRiskNudge(decision.title, decision.body).catch(() => {});
}

// Call after a journal entry is saved. Best-effort: never throws, never
// blocks the save. Schedules a one-off check-in when sentiment is trending
// down across recent entries.
export async function requestSentimentCheckIn(): Promise<void> {
  const decision = await askAiCoach('nudge-sentiment').catch(() => null);
  if (!decision?.shouldNudge || !decision.title || !decision.body) return;
  await scheduleSentimentCheckIn(decision.title, decision.body).catch(() => {});
}
