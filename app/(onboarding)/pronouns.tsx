import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { useOnboarding } from '../../store/onboarding';
import { Progress } from './_progress';

const SUGGESTIONS = ['she/her', 'he/him', 'they/them'];

export default function PronounsStep() {
  const insets = useSafeAreaInsets();
  const { state, advance, complete } = useOnboarding();
  const [pronouns, setPronouns] = useState(state?.selections.pronouns ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (skip: boolean) => {
    setBusy(true); setError(null);
    const { error: err } = await advance('pronouns', skip ? undefined : pronouns.trim() || undefined);
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    router.replace('/(onboarding)/future-letter');
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: COLORS.paper }}>
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 28 }}>
        <Progress step={4} of={5} />
        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, marginTop: 28 }}>Pronouns?</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, marginTop: 8, letterSpacing: 1 }}>
          Optional. Used by gender-aware coaching.
        </Text>

        <TextInput
          value={pronouns}
          onChangeText={setPronouns}
          placeholder="she/her"
          placeholderTextColor={COLORS.ink4}
          style={{
            marginTop: 28, paddingVertical: 14, fontSize: 22, color: COLORS.ink1,
            borderBottomWidth: 1, borderBottomColor: COLORS.ink5,
          }}
          maxLength={30}
        />

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setPronouns(s)}
              style={{
                paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.ink6,
              }}
            >
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink2 }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#A33', marginTop: 12 }}>{error}</Text>}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={() => finish(false)}
          disabled={busy}
          style={{
            paddingVertical: 16, borderRadius: 14, backgroundColor: COLORS.ink1,
            alignItems: 'center', opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
            {busy ? 'Finishing…' : 'Finish'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => finish(true)} disabled={busy} style={{ marginTop: 12, marginBottom: insets.bottom + 16, alignItems: 'center' }}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3 }}>Skip</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
