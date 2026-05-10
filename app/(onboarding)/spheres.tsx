import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPHERE_COLORS, type SphereId } from '../../constants/theme';
import { F } from '../../components/ui';
import { useOnboarding } from '../../store/onboarding';
import { Progress } from './_progress';

const ALL: SphereId[] = ['finance', 'health', 'career', 'relationships'];

export default function SpheresStep() {
  const insets = useSafeAreaInsets();
  const { state, advance } = useOnboarding();
  const [picked, setPicked] = useState<SphereId[]>(state?.selections.spheres ?? []);
  const [busy, setBusy] = useState(false);

  const toggle = (id: SphereId) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const onNext = async () => {
    setBusy(true);
    const { error } = await advance('spheres', picked);
    if (!error) router.replace('/(onboarding)/tone');
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 28, backgroundColor: COLORS.paper }}>
      <Progress step={2} of={4} />
      <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, marginTop: 28 }}>Where to focus?</Text>
      <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, marginTop: 8, letterSpacing: 1 }}>
        Pick at least one. You can change these later.
      </Text>

      <ScrollView style={{ marginTop: 24 }} contentContainerStyle={{ gap: 10 }}>
        {ALL.map((id) => {
          const sel = picked.includes(id);
          const c = SPHERE_COLORS[id];
          return (
            <TouchableOpacity
              key={id}
              onPress={() => toggle(id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                paddingVertical: 18, paddingHorizontal: 18, borderRadius: 14,
                backgroundColor: sel ? c.soft : COLORS.surface,
                borderWidth: 1, borderColor: sel ? c.accent : COLORS.ink6,
              }}
            >
              <View style={{
                width: 38, height: 38, borderRadius: 19, backgroundColor: c.accent,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 18 }}>{c.glyph}</Text>
              </View>
              <Text style={{ fontFamily: F.display, fontSize: 22, color: COLORS.ink1, flex: 1 }}>{c.label}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 18, color: sel ? c.accent : COLORS.ink4 }}>
                {sel ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        onPress={onNext}
        disabled={busy || picked.length === 0}
        style={{
          marginBottom: insets.bottom + 24, marginTop: 16, paddingVertical: 16, borderRadius: 14,
          backgroundColor: COLORS.ink1, alignItems: 'center', opacity: busy || picked.length === 0 ? 0.5 : 1,
        }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
          {busy ? 'Saving…' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
