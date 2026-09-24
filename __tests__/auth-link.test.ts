import { parseAuthLink } from '../lib/auth-link';

describe('parseAuthLink', () => {
  it('ignores URLs that are not auth-email landings', () => {
    expect(parseAuthLink(null)).toBeNull();
    expect(parseAuthLink('goalify://habits')).toBeNull();
    expect(parseAuthLink('https://www.goalify.life/confirm')).toBeNull();
    // Google's OAuth popup returns to the app with its own tokens.
    expect(parseAuthLink('http://localhost:8081/#access_token=g&refresh_token=x')).toBeNull();
    expect(parseAuthLink('http://localhost:8081/?code=abc')).toBeNull();
  });

  it('reads a signup confirmation session from the fragment', () => {
    expect(parseAuthLink('goalify://confirm#access_token=a&refresh_token=r&type=signup')).toEqual({
      kind: 'tokens', accessToken: 'a', refreshToken: 'r', recovery: false,
    });
  });

  it('marks a reset-password link as recovery', () => {
    expect(parseAuthLink('https://www.goalify.life/reset-password#access_token=a&refresh_token=r&type=recovery'))
      .toMatchObject({ kind: 'tokens', recovery: true });
    // Supabase can fall back to the site URL (/confirm) while still saying recovery.
    expect(parseAuthLink('https://www.goalify.life/confirm#access_token=a&refresh_token=r&type=recovery'))
      .toMatchObject({ kind: 'tokens', recovery: true });
  });

  it('reads PKCE codes and token hashes', () => {
    expect(parseAuthLink('goalify://reset-password?code=c1')).toEqual({ kind: 'code', code: 'c1', recovery: true });
    expect(parseAuthLink('https://www.goalify.life/confirm/?token_hash=h&type=email')).toEqual({
      kind: 'otp', tokenHash: 'h', type: 'email', recovery: false,
    });
  });

  it('turns an expired link into a readable error', () => {
    expect(parseAuthLink(
      'goalify://confirm#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    )).toEqual({ kind: 'error', message: 'That link has expired or was already used.' });
  });
});
