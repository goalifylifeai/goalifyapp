// Regression guard for two id-generation bugs found in this codebase:
//
// 1. Non-UUID ids (e.g. `h-${Date.now()}`) are silently rejected by Postgres
//    on upsert, since goals/habits/subtasks/journal entries sync to Supabase
//    tables whose `id` column is `uuid PRIMARY KEY` (see
//    supabase/migrations/0006-0010). The write gets stuck retrying in the
//    offline queue and is eventually dropped — the item never actually
//    persists even though it appears saved locally.
//
// 2. Bare `crypto.randomUUID()` throws "Property 'crypto' doesn't exist" on
//    device — Hermes has no built-in `crypto` global (unlike browsers/Node).
//    Use `newId()` from `lib/id.ts`, which wraps `expo-crypto`'s
//    `randomUUID()`, instead.

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['app', 'lib', 'store'].map(d => path.join(ROOT, d));

// lib/id.ts is the one legitimate place that wraps the native crypto module.
const ALLOWED_BARE_CRYPTO_FILE = path.join(ROOT, 'lib', 'id.ts');

const NON_UUID_ID_PATTERN = /\bid:\s*`[^`]*\$\{(Date\.now\(\)|Math\.random\(\))[^`]*`/g;
const BARE_CRYPTO_RANDOM_UUID_PATTERN = /\bcrypto\.randomUUID\(\)/g;

function listSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    if (/\.tsx?$/.test(entry.name)) return [full];
    return [];
  });
}

function scan(pattern: RegExp, skip: (file: string) => boolean): string[] {
  const offenders: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of listSourceFiles(dir)) {
      if (skip(file)) continue;
      const contents = fs.readFileSync(file, 'utf8');
      const matches = contents.match(pattern);
      if (matches) {
        offenders.push(`${path.relative(ROOT, file)}: ${matches.join(', ')}`);
      }
    }
  }
  return offenders;
}

describe('id generation for Supabase-synced entities', () => {
  it('never builds an id from Date.now()/Math.random() (Postgres uuid columns reject it)', () => {
    expect(scan(NON_UUID_ID_PATTERN, () => false)).toEqual([]);
  });

  it('never calls bare crypto.randomUUID() (Hermes has no crypto global — use lib/id.ts newId())', () => {
    expect(scan(BARE_CRYPTO_RANDOM_UUID_PATTERN, file => file === ALLOWED_BARE_CRYPTO_FILE)).toEqual([]);
  });
});
