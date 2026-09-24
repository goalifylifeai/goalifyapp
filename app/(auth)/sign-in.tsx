import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { AuthField, EMAIL_INPUT } from '../../components/AuthField';
import { useAuth } from '../../store/auth';
import { mapAuthError } from '../../lib/auth-errors';
import { track } from '../../lib/analytics';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = !busy && !!email.trim() && !!password;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true); setError(null);
    try {
      const { error: err } = await signIn(email.trim(), password);
      if (err) track('auth_failed', { method: 'email', stage: 'sign_in' });
      else track('signed_in', { method: 'email' });
      if (err) setError(mapAuthError(err.message));
    } catch (e) {
      setError(mapAuthError((e as Error)?.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 28, backgroundColor: COLORS.paper }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, letterSpacing: 1.5 }}>← Back</Text>
        </TouchableOpacity>

        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, marginTop: 28 }}>Welcome back.</Text>

        <View style={{ marginTop: 32, gap: 14 }}>
          <AuthField
            testID="email-input" label="Email" editable={!busy} value={email} onChangeText={setEmail}
            {...EMAIL_INPUT} onSubmitEditing={() => passwordRef.current?.focus()} submitBehavior="submit"
          />
          <AuthField
            ref={passwordRef} testID="password-input" label="Password" editable={!busy} value={password}
            onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password"
            returnKeyType="go" onSubmitEditing={onSubmit}
          />
        </View>

        {error && <Text style={errStyle}>{error}</Text>}

        <TouchableOpacity testID="sign-in-button" onPress={onSubmit} disabled={!canSubmit} style={[btn, { marginTop: 24, opacity: canSubmit ? 1 : 0.5 }]}>
          <Text style={btnText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/reset-password" asChild>
          <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3 }}>Forgot password?</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const btn = {
  paddingVertical: 16,
  borderRadius: 14,
  backgroundColor: COLORS.ink1,
  alignItems: 'center' as const,
};
const btnText = { fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper };
const errStyle = { fontFamily: F.mono, fontSize: 11, color: '#A33', marginTop: 16 };
