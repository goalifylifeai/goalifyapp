import * as Crypto from 'expo-crypto';

// Uppercase alphanumeric, excluding visually ambiguous characters
// (0/O, 1/I/L) so a code is easy to read aloud or copy correctly.
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;

/** A short random invite code for a new circle (e.g. "K3XQPT"). */
export function generateInviteCode(): string {
  const bytes = Crypto.getRandomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}
