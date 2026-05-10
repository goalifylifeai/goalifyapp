import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { useAuth } from '../../store/auth';
import { mapAuthError } from '../../lib/auth-errors';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setBusy(true); setError(null);
    const { error: err } = await signIn(email.trim(), password);
    if (err) setError(mapAuthError(err.message));
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 28, backgroundColor: COLORS.paper }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, letterSpacing: 1.5 }}>← Back</Text>
        </TouchableOpacity>

        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, marginTop: 28 }}>Welcome back.</Text>

        <View style={{ marginTop: 32, gap: 14 }}>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        </View>

        {error && <Text style={errStyle}>{error}</Text>}

        <TouchableOpacity onPress={onSubmit} disabled={busy || !email || !password} style={[btn, { marginTop: 24, opacity: busy || !email || !password ? 0.5 : 1 }]}>
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

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...input } = props;
  return (
    <View>
      <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: COLORS.ink3, textTransform: 'uppercase' }}>{label}</Text>
      <TextInput
        {...input}
        placeholderTextColor={COLORS.ink4}
        style={{
          marginTop: 6,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.ink6,
          fontSize: 16,
          color: COLORS.ink1,
        }}
      />
    </View>
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
