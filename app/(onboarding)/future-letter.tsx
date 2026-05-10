import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { useOnboarding } from '../../store/onboarding';
import { useFutureSelf, type FutureLetterHorizon } from '../../store/future-self';
import { Progress } from './_progress';

const HORIZONS: { id: FutureLetterHorizon; label: string }[] = [
  { id: '1m', label: '1 month' },
  { id: '3m', label: '3 months' },
  { id: '6m', label: '6 months' },
  { id: '1y', label: '1 year' },
];

const MAX_CHARS = 4000;

export default function FutureLetterStep() {
  const insets = useSafeAreaInsets();
  const { complete } = useOnboarding();
  const { saveLetter } = useFutureSelf();

  const [horizon, setHorizon] = useState<FutureLetterHorizon>('1y');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (skip: boolean) => {
    setBusy(true);
    setError(null);

    if (!skip && body.trim().length > 0) {
      const { error: saveErr } = await saveLetter({ horizon, body: body.trim() });
      if (saveErr) {
        setError(saveErr);
        setBusy(false);
        return;
      }
    }

    const { error: err } = await complete({});
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    router.replace('/(welcome)/add-goal');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: COLORS.paper }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingHorizontal: 28 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Progress step={5} of={5} />

        <Text style={{ fontFamily: F.display, fontSize: 36, color: COLORS.ink1, marginTop: 28, lineHeight: 42, letterSpacing: -0.5 }}>
          Write to your{'\n'}future self.
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, marginTop: 8, letterSpacing: 1, lineHeight: 18 }}>
          One year from now, what do you hope is true?{'\n'}Write to that person.
        </Text>

        {/* Horizon selector */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 24, flexWrap: 'wrap' }}>
          {HORIZONS.map(h => (
            <TouchableOpacity
              key={h.id}
              onPress={() => setHorizon(h.id)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: horizon === h.id ? COLORS.ink1 : COLORS.surface,
                borderWidth: 1,
                borderColor: horizon === h.id ? COLORS.ink1 : COLORS.ink6,
              }}
            >
              <Text style={{
                fontFamily: F.mono,
                fontSize: 11,
                letterSpacing: 0.5,
                color: horizon === h.id ? COLORS.paper : COLORS.ink2,
              }}>
                {h.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Letter input */}
        <View style={{
          marginTop: 20,
          borderRadius: 12,
          backgroundColor: COLORS.surface,
          borderWidth: 1,
          borderColor: COLORS.ink6,
          padding: 16,
          minHeight: 200,
        }}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Dear future me…"
            placeholderTextColor={COLORS.ink4}
            multiline
            style={{
              fontFamily: F.displayItalic,
              fontSize: 17,
              color: COLORS.ink1,
              lineHeight: 26,
              letterSpacing: -0.1,
              minHeight: 168,
              textAlignVertical: 'top',
            }}
            maxLength={MAX_CHARS}
          />
        </View>
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink4, textAlign: 'right', marginTop: 6 }}>
          {body.length} / {MAX_CHARS}
        </Text>

        {error && (
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#A33', marginTop: 12 }}>{error}</Text>
        )}

        <View style={{ height: 32 }} />

        <TouchableOpacity
          onPress={() => save(false)}
          disabled={busy}
          style={{
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: COLORS.ink1,
            alignItems: 'center',
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
            {busy ? 'Saving…' : body.trim() ? 'Save & continue' : 'Continue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => save(true)}
          disabled={busy}
          style={{ marginTop: 12, marginBottom: insets.bottom + 20, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3 }}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
