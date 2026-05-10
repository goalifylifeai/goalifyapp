// Integration test: verifies RLS prevents cross-user reads/writes against a real Supabase project.
// Skipped unless SUPABASE_TEST_URL + SUPABASE_TEST_ANON_KEY are set.
//
// Run locally with:
//   SUPABASE_TEST_URL=https://<ref>.supabase.co \
//   SUPABASE_TEST_ANON_KEY=<anon> \
//   npm test -- rls.integration
//
// NOTE: Creates two test users with random emails. Email confirmation must be disabled
// on the target project for this to work without manual confirmation, OR you must use
// a project where signups bypass confirmation (e.g. local supabase start).

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const ENABLED = !!(URL && ANON);

const d = ENABLED ? describe : describe.skip;

d('RLS: cross-user isolation', () => {
  jest.setTimeout(30_000);

  const stamp = Date.now();
  const userA = { email: `rls-a-${stamp}@example.test`, password: 'test-password-A1!' };
  const userB = { email: `rls-b-${stamp}@example.test`, password: 'test-password-B1!' };

  // We don't generate Supabase types in this project, so use `any` to keep the test focused on RLS behavior.
  let clientA: any;
  let clientB: any;
  let aId: string, bId: string;

  beforeAll(async () => {
    clientA = createClient(URL!, ANON!);
    clientB = createClient(URL!, ANON!);

    const a = await clientA.auth.signUp(userA);
    if (a.error || !a.data.user) throw new Error(`sign up A failed: ${a.error?.message}`);
    aId = a.data.user.id;

    const b = await clientB.auth.signUp(userB);
    if (b.error || !b.data.user) throw new Error(`sign up B failed: ${b.error?.message}`);
    bId = b.data.user.id;

    // If sign-up returns a session, signInWithPassword is a no-op refresh; if it requires
    // confirmation it will fail and the test environment isn't suitable.
    if (!a.data.session) {
      const r = await clientA.auth.signInWithPassword(userA);
      if (r.error) throw new Error(`Email confirmation required on test project: ${r.error.message}`);
    }
    if (!b.data.session) {
      await clientB.auth.signInWithPassword(userB);
    }
  });

  it('A cannot read B profile', async () => {
    const { data, error } = await clientA
      .from('profiles')
      .select('user_id, display_name')
      .eq('user_id', bId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('A cannot update B profile', async () => {
    const { data, error } = await clientA
      .from('profiles')
      .update({ display_name: 'hijacked' })
      .eq('user_id', bId)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]); // RLS silently filters; no rows touched.

    // Confirm B's profile is untouched (read as B).
    const own = await clientB.from('profiles').select('display_name').eq('user_id', bId).single();
    expect(own.data?.display_name).not.toBe('hijacked');
  });

  it('A can read own profile (sanity)', async () => {
    const { data, error } = await clientA
      .from('profiles')
      .select('user_id')
      .eq('user_id', aId)
      .single();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(aId);
  });

  it('A cannot read B onboarding_state', async () => {
    const { data, error } = await clientA
      .from('onboarding_state')
      .select('user_id, current_step')
      .eq('user_id', bId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('handle_new_user trigger created rows for both users', async () => {
    const a = await clientA.from('onboarding_state').select('current_step').eq('user_id', aId).single();
    expect(a.data?.current_step).toBe('name');
    const b = await clientB.from('onboarding_state').select('current_step').eq('user_id', bId).single();
    expect(b.data?.current_step).toBe('name');
  });
});
