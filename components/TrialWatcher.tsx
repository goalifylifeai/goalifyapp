// Renders nothing. Keeps the day-5 trial reminder in step with the plan and
// opens the "trial ended" sheet once after a cancelled trial runs out.

import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../store/auth';
import { usePlan } from '../store/plan';
import { loadSnapshot, saveSnapshot, trialJustEnded, trialReminderAt, trialReminderBody } from '../lib/trial';
import { cancelTrialEndingReminder, scheduleTrialEndingReminder } from '../lib/notifications';

export function TrialWatcher() {
  const { user } = useAuth();
  const plan = usePlan();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !plan.loaded) return;
    let cancelled = false;
    (async () => {
      const prev = await loadSnapshot(userId);
      if (cancelled) return;
      if (trialJustEnded(prev, plan, plan.loaded)) router.push('/trial-ended');
      await saveSnapshot(userId, { plan: plan.plan, isTrial: plan.isTrial });

      const at = trialReminderAt(plan, new Date());
      if (at && plan.trialEndsAt) {
        const pkg = [plan.packages.monthly, plan.packages.annual].find(p => p?.productId === plan.productId);
        await scheduleTrialEndingReminder(at, trialReminderBody(pkg?.priceString ?? null, plan.trialEndsAt)).catch(() => {});
      } else {
        await cancelTrialEndingReminder().catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [userId, plan.loaded, plan.plan, plan.isTrial, plan.willRenew, plan.trialEndsAt, plan.productId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
