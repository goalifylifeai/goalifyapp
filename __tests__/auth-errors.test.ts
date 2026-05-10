import { mapAuthError } from '../lib/auth-errors';

describe('mapAuthError', () => {
  it('maps invalid_credentials', () => {
    expect(mapAuthError('Invalid login credentials')).toBe('Wrong email or password.');
  });

  it('maps email_not_confirmed', () => {
    expect(mapAuthError('Email not confirmed')).toMatch(/confirm your email/i);
  });

  it('maps rate limit', () => {
    expect(mapAuthError('over_email_send_rate_limit: too many requests')).toMatch(/try again/i);
  });

  it('maps already exists', () => {
    expect(mapAuthError('User already registered')).toMatch(/already exists/i);
  });

  it('maps network errors', () => {
    expect(mapAuthError('Network request failed')).toMatch(/network/i);
  });

  it('falls back to generic copy for unknown messages', () => {
    expect(mapAuthError('something weird happened')).toBe('Something went wrong. Try again.');
  });

  it('handles empty / null input', () => {
    expect(mapAuthError(null)).toBe('Something went wrong. Try again.');
    expect(mapAuthError('')).toBe('Something went wrong. Try again.');
  });
});
