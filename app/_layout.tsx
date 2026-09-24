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
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Analytics } from '@vercel/analytics/react';
import * as Notifications from 'expo-notifications';
import { COLORS } from '../constants/theme';
import { F } from '../components/ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../store';
import { AuthProvider, useAuth } from '../store/auth';
import { ProfileProvider } from '../store/profile';
import { PlanProvider } from '../store/plan';
import { OnboardingProvider, useOnboarding } from '../store/onboarding';
import { FutureSelfProvider } from '../store/future-self';
import { DailyRitualProvider, useDailyRitual } from '../store/daily-ritual';
import { VisionAssetsProvider } from '../store/vision';
import { CoachAiProvider } from '../store/coach-ai';
import { CirclesProvider } from '../store/circles';
import { TrialWatcher } from '../components/TrialWatcher';
import { AnalyticsBridge } from '../components/analytics/AnalyticsBridge';
import { track, useAnalyticsConsent } from '../lib/analytics';
import { notificationKind } from '../lib/analytics-screen';
import { decideRoute } from '../lib/auth-route';
import { ensureNotificationsScheduled, ensureHabitRemindersScheduled } from '../lib/notifications';
import { useStore } from '../store';

SplashScreen.preventAutoHideAsync();

const CONSENT_PROMPT_GROUPS = ['(onboarding)', '(welcome)', '(tabs)'];

function NotificationListener() {
  const router = useRouter();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      track('notification_opened', { kind: notificationKind(response.notification.request.identifier) });
      const screen = response.notification.request.content.data?.screen as string | undefined;
      if (screen === 'morning') router.push('/ritual/morning' as any);
      else if (screen === 'evening') router.push('/ritual/evening' as any);
      else if (screen === 'habits') router.push('/(tabs)/habits' as any);
      else if (screen === 'profile') router.push('/profile' as any);
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

function HabitReminderScheduler() {
  const { state } = useStore();
  const habits = state.habits;
  useEffect(() => {
    ensureHabitRemindersScheduled(habits).catch(() => {});
  }, [habits]);
  return null;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { status, recovering, signOut } = useAuth();
  const {
    state: onboarding, loading: onboardingLoading, error: onboardingError, refresh: refreshOnboarding,
  } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();
  const consent = useAnalyticsConsent();
  const consentAsked = useRef(false);

  useEffect(() => {
    const target = decideRoute({
      status,
      currentGroup: segments[0],
      onboardingLoaded: !!onboarding || !onboardingLoading,
      onboardingCompleted: !!onboarding?.completed_at,
      currentStep: onboarding?.current_step ?? null,
      recovering,
      currentScreen: (segments as string[])[1],
    });
    if (target) {
      router.replace(target as any);
      return;
    }
    // Ask for analytics consent once the user is settled in the app (never over
    // a redirect that is about to happen, the paywall or another modal).
    if (
      consent === 'unset' && !consentAsked.current && status === 'signed-in' && !!onboarding
      && CONSENT_PROMPT_GROUPS.includes(segments[0] as string)
    ) {
      consentAsked.current = true;
      router.push('/analytics-consent' as any);
    }
  }, [status, recovering, onboarding, onboardingLoading, segments, router, consent]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paper }}>
        <ActivityIndicator color={COLORS.ink1} />
      </View>
    );
  }
  // Signed in but we couldn't load where they are in onboarding: without
  // this, no route is decided and the user sits on the sign-in screen.
  if (status === 'signed-in' && !recovering && !onboarding && onboardingError && !onboardingLoading) {
    return <OnboardingLoadError onRetry={refreshOnboarding} onSignOut={signOut} />;
  }
  return <>{children}</>;
}

function OnboardingLoadError({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: COLORS.paper }}>
      <Text style={{ fontFamily: F.display, fontSize: 30, color: COLORS.ink1, textAlign: 'center' }}>
        Couldn&apos;t load your account.
      </Text>
      <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, marginTop: 12, textAlign: 'center', lineHeight: 18 }}>
        Check your connection and try again.
      </Text>
      <TouchableOpacity
        testID="onboarding-retry"
        onPress={onRetry}
        style={{ marginTop: 24, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, backgroundColor: COLORS.ink1 }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>Try again</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSignOut} style={{ marginTop: 16 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3 }}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
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
            <PlanProvider>
            <OnboardingProvider>
              <FutureSelfProvider>
              <StoreProvider>
              <DailyRitualProvider>
              <VisionAssetsProvider>
              <CoachAiProvider>
              <CirclesProvider>
                <AuthGate>
                  {Platform.OS === 'web' && <Analytics />}
                  <AnalyticsBridge />
                  <NotificationListener />
                  <RitualScheduler />
                  <HabitReminderScheduler />
                  <TrialWatcher />
                  <Stack
                    screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.paper } }}
                  >
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(onboarding)" />
                    <Stack.Screen name="(welcome)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="tour" options={{ presentation: 'modal', gestureEnabled: true }} />
                    <Stack.Screen name="score-info" options={{ presentation: 'modal', gestureEnabled: true }} />
                    <Stack.Screen name="level-info" options={{ presentation: 'modal', gestureEnabled: true }} />
                    <Stack.Screen name="streak-info" options={{ presentation: 'modal', gestureEnabled: true }} />
                    <Stack.Screen name="paywall" options={{ presentation: 'modal', gestureEnabled: true }} />
                    <Stack.Screen name="trial-ended" options={{ presentation: 'modal', gestureEnabled: true }} />
                    <Stack.Screen name="analytics-consent" options={{ presentation: 'modal', gestureEnabled: false }} />
                    <Stack.Screen name="ritual" />
                    <Stack.Screen name="vision" />
                    <Stack.Screen name="circles" />
                  </Stack>
                </AuthGate>
              </CirclesProvider>
              </CoachAiProvider>
              </VisionAssetsProvider>
              </DailyRitualProvider>
              </StoreProvider>
              </FutureSelfProvider>
            </OnboardingProvider>
            </PlanProvider>
          </ProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
