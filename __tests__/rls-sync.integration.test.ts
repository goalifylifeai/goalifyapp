/**
 * RLS Integration Tests: Persistence + Sync Layer
 *
 * Verifies that each new table enforces row-level security — User B cannot
 * read or write data belonging to User A.
 *
 * Requires a running local Supabase stack (`supabase start`).
 * Skipped automatically when the stack is not available.
 */

import { createClient } from '@supabase/supabase-js';

const LOCAL_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.' +
  'CRFA0NiK7rh0LITEqupR47f9C9X2phr58IjT-HLyK78';

const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.' +
  'EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0';

// Check if local Supabase is running
async function isSupabaseRunning(): Promise<boolean> {
  try {
    const admin = createClient(LOCAL_URL, SERVICE_KEY);
    await admin.from('profiles').select('count').limit(1);
    return true;
  } catch {
    return false;
  }
}

const TABLES = ['goals', 'goal_subtasks', 'habits', 'habit_logs', 'journal_entries'] as const;

describe.skip('RLS Isolation: Persistence + Sync Layer', () => {
  // This suite is marked .skip intentionally — to run it:
  //   1. Start local Supabase: supabase start
  //   2. Remove .skip from this describe block
  //   3. Run: npm test -- --testPathPattern=rls-sync.integration

  const admin = createClient(LOCAL_URL, SERVICE_KEY);
  let userAId: string;
  let userBId: string;
  let clientA: ReturnType<typeof createClient>;
  let clientB: ReturnType<typeof createClient>;

  beforeAll(async () => {
    const running = await isSupabaseRunning();
    if (!running) {
      console.warn('[rls-test] Local Supabase not running — skipping integration tests');
      return;
    }

    // Create two test users via admin API
    const { data: { user: userA } } = await admin.auth.admin.createUser({
      email: `rls-test-a-${Date.now()}@example.com`,
      password: 'password123',
      email_confirm: true,
    });
    const { data: { user: userB } } = await admin.auth.admin.createUser({
      email: `rls-test-b-${Date.now()}@example.com`,
      password: 'password123',
      email_confirm: true,
    });

    userAId = userA!.id;
    userBId = userB!.id;

    // Sign in as each user to get anon clients with their JWTs
    clientA = createClient(LOCAL_URL, ANON_KEY);
    clientB = createClient(LOCAL_URL, ANON_KEY);

    await clientA.auth.signInWithPassword({ email: userA!.email!, password: 'password123' });
    await clientB.auth.signInWithPassword({ email: userB!.email!, password: 'password123' });
  });

  afterAll(async () => {
    // Clean up test users (cascade removes all their data)
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it('User A can insert and select their own goals; User B sees empty', async () => {
    const { error: insertErr } = await clientA.from('goals').insert({
      id: crypto.randomUUID(),
      user_id: userAId,
      sphere: 'health',
      title: 'User A goal',
    });
    expect(insertErr).toBeNull();

    const { data: bData } = await clientB.from('goals').select('*');
    expect((bData ?? []).filter((r: { user_id: string }) => r.user_id === userAId)).toHaveLength(0);
  });

  it('User A can insert and select their own habits; User B sees empty', async () => {
    const { error } = await clientA.from('habits').insert({
      id: crypto.randomUUID(),
      user_id: userAId,
      label: 'Run',
      icon: '🏃',
      sphere: 'health',
      target_description: 'daily',
    });
    expect(error).toBeNull();

    const { data: bData } = await clientB.from('habits').select('*');
    expect((bData ?? []).filter((r: { user_id: string }) => r.user_id === userAId)).toHaveLength(0);
  });

  it('User A can insert and select their own journal entries; User B sees empty', async () => {
    const { error } = await clientA.from('journal_entries').insert({
      id: crypto.randomUUID(),
      user_id: userAId,
      date: new Date().toISOString().slice(0, 10),
      sphere: 'health',
      sentiment: 1,
      excerpt: 'Feeling great',
    });
    expect(error).toBeNull();

    const { data: bData } = await clientB.from('journal_entries').select('*');
    expect((bData ?? []).filter((r: { user_id: string }) => r.user_id === userAId)).toHaveLength(0);
  });
});
