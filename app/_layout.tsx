import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Analytics } from '@vercel/analytics/react';
import * as Notifications from 'expo-notifications';
import { COLORS } from '../constants/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../store';
import { AuthProvider, useAuth } from '../store/auth';
import { ProfileProvider } from '../store/profile';
import { OnboardingProvider, useOnboarding } from '../store/onboarding';
import { FutureSelfProvider } from '../store/future-self';
import { DailyRitualProvider, useDailyRitual } from '../store/daily-ritual';
import { VisionAssetsProvider } from '../store/vision';
import { decideRoute } from '../lib/auth-route';
import { ensureNotificationsScheduled } from '../lib/notifications';

SplashScreen.preventAutoHideAsync();

function NotificationListener() {
  const router = useRouter();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen as string | undefined;
      if (screen === 'morning') router.push('/ritual/morning' as any);
      else if (screen === 'evening') router.push('/ritual/evening' as any);
    });
    return () => sub.remove();
  }, [router]);
  return null;
}

function RitualScheduler() {
  const { intention } = useDailyRitual();
  useEffect(() => {
    ensureNotificationsScheduled(intention).catch(() => {});
  }, [intention]);
  return null;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { state: onboarding, loading: onboardingLoading } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const target = decideRoute({
      status,
      currentGroup: segments[0],
      onboardingLoaded: !!onboarding || !onboardingLoading,
      onboardingCompleted: !!onboarding?.completed_at,
      currentStep: onboarding?.current_step ?? null,
    });
    if (target) router.replace(target as any);
  }, [status, onboarding, onboardingLoading, segments, router]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paper }}>
        <ActivityIndicator color={COLORS.ink1} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ProfileProvider>
            <OnboardingProvider>
              <FutureSelfProvider>
              <StoreProvider>
              <DailyRitualProvider>
              <VisionAssetsProvider>
                <AuthGate>
                  {Platform.OS === 'web' && <Analytics />}
                  <NotificationListener />
                  <RitualScheduler />
                  <Stack
                    screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.paper } }}
                  >
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(onboarding)" />
                    <Stack.Screen name="(welcome)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="tour" options={{ presentation: 'modal', gestureEnabled: true }} />
                    <Stack.Screen name="ritual" />
                    <Stack.Screen name="vision" />
                  </Stack>
                </AuthGate>
              </VisionAssetsProvider>
              </DailyRitualProvider>
              </StoreProvider>
              </FutureSelfProvider>
            </OnboardingProvider>
          </ProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
