import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { useAuth } from '../../store/auth';

// Landing screen for the signup-confirmation link (goalify://confirm and
// https://www.goalify.life/confirm). Supabase verifies the token and
// redirects here with the session in the URL; the auth store turns that into
// a session (lib/auth-link). AuthGate (app/_layout.tsx) takes over navigation
// once `status` flips to signed-in, same as for every other signed-in route.
const CONFIRM_TIMEOUT_MS = 6000;

export default function Confirm() {
  const insets = useSafeAreaInsets();
  const { status, linkError } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // No session yet: give the link a moment to land before calling it broken.
  useEffect(() => {
    if (status === 'signed-in') return;
    const timer = setTimeout(() => setTimedOut(true), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const failed = status !== 'signed-in' && (!!linkError || timedOut);

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 28, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center' }}>
      {failed ? (
        <>
          <Text style={{ fontFamily: F.display, fontSize: 30, color: COLORS.ink1, textAlign: 'center' }}>
            That link didn&apos;t work.
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, marginTop: 12, textAlign: 'center', lineHeight: 18 }}>
            It may have expired. Try signing in — we&apos;ll send a fresh one if needed.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/sign-in')}
            style={{ marginTop: 24, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, backgroundColor: COLORS.ink1 }}
          >
            <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>Back to sign in</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator color={COLORS.ink1} />
          <Text style={{ fontFamily: F.display, fontSize: 30, color: COLORS.ink1, marginTop: 20, textAlign: 'center' }}>
            Email confirmed.
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, marginTop: 8, textAlign: 'center' }}>
            Taking you in…
          </Text>
        </>
      )}
    </View>
  );
}
