import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { AuthField, EMAIL_INPUT } from '../../components/AuthField';
import { useAuth } from '../../store/auth';
import { track } from '../../lib/analytics';
import { mapAuthError } from '../../lib/auth-errors';

export default function SignUp() {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 8;

  const onSubmit = async () => {
    if (busy || !valid) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      const { error: err } = await signUp(email.trim(), password);
      track(err ? 'auth_failed' : 'signed_up', err ? { method: 'email', stage: 'sign_up' } : { method: 'email' });
      if (err) setError(err.message);
      else setInfo('Check your email to confirm your account, then sign in.');
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

        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, marginTop: 28 }}>Create account.</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, marginTop: 6, letterSpacing: 1 }}>
          Password must be at least 8 characters.
        </Text>

        <View style={{ marginTop: 32, gap: 14 }}>
          <AuthField
            label="Email" editable={!busy} value={email} onChangeText={setEmail}
            {...EMAIL_INPUT} onSubmitEditing={() => passwordRef.current?.focus()} submitBehavior="submit"
          />
          <AuthField
            ref={passwordRef} label="Password" editable={!busy} value={password} onChangeText={setPassword}
            secureTextEntry autoComplete="new-password" textContentType="newPassword"
            returnKeyType="go" onSubmitEditing={onSubmit}
          />
        </View>

        {error && <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#A33', marginTop: 16 }}>{error}</Text>}
        {info && <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink2, marginTop: 16 }}>{info}</Text>}

        <TouchableOpacity onPress={onSubmit} disabled={busy || !valid} style={{
          marginTop: 24, paddingVertical: 16, borderRadius: 14, backgroundColor: COLORS.ink1, alignItems: 'center',
          opacity: busy || !valid ? 0.5 : 1,
        }}>
          <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
            {busy ? 'Creating…' : 'Create account'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
