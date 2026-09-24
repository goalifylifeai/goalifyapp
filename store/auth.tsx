import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { parseAuthLink, authRedirectUrl, type AuthLink } from '../lib/auth-link';

WebBrowser.maybeCompleteAuthSession();

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Signed in from a password-reset link; the user must set a new password. */
  recovering: boolean;
  /** Why the last auth-email link couldn't sign the user in, if it failed. */
  linkError: string | null;
  finishRecovery: () => void;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

  const [, , googlePromptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: extra.googleOAuthIosClientId,
    androidClientId: extra.googleOAuthAndroidClientId,
    clientId: extra.googleOAuthWebClientId,
  });

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      setSession(nextSession);
      setStatus(nextSession ? 'signed-in' : 'signed-out');
    });
    subRef.current = sub.subscription;

    // Links from auth emails: the one that launched the app, and any opened
    // while it runs.
    const onUrl = (url: string | null) => {
      const link = parseAuthLink(url);
      if (!link || cancelled) return;
      clearAuthParamsFromWebUrl();
      // Set before the session lands, or AuthGate routes the freshly
      // signed-in user into the app before they've set a new password.
      if (link.kind !== 'error' && link.recovery) setRecovering(true);
      applyAuthLink(link).then(({ error }) => {
        if (cancelled) return;
        setLinkError(error);
        if (error) setRecovering(false);
      });
    };
    Linking.getInitialURL().then(onUrl).catch(() => {});
    const urlSub = Linking.addEventListener('url', ({ url }) => onUrl(url));

    return () => {
      cancelled = true;
      subRef.current?.unsubscribe();
      urlSub.remove();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authRedirectUrl('confirm') },
    });
    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await googlePromptAsync();
      if (result?.type !== 'success' || !result.params?.id_token) {
        return { error: new Error('Google sign-in cancelled') };
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: result.params.id_token,
      });
      return { error };
    } catch (e) {
      return { error: e as Error };
    }
  }, [googlePromptAsync]);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      return { error: new Error('Apple sign-in is iOS-only') };
    }
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        return { error: new Error('No identity token returned from Apple') };
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      return { error };
    } catch (e) {
      return { error: e as Error };
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl('reset-password'),
    });
    return { error };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  }, []);

  const finishRecovery = useCallback(() => setRecovering(false), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      recovering,
      linkError,
      finishRecovery,
      signUp,
      signIn,
      signInWithGoogle,
      signInWithApple,
      requestPasswordReset,
      updatePassword,
      signOut,
    }),
    [status, session, recovering, linkError, finishRecovery, signUp, signIn, signInWithGoogle, signInWithApple, requestPasswordReset, updatePassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function applyAuthLink(link: AuthLink): Promise<{ error: string | null }> {
  if (link.kind === 'error') return { error: link.message };
  const { error } =
    link.kind === 'tokens'
      ? await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
      : link.kind === 'code'
        ? await supabase.auth.exchangeCodeForSession(link.code)
        : await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
  return { error: error ? 'That link has expired or was already used.' : null };
}

// Tokens in the address bar would be reused on refresh and leak into history.
function clearAuthParamsFromWebUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be called inside <AuthProvider>');
  return ctx;
}
