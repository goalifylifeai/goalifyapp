// Maps raw Supabase auth error messages to user-facing copy.
// Kept separate from screens so it's testable without RN.

export function mapAuthError(msg: string | undefined | null): string {
  if (!msg) return 'Something went wrong. Try again.';
  if (/invalid.*credentials/i.test(msg)) return 'Wrong email or password.';
  if (/email.*not.*confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox.';
  if (/rate.*limit/i.test(msg)) return 'Too many attempts — try again in a minute.';
  if (/already.*registered|user.*already.*exists/i.test(msg)) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (/network|fetch/i.test(msg)) return 'No connection. Check your network and try again.';
  return 'Something went wrong. Try again.';
}
