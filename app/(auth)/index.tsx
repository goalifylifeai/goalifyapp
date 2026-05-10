import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { useAuth } from '../../store/auth';

export default function AuthLanding() {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onGoogle = async () => {
    setBusy('google'); setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) setError(err.message);
    setBusy(null);
  };
  const onApple = async () => {
    setBusy('apple'); setError(null);
    const { error: err } = await signInWithApple();
    if (err) setError(err.message);
    setBusy(null);
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 80, paddingHorizontal: 28, backgroundColor: COLORS.paper }}>
      <Text style={{ fontFamily: F.display, fontSize: 56, color: COLORS.ink1, lineHeight: 60 }}>Goalify.</Text>
      <Text style={{ fontFamily: F.displayItalic, fontSize: 22, color: COLORS.ink2, marginTop: 4 }}>
        Become the steadiest version of you.
      </Text>

      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: insets.bottom + 32, gap: 12 }}>
        {error && (
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#A33', textAlign: 'center' }}>{error}</Text>
        )}

        <Link href="/(auth)/sign-up" asChild>
          <TouchableOpacity style={btn(true)}>
            <Text style={btnText(true)}>Create account</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity style={btn(false)}>
            <Text style={btnText(false)}>I already have an account</Text>
          </TouchableOpacity>
        </Link>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <View style={{ flex: 1, height: 0.5, backgroundColor: COLORS.ink5 }} />
          <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, color: COLORS.ink3, textTransform: 'uppercase' }}>or</Text>
          <View style={{ flex: 1, height: 0.5, backgroundColor: COLORS.ink5 }} />
        </View>

        <TouchableOpacity onPress={onGoogle} disabled={busy !== null} style={btn(false)}>
          <Text style={btnText(false)}>{busy === 'google' ? 'Connecting…' : 'Continue with Google'}</Text>
        </TouchableOpacity>
        {Platform.OS === 'ios' && (
          <TouchableOpacity onPress={onApple} disabled={busy !== null} style={btn(true)}>
            <Text style={btnText(true)}>{busy === 'apple' ? 'Connecting…' : 'Continue with Apple'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const btn = (primary: boolean) => ({
  paddingVertical: 16,
  borderRadius: 14,
  alignItems: 'center' as const,
  backgroundColor: primary ? COLORS.ink1 : COLORS.surface,
  borderWidth: primary ? 0 : 1,
  borderColor: COLORS.ink6,
});
const btnText = (primary: boolean) => ({
  fontFamily: F.mono,
  fontSize: 13,
  letterSpacing: 1,
  color: primary ? COLORS.paper : COLORS.ink1,
});
