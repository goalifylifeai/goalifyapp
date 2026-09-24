import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { F } from '../components/ui';
import { BEYOND_FEATURES, PAID_PLAN_NAME, PRIVACY_URL, TERMS_URL } from '../constants/brand';
import { usePlan } from '../store/plan';
import {
  annualSavingsPercent, dropPendingAction, paywallHeadline, primaryLabel, renewalTerms, takePendingAction,
} from '../lib/paywall';
import type { PaywallSource } from '../lib/plan-state';
import { track } from '../lib/analytics';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ source?: string; token?: string }>();
  const source = (params.source ?? 'profile') as PaywallSource;
  const token = params.token;
  const { plan, loaded, available, packages, trialEligibleFor, purchase, restore } = usePlan();
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState(false);
  const finished = useRef(false);

  // A swipe-down dismiss unmounts without pressing a button: drop the continuation.
  useEffect(() => () => {
    if (finished.current) return;
    dropPendingAction(token);
    track('paywall_dismissed', { source });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const pkg = (period === 'annual' ? packages.annual : packages.monthly) ?? packages.monthly ?? packages.annual;
  const eligible = trialEligibleFor(pkg);

  // Once per opening, after the plan loaded, so trial eligibility and prices are
  // known. Not for Beyond users: the paywall closes itself for them (below).
  const viewed = useRef(false);
  useEffect(() => {
    if (!loaded || viewed.current || plan === 'beyond') return;
    viewed.current = true;
    track('paywall_viewed', { source, trial_eligible: eligible, packages_available: available && !!pkg });
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const savings = annualSavingsPercent(packages.monthly, packages.annual);

  const unlocked = () => {
    if (finished.current) return;
    finished.current = true;
    const action = takePendingAction(token);
    router.back();
    action?.();
  };

  // Already on Beyond (stale state, deep link): never sell a second
  // subscription, just carry on with what opened the paywall. Not while a
  // purchase/restore is in flight: that path finishes after the server sync.
  const subscribed = loaded && plan === 'beyond';
  useEffect(() => {
    if (subscribed && !busy) unlocked();
  }, [subscribed, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    finished.current = true;
    track('paywall_dismissed', { source });
    dropPendingAction(token);
    router.back();
  };

  const onBuy = async () => {
    if (!pkg || busy) return;
    setBusy(true);
    track('purchase_started', { source, period: pkg.period, trial_eligible: eligible });
    try {
      if (await purchase(pkg, source) === 'purchased') unlocked();
    } catch (e) {
      track('purchase_failed', { source, period: pkg.period });
      Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const restored = await restore();
      track('restore_completed', { result: restored === 'beyond' ? 'beyond' : 'none' });
      if (restored === 'beyond') unlocked();
      else Alert.alert('No subscription found', `We couldn't find a ${PAID_PLAN_NAME} subscription for this account.`);
    } catch {
      track('restore_completed', { result: 'error' });
      Alert.alert('Restore failed', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}>
      <TouchableOpacity onPress={close} style={s.close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={s.closeText}>{source === 'welcome' ? 'Maybe later' : 'Not now'}</Text>
      </TouchableOpacity>

      <Text style={s.kicker}>{PAID_PLAN_NAME}</Text>
      <Text style={s.headline}>{paywallHeadline(source)}</Text>

      <View style={s.features}>
        {BEYOND_FEATURES.map(f => (
          <View key={f.title} style={s.feature}>
            <Text style={s.featureTitle}>✦ {f.title}</Text>
            <Text style={s.featureDetail}>{f.detail}</Text>
          </View>
        ))}
      </View>

      {!loaded || (subscribed && !busy) ? (
        <ActivityIndicator color={COLORS.ink1} style={{ marginTop: 24 }} />
      ) : !available || !pkg ? (
        <Text style={s.unavailable}>Subscriptions aren't available on this device right now.</Text>
      ) : (
        <>
          {packages.monthly && packages.annual && (
            <View style={s.periods}>
              {(['monthly', 'annual'] as const).map(p => {
                const option = packages[p]!;
                const selected = period === p;
                return (
                  <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={[s.period, selected && s.periodSelected]}>
                    <Text style={[s.periodName, selected && s.periodNameSelected]}>{p === 'annual' ? 'Yearly' : 'Monthly'}</Text>
                    <Text style={[s.periodPrice, selected && s.periodNameSelected]}>
                      {option.priceString}/{p === 'annual' ? 'year' : 'month'}
                    </Text>
                    {p === 'annual' && savings ? <Text style={s.save}>Save {savings}%</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity onPress={onBuy} disabled={busy} style={[s.cta, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color={COLORS.paper} /> : <Text style={s.ctaText}>{primaryLabel(pkg, eligible)}</Text>}
          </TouchableOpacity>

          <Text style={s.terms}>{renewalTerms(Platform.OS, pkg, eligible, new Date())}</Text>
        </>
      )}

      <TouchableOpacity onPress={onRestore} disabled={busy} style={s.restore}>
        <Text style={s.link}>Restore purchases</Text>
      </TouchableOpacity>
      <View style={s.legal}>
        <Text style={s.link} onPress={() => Linking.openURL(TERMS_URL)}>Terms of Use</Text>
        <Text style={s.link}> · </Text>
        <Text style={s.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper, paddingHorizontal: 24 },
  close: { alignSelf: 'flex-end', paddingVertical: 4 },
  closeText: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.ink3 },
  kicker: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: COLORS.accentWarm, marginTop: 24 },
  headline: { fontFamily: F.display, fontSize: 34, lineHeight: 38, color: COLORS.ink1, marginTop: 10, letterSpacing: -0.4 },
  features: { marginTop: 28, gap: 14 },
  feature: {},
  featureTitle: { fontSize: 15, fontWeight: '500', color: COLORS.ink1 },
  featureDetail: { fontSize: 13, color: COLORS.ink3, marginTop: 2, marginLeft: 18 },
  unavailable: { marginTop: 28, fontSize: 14, color: COLORS.ink3, textAlign: 'center' },
  periods: { flexDirection: 'row', gap: 10, marginTop: 32 },
  period: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: COLORS.ink6, padding: 14, backgroundColor: COLORS.surface },
  periodSelected: { borderColor: COLORS.ink1, backgroundColor: COLORS.ink1 },
  periodName: { fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3 },
  periodNameSelected: { color: COLORS.paper },
  periodPrice: { fontSize: 16, color: COLORS.ink1, marginTop: 6 },
  save: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.accentWarm, marginTop: 6 },
  cta: { marginTop: 20, backgroundColor: COLORS.ink1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: COLORS.paper, fontSize: 15, fontWeight: '600' },
  terms: { marginTop: 14, fontSize: 11, lineHeight: 16, color: COLORS.ink3, textAlign: 'center' },
  restore: { marginTop: 24, alignItems: 'center' },
  legal: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  link: { fontSize: 12, color: COLORS.ink3, textDecorationLine: 'underline' },
});
