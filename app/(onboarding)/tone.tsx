import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { useOnboarding } from '../../store/onboarding';
import { Progress } from './_progress';

const TONES = [
  { id: 'warm', label: 'Warm', desc: 'Gentle, encouraging.' },
  { id: 'direct', label: 'Direct', desc: 'No fluff. Get to the point.' },
  { id: 'playful', label: 'Playful', desc: 'Light, curious, a little funny.' },
] as const;

export default function ToneStep() {
  const insets = useSafeAreaInsets();
  const { state, advance } = useOnboarding();
  const [pick, setPick] = useState<typeof TONES[number]['id'] | null>(state?.selections.coaching_tone ?? null);
  const [busy, setBusy] = useState(false);

  const onNext = async () => {
    if (!pick) return;
    setBusy(true);
    const { error } = await advance('coaching_tone', pick);
    if (!error) router.replace('/(onboarding)/pronouns');
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 28, backgroundColor: COLORS.paper }}>
      <Progress step={3} of={4} />
      <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, marginTop: 28 }}>Coaching tone?</Text>
      <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, marginTop: 8, letterSpacing: 1 }}>
        How should we talk to you?
      </Text>

      <View style={{ marginTop: 28, gap: 10 }}>
        {TONES.map((t) => {
          const sel = pick === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setPick(t.id)}
              style={{
                paddingVertical: 18, paddingHorizontal: 18, borderRadius: 14,
                backgroundColor: sel ? COLORS.ink1 : COLORS.surface,
                borderWidth: 1, borderColor: sel ? COLORS.ink1 : COLORS.ink6,
              }}
            >
              <Text style={{ fontFamily: F.display, fontSize: 24, color: sel ? COLORS.paper : COLORS.ink1 }}>{t.label}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: sel ? COLORS.ink6 : COLORS.ink3, marginTop: 4 }}>
                {t.desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />
      <TouchableOpacity
        onPress={onNext}
        disabled={busy || !pick}
        style={{
          marginBottom: insets.bottom + 24, paddingVertical: 16, borderRadius: 14,
          backgroundColor: COLORS.ink1, alignItems: 'center', opacity: busy || !pick ? 0.5 : 1,
        }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
          {busy ? 'Saving…' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
