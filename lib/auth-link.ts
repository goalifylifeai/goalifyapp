// Turns the links in Supabase auth emails (signup confirmation, password
// recovery) into a session. Supabase verifies the email token itself and
// redirects back with the session in the URL — either as a #fragment
// (implicit flow), a ?code (PKCE), or a token_hash to verify — or with
// #error=… when the link is expired or already used. The client runs with
// detectSessionInUrl off (it can't read deep links on native), so nothing
// picks those up unless we do.

import { Platform } from 'react-native';
import type { EmailOtpType } from '@supabase/supabase-js';

export type AuthLink =
  | { kind: 'tokens'; accessToken: string; refreshToken: string; recovery: boolean }
  | { kind: 'code'; code: string; recovery: boolean }
  | { kind: 'otp'; tokenHash: string; type: EmailOtpType; recovery: boolean }
  | { kind: 'error'; message: string };

function params(url: string): URLSearchParams {
  const out = new URLSearchParams();
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  if (queryAt !== -1) {
    const end = hashAt > queryAt ? hashAt : url.length;
    new URLSearchParams(url.slice(queryAt + 1, end)).forEach((v, k) => out.set(k, v));
  }
  if (hashAt !== -1) {
    new URLSearchParams(url.slice(hashAt + 1)).forEach((v, k) => out.set(k, v));
  }
  return out;
}

// Returns null for any URL that isn't an auth-email redirect. Only the two
// landing paths count, so OAuth redirects (Google's #access_token, ?code,
// #error) are left to the OAuth flow that owns them.
export function parseAuthLink(url: string | null | undefined): AuthLink | null {
  if (!url) return null;
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
  const landing = path.match(/\/(confirm|reset-password)$/)?.[1];
  if (!landing) return null;
  const p = params(url);
  const recovery = p.get('type') === 'recovery' || landing === 'reset-password';

  const error = p.get('error_description') ?? p.get('error');
  if (error) {
    const expired = p.get('error_code') === 'otp_expired' || /expired|invalid/i.test(error);
    return { kind: 'error', message: expired ? 'That link has expired or was already used.' : error };
  }

  const accessToken = p.get('access_token');
  const refreshToken = p.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken, recovery };

  const code = p.get('code');
  if (code) return { kind: 'code', code, recovery };

  const tokenHash = p.get('token_hash');
  const type = p.get('type') as EmailOtpType | null;
  if (tokenHash && type) return { kind: 'otp', tokenHash, type, recovery };

  return null;
}

// Where auth emails send the user back to. Native apps get the app scheme;
// web gets its own origin so the link opens where the request came from.
// Both must be in Supabase's redirect allow-list, or it falls back to the
// site URL.
export function authRedirectUrl(path: 'confirm' | 'reset-password'): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/${path}`;
  }
  return `goalify://${path}`;
}
