// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deletePerson } from '../_shared/analytics.ts';
import { CORS_HEADERS, json, preflight } from '../_shared/http.ts';

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceKey);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);
  await deletePerson(Deno.env, user.id);

  return new Response(null, { status: 204, headers: CORS_HEADERS });
});
