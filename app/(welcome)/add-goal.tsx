import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import type { SphereId } from '../../constants/theme';
import { F } from '../../components/ui';
import { useStore } from '../../store';
import { useOnboarding } from '../../store/onboarding';

const SPHERES = Object.keys(SPHERE_COLORS) as SphereId[];

export default function WelcomeAddGoal() {
  const insets = useSafeAreaInsets();
  const { state: onboarding } = useOnboarding();
  const { dispatch } = useStore();

  const [sphere, setSphere] = useState<SphereId>('career');
  const [title, setTitle] = useState('');

  const name = onboarding?.selections?.display_name?.split(' ')[0] ?? 'there';

  const save = () => {
    const t = title.trim();
    if (!t) return;
    const goalId = `g-${Date.now()}`;
    dispatch({
      type: 'ADD_GOAL',
      goal: { id: goalId, sphere, title: t, due: 'TBD', progress: 0, sub: [] },
    });
    router.replace({ pathname: '/(welcome)/add-task', params: { goalId, goalTitle: t, sphere } });
  };

  const skip = () => router.replace('/(tabs)');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: COLORS.paper }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 32, paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step indicator */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 32 }}>
          <View style={{ height: 3, flex: 1, borderRadius: 99, backgroundColor: COLORS.ink1 }} />
          <View style={{ height: 3, flex: 1, borderRadius: 99, backgroundColor: COLORS.ink6 }} />
        </View>

        {/* What the app is */}
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>
          You're in, {name}.
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, lineHeight: 44, letterSpacing: -0.5, marginBottom: 16 }}>
          Goals drive{'\n'}everything here.
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, lineHeight: 19, letterSpacing: 0.2, marginBottom: 36 }}>
          Goalify works like this: you set a goal, break it into tasks, and check in daily. Your coach watches the patterns and keeps you honest.
        </Text>

        {/* Sphere picker */}
        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 10 }}>
          Which area of life?
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
          {SPHERES.map(id => {
            const s = SPHERE_COLORS[id];
            const active = sphere === id;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => setSphere(id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                  backgroundColor: active ? s.accent : COLORS.surface,
                  borderWidth: 1, borderColor: active ? s.accent : COLORS.ink6,
                }}
              >
                <Text style={{ fontSize: 13, color: active ? '#fff' : s.deep }}>{s.glyph}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 0.5, color: active ? '#fff' : COLORS.ink2 }}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Goal title */}
        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 10 }}>
          Name your first goal
        </Text>
        <View style={{
          borderRadius: 14, backgroundColor: COLORS.surface,
          borderWidth: 1, borderColor: COLORS.ink6, padding: 16, marginBottom: 32,
        }}>
          <TextInput
            autoFocus
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Save £10k this year"
            placeholderTextColor={COLORS.ink4}
            returnKeyType="done"
            onSubmitEditing={save}
            style={{
              fontFamily: F.display, fontSize: 22, color: COLORS.ink1,
              lineHeight: 28, letterSpacing: -0.2,
            }}
          />
        </View>

        <TouchableOpacity
          onPress={save}
          disabled={!title.trim()}
          style={{
            paddingVertical: 16, borderRadius: 14, backgroundColor: COLORS.ink1,
            alignItems: 'center', opacity: title.trim() ? 1 : 0.4,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
            Set this goal →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={skip} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3 }}>
            Skip — I'll add goals later
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
