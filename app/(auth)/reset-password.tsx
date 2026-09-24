import { useState } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { AuthField, EMAIL_INPUT } from '../../components/AuthField';
import { mapAuthError } from '../../lib/auth-errors';
import { useAuth } from '../../store/auth';

// Two modes: request (default) and apply. The auth store signs the user in
// from the emailed reset link and flags `recovering`; AuthGate keeps them on
// this screen until they've set a new password.
export default function ResetPassword() {
  const insets = useSafeAreaInsets();
  const { requestPasswordReset, updatePassword, recovering, finishRecovery, linkError, signOut } = useAuth();
  const mode: 'request' | 'apply' = recovering ? 'apply' : 'request';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canSubmit = !busy && (mode === 'request' ? !!email.trim() : password.length >= 8);

  const onRequest = async () => {
    if (!canSubmit) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      const { error: err } = await requestPasswordReset(email.trim());
      if (err) setError(mapAuthError(err.message));
      else setInfo('If that email exists, a reset link is on its way.');
    } catch (e) {
      setError(mapAuthError((e as Error)?.message));
    } finally {
      setBusy(false);
    }
  };

  const onApply = async () => {
    if (!canSubmit) return;
    setBusy(true); setError(null);
    try {
      const { error: err } = await updatePassword(password);
      if (err) {
        setError(err.message);
        setBusy(false);
        return;
      }
      setInfo('Password updated.');
      // Still busy: AuthGate takes the now signed-in user into the app.
      setTimeout(finishRecovery, 800);
    } catch (e) {
      setError(mapAuthError((e as Error)?.message));
      setBusy(false);
    }
  };

  // Leaving a half-done reset signs out, so the reset link's session can't
  // be used to walk into the app without a new password.
  const onBack = () => (recovering ? signOut() : router.back());

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 28, backgroundColor: COLORS.paper }}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, letterSpacing: 1.5 }}>← Back</Text>
        </TouchableOpacity>

        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, marginTop: 28 }}>
          {mode === 'request' ? 'Reset password.' : 'New password.'}
        </Text>

        <View style={{ marginTop: 32 }}>
          {mode === 'request' ? (
            <AuthField
              label="Email" editable={!busy} value={email} onChangeText={setEmail}
              {...EMAIL_INPUT} returnKeyType="send" onSubmitEditing={onRequest}
            />
          ) : (
            <AuthField
              label="New password" editable={!busy} value={password} onChangeText={setPassword}
              secureTextEntry autoComplete="new-password" textContentType="newPassword"
              returnKeyType="done" onSubmitEditing={onApply}
            />
          )}
        </View>

        {mode === 'request' && linkError && (
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#A33', marginTop: 16 }}>
            {linkError} Request a new one below.
          </Text>
        )}

        {error && <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#A33', marginTop: 16 }}>{error}</Text>}
        {info && <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink2, marginTop: 16 }}>{info}</Text>}

        <TouchableOpacity
          onPress={mode === 'request' ? onRequest : onApply}
          disabled={!canSubmit}
          style={{
            marginTop: 24, paddingVertical: 16, borderRadius: 14, backgroundColor: COLORS.ink1, alignItems: 'center',
            opacity: canSubmit ? 1 : 0.5,
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
