import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { useOnboarding } from '../../store/onboarding';
import { Progress } from './_progress';

export default function NameStep() {
  const insets = useSafeAreaInsets();
  const { state, advance } = useOnboarding();
  const [name, setName] = useState(state?.selections.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 1 && name.trim().length <= 50;

  const onNext = async () => {
    setBusy(true); setError(null);
    const { error: err } = await advance('display_name', name.trim());
    if (err) setError(err);
    else router.replace('/(onboarding)/spheres');
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: COLORS.paper }}>
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 28 }}>
        <Progress step={1} of={4} />
        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, marginTop: 28 }}>What should we call you?</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, marginTop: 8, letterSpacing: 1 }}>
          Used in your daily check-ins.
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          autoFocus
          placeholder="Your name"
          placeholderTextColor={COLORS.ink4}
          style={{
            marginTop: 32, paddingVertical: 14, fontSize: 24, color: COLORS.ink1,
            borderBottomWidth: 1, borderBottomColor: COLORS.ink5,
          }}
          maxLength={50}
        />

        {error && <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#A33', marginTop: 12 }}>{error}</Text>}

        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={onNext}
          disabled={!valid || busy}
          style={{
            marginBottom: insets.bottom + 24, paddingVertical: 16, borderRadius: 14,
            backgroundColor: COLORS.ink1, alignItems: 'center', opacity: !valid || busy ? 0.5 : 1,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
            {busy ? 'Saving…' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
