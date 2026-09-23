import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { F } from '../components/ui';
import { PAID_PLAN_NAME } from '../constants/brand';
import { openPaywall } from '../lib/paywall';

const CHANGES = [
  'Coach chat: 10 messages in total',
  'Personalized insights: 3 a month',
  'Vision images: 10 a month, no regenerating',
];

export default function TrialEndedScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }}>
      <Text style={s.kicker}>{PAID_PLAN_NAME}</Text>
      <Text style={s.headline}>Your trial has ended</Text>
      <Text style={s.body}>You're on the Free plan now. What changes:</Text>
      <View style={{ gap: 8, marginTop: 14 }}>
        {CHANGES.map(c => <Text key={c} style={s.item}>· {c}</Text>)}
      </View>
      <Text style={s.body}>Everything you created stays: goals, habits, journal, images and letters.</Text>

      <TouchableOpacity
        style={s.cta}
        onPress={() => { router.back(); openPaywall('trial_ended'); }}
      >
        <Text style={s.ctaText}>Resubscribe</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.secondary} onPress={() => router.back()}>
        <Text style={s.secondaryText}>Continue with Free</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper, paddingHorizontal: 24 },
  kicker: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: COLORS.accentWarm },
  headline: { fontFamily: F.display, fontSize: 32, color: COLORS.ink1, marginTop: 10 },
  body: { fontSize: 14, lineHeight: 21, color: COLORS.ink2, marginTop: 18 },
  item: { fontSize: 14, color: COLORS.ink2 },
  cta: { marginTop: 32, backgroundColor: COLORS.ink1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: COLORS.paper, fontSize: 15, fontWeight: '600' },
  secondary: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { fontSize: 14, color: COLORS.ink3 },
});
