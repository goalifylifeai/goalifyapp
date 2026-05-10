# Contract: Profile (PostgREST + Edge Function)

Backed by `public.profiles` with RLS. All requests carry the user's JWT in the `Authorization` header (handled by the supabase-js client).

## Read profile

```ts
const { data, error } = await supabase
  .from('profiles')
  .select('user_id, display_name, pronouns, gender_aware_coaching, avatar_url, updated_at')
  .eq('user_id', session.user.id)
  .single();
```

- Expected: exactly one row (created by trigger on sign-up).
- 0 rows ⇒ trigger didn't fire or row was deleted out-of-band → treat as fatal, force sign-out + bug report.
- RLS guarantees the `eq(user_id, …)` filter is also a security boundary; a second user's id would return 0 rows.

## Update profile

```ts
const { data, error } = await supabase
  .from('profiles')
  .update({
    display_name,            // 1..50 chars, validated client-side
    pronouns,                // optional, ≤30
    gender_aware_coaching,   // boolean
  })
  .eq('user_id', session.user.id)
  .select()
  .single();
```

- Validation errors (CHECK constraints) surface as PostgREST 400 with code `23514`.
- RLS UPDATE policy denies any other user_id (returns 0 rows + no error → treat as success but no-op; client should always pass own id).

## Delete account (Edge Function)

```ts
const { data, error } = await supabase.functions.invoke('delete-account', {
  // No body — function reads JWT from Authorization header.
});
```

Function (`supabase/functions/delete-account/index.ts`):

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth) return new Response('Unauthorized', { status: 401 });

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user }, error: getUserErr } = await userClient.auth.getUser();
  if (getUserErr || !user) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return new Response(error.message, { status: 500 });
  return new Response(null, { status: 204 });
});
```

Cascade removes the corresponding `profiles` and `onboarding_state` rows.

## Caching strategy

- `useProfile()` keeps an in-memory cache; refresh on `SIGNED_IN`, `USER_UPDATED`, and explicit pull-to-refresh on the profile screen.
- No long-lived disk cache (single row, fast to refetch). Avoids stale display name across devices.
