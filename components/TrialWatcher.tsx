// Renders nothing. Keeps the day-5 trial reminder in step with the plan and
// opens the "trial ended" sheet once after a cancelled trial runs out.

import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../store/auth';
import { usePlan } from '../store/plan';
import {
  loadSnapshot, priceForProduct, saveSnapshot, trialJustEnded, trialReminderAt, trialReminderBody,
} from '../lib/trial';
import { track } from '../lib/analytics';
import { cancelTrialEndingReminder, scheduleTrialEndingReminder } from '../lib/notifications';

export function TrialWatcher() {
  const { user } = useAuth();
  const plan = usePlan();
  const userId = user?.id;

  useEffect(() => {
    // Only act on a plan that a source actually confirmed for this user: an
    // offline cold start's Free placeholder must not end a trial or overwrite
    // the snapshot (or cancel a valid reminder).
    if (!userId || !plan.loaded || !plan.confirmed) return;
    let cancelled = false;
    (async () => {
      const prev = await loadSnapshot(userId);
      if (cancelled) return;
      if (trialJustEnded(prev, plan, plan.loaded)) {
        track('trial_ended_viewed');
        router.push('/trial-ended');
      }
      await saveSnapshot(userId, { plan: plan.plan, isTrial: plan.isTrial });

      const at = trialReminderAt(plan, new Date());
      if (at && plan.trialEndsAt) {
        const price = priceForProduct(plan.packages, plan.productId);
        await scheduleTrialEndingReminder(at, trialReminderBody(price, plan.trialEndsAt)).catch(() => {});
      } else {
        await cancelTrialEndingReminder().catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [userId, plan.loaded, plan.confirmed, plan.plan, plan.isTrial, plan.willRenew, plan.trialEndsAt, plan.productId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
