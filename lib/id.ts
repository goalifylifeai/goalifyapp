import * as Crypto from 'expo-crypto';

// Hermes has no built-in `crypto` global (unlike browsers/Node), so the bare
// `crypto.randomUUID()` call throws "Property 'crypto' doesn't exist" on
// device. expo-crypto provides a synchronous polyfill that works everywhere
// Expo runs (iOS, Android, web).
export function newId(): string {
  return Crypto.randomUUID();
}
