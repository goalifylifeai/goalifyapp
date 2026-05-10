# Contract: Auth client surface

The app uses `@supabase/supabase-js` directly. This document fixes the exact methods, inputs, expected outputs, and error mapping.

## Client construction

```ts
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SecureStoreAdapter = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

## Methods used

| Operation | Call | Notes |
|-----------|------|-------|
| Sign up (email) | `supabase.auth.signUp({ email, password, options: { emailRedirectTo: 'goalify://confirm' } })` | Returns user with `email_confirmed_at: null` until link clicked |
| Sign in (email) | `supabase.auth.signInWithPassword({ email, password })` | Errors: `invalid_credentials`, `email_not_confirmed` (only for sensitive paths) |
| Sign in (Google) | `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })` | `idToken` from `expo-auth-session/providers/google` |
| Sign in (Apple) | `supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken, nonce })` | iOS only; `expo-apple-authentication` returns identityToken + nonce |
| Sign out | `supabase.auth.signOut()` | Clears session in SecureStore |
| Reset request | `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'goalify://reset-password' })` | Always returns success (do not leak account existence) |
| Apply reset | `supabase.auth.updateUser({ password })` | After deep-link sets the recovery session |
| Get session | `supabase.auth.getSession()` | Used at app boot |
| Subscribe | `supabase.auth.onAuthStateChange((event, session) => ...)` | `AuthProvider` subscribes here |
| Delete account | `supabase.functions.invoke('delete-account')` | Edge function, see contracts/profile-api.md |

## Auth events handled

| Event | Action |
|-------|--------|
| `INITIAL_SESSION` | Set session in `AuthProvider`; route based on profile/onboarding |
| `SIGNED_IN` | Same as INITIAL_SESSION; if new user → land on onboarding |
| `TOKEN_REFRESHED` | Update in-memory session; no UI change |
| `SIGNED_OUT` | Clear all caches; route to `(auth)` |
| `PASSWORD_RECOVERY` | Route to `(auth)/reset-password` to capture new password |
| `USER_UPDATED` | Refresh local user copy |

## Error mapping (display strings)

| Supabase code / message               | User-facing message |
|---------------------------------------|---------------------|
| `invalid_credentials`                 | "Wrong email or password." |
| `email_not_confirmed` (sensitive op)  | "Please confirm your email first. Check your inbox." |
| `over_email_send_rate_limit`          | "Too many attempts — try again in a minute." |
| `user_already_exists` (signup)        | "An account with this email already exists. Sign in instead." (still returns success-shaped to client; surfaced only on explicit conflict) |
| network / fetch failure               | "No connection. Check your network and try again." |
| anything else                         | "Something went wrong. Try again." (log error to console; surface tracking ID once Sentry is added) |

## Session lifecycle on device

1. App launches → `_layout.tsx` mounts `<AuthProvider>`.
2. `AuthProvider` calls `getSession()` synchronously from SecureStore-backed cache.
3. While loading: render splash (don't redirect yet).
4. On result: subscribe to `onAuthStateChange`, then route via `<AuthGate>`.
5. Background: `autoRefreshToken: true` rotates access tokens silently. Failures emit `SIGNED_OUT`.
