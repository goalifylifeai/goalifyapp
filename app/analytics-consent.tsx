// One-time opt-in for product analytics (§25 TDDDG): both answers carry equal
// weight, and nothing is sent until the user picks "Allow". The choice can be
// changed any time in Profile.

import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { F } from '../components/ui';
import { PRIVACY_URL } from '../constants/brand';
import { setAnalyticsConsent } from '../lib/analytics';

const WHAT_WE_SEE = [
  'Which screens you open and which features you use',
  'Counts and categories, like "a habit was checked" or which sphere a goal is in',
  'Your plan (Free or Beyond)',
];

const NEVER = 'Never the words you write: no goal titles, journal entries, letters, coach messages, name or email.';

export default function AnalyticsConsentScreen() {
  const insets = useSafeAreaInsets();
  const choose = (granted: boolean) => {
    setAnalyticsConsent(granted);
    if (router.canGoBack()) router.back();
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }}>
      <Text style={s.kicker}>Your privacy</Text>
      <Text style={s.headline}>Help us make Goalify better?</Text>
      <Text style={s.body}>
        With your permission, we collect anonymous usage data (linked to a random account ID) to learn what helps
        people keep going. It's stored in the EU and never sold or used for ads.
      </Text>
      <View style={{ gap: 8, marginTop: 14 }}>
        {WHAT_WE_SEE.map(c => <Text key={c} style={s.item}>· {c}</Text>)}
      </View>
      <Text style={s.body}>{NEVER}</Text>
      <Text style={s.body}>You can change this any time in Profile.</Text>

      <View style={s.choices}>
        <TouchableOpacity testID="consent-deny" style={s.choice} onPress={() => choose(false)}>
          <Text style={s.choiceText}>No thanks</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="consent-allow" style={s.choice} onPress={() => choose(true)}>
          <Text style={s.choiceText}>Allow</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper, paddingHorizontal: 24 },
  kicker: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: COLORS.accentWarm },
  headline: { fontFamily: F.display, fontSize: 32, color: COLORS.ink1, marginTop: 10 },
  body: { fontSize: 14, lineHeight: 21, color: COLORS.ink2, marginTop: 18 },
  item: { fontSize: 14, lineHeight: 20, color: COLORS.ink2 },
  // Equal weight on purpose: same size, same style for both answers.
  choices: { flexDirection: 'row', gap: 12, marginTop: 32 },
  choice: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: COLORS.ink1,
    paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.surface,
  },
  choiceText: { color: COLORS.ink1, fontSize: 15, fontWeight: '600' },
  link: { marginTop: 20, fontSize: 12, color: COLORS.ink3, textDecorationLine: 'underline', textAlign: 'center' },
});
