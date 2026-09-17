// jest-expo's auto-generated native module mock stubs randomUUID() to return
// undefined (see node_modules/expo-crypto/mocks/ExpoCrypto.ts), which breaks
// any test relying on ids being present/unique. Use Node's real crypto so
// tests see realistic UUIDs, matching on-device behavior.
const nodeCrypto = require('crypto');

module.exports = {
  randomUUID: () => nodeCrypto.randomUUID(),
  digestStringAsync: async (_algorithm, str) => str,
  getRandomBytes: byteCount => nodeCrypto.randomBytes(byteCount),
  getRandomBytesAsync: async byteCount => nodeCrypto.randomBytes(byteCount),
};
