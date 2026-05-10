import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { useAuth } from '../../store/auth';
import { supabase } from '../../lib/supabase';

// Two modes: request (default) and apply (deep-linked from email).
// We detect "apply" mode when arriving via deep link with a recovery token.
export default function ResetPassword() {
  const insets = useSafeAreaInsets();
  const { requestPasswordReset, updatePassword } = useAuth();
  const [mode, setMode] = useState<'request' | 'apply'>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    // If the deep link contained a recovery token, supabase-js parses it from the URL fragment
    // when we hand it to setSession; here we just listen for PASSWORD_RECOVERY events.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('apply');
    });
    Linking.getInitialURL().then((url) => {
      if (url && url.includes('reset-password')) setMode('apply');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const onRequest = async () => {
    setBusy(true); setError(null); setInfo(null);
    const { error: err } = await requestPasswordReset(email.trim());
    if (err) setError(err.message);
    else setInfo('If that email exists, a reset link is on its way.');
    setBusy(false);
  };

  const onApply = async () => {
    setBusy(true); setError(null);
    const { error: err } = await updatePassword(password);
    if (err) setError(err.message);
    else {
      setInfo('Password updated.');
      setTimeout(() => router.replace('/(auth)/sign-in'), 800);
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 28, backgroundColor: COLORS.paper }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, letterSpacing: 1.5 }}>← Back</Text>
        </TouchableOpacity>

        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, marginTop: 28 }}>
          {mode === 'request' ? 'Reset password.' : 'New password.'}
        </Text>

        <View style={{ marginTop: 32 }}>
          {mode === 'request' ? (
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          ) : (
            <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
          )}
        </View>

        {error && <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#A33', marginTop: 16 }}>{error}</Text>}
        {info && <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink2, marginTop: 16 }}>{info}</Text>}

        <TouchableOpacity
          onPress={mode === 'request' ? onRequest : onApply}
          disabled={busy || (mode === 'request' ? !email : password.length < 8)}
          style={{
            marginTop: 24, paddingVertical: 16, borderRadius: 14, backgroundColor: COLORS.ink1, alignItems: 'center',
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
            {busy ? 'Working…' : mode === 'request' ? 'Send reset link' : 'Update password'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...input } = props;
  return (
    <View>
      <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: COLORS.ink3, textTransform: 'uppercase' }}>{label}</Text>
      <TextInput
        {...input}
        placeholderTextColor={COLORS.ink4}
        style={{ marginTop: 6, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.ink6, fontSize: 16, color: COLORS.ink1 }}
      />
    </View>
  );
}
