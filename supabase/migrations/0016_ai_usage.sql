-- Per-user daily AI usage counters, used by the ai-coach and generate-vision
-- edge functions to cap paid LLM / image-generation calls. Days are UTC.
--
-- Only the service role touches this table: RLS is on with no policies, and
-- consume_ai_quota is executable by service_role alone, so a client can
-- neither read nor reset its own counters.

create table if not exists public.ai_usage (
  user_id  uuid    not null references auth.users(id) on delete cascade,
  day      date    not null default current_date,
  kind     text    not null,
  count    integer not null default 0,
  primary key (user_id, day, kind)
);

alter table public.ai_usage enable row level security;

-- Atomically takes one unit of today's quota for (user, kind).
-- Returns true if the call is allowed, false if the limit is already reached.
create or replace function public.consume_ai_quota(p_user_id uuid, p_kind text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_count integer;
begin
  insert into public.ai_usage (user_id, day, kind, count)
  values (p_user_id, current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update
    set count = public.ai_usage.count + 1
    where public.ai_usage.count < p_limit
  returning count into new_count;

  return new_count is not null;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer) to service_role;
