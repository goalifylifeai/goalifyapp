-- Why do goals disappear? One row per deleted goal: when, who asked, and
-- whether an account deletion cascaded it. Request logs only last about a
-- day, so this is the durable record.
--
-- Readable only with the service role (dashboard / SQL editor); the app
-- never reads it.

create table public.goal_deletions (
  id              bigint generated always as identity primary key,
  goal_id         uuid not null,
  -- No FK: rows must outlive the account they describe.
  user_id         uuid not null,
  -- Null when the account itself was deleted, so the erasure still holds.
  title           text,
  sphere          text,
  goal_created_at timestamptz,
  deleted_at      timestamptz not null default now(),
  -- account_deleted: cascade from auth.users; user: the goal's owner asked;
  -- other: anyone else (service role, SQL editor, another user).
  cause           text not null check (cause in ('account_deleted', 'user', 'other')),
  actor           text,   -- JWT sub of the request, if any
  db_role         text,   -- JWT role (authenticated, service_role) or session user
  user_agent      text    -- from PostgREST request headers
);

create index goal_deletions_user_id_deleted_at_idx
  on public.goal_deletions (user_id, deleted_at desc);

alter table public.goal_deletions enable row level security;
revoke all on public.goal_deletions from anon, authenticated;

create function public.log_goal_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims       jsonb;
  headers      jsonb;
  account_gone boolean;
begin
  claims  := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  -- During an auth.users cascade the parent row is already gone.
  account_gone := not exists (select 1 from auth.users where id = old.user_id);

  insert into public.goal_deletions
    (goal_id, user_id, title, sphere, goal_created_at, cause, actor, db_role, user_agent)
  values (
    old.id,
    old.user_id,
    case when account_gone then null else old.title end,
    old.sphere,
    old.created_at,
    case
      when account_gone then 'account_deleted'
      when claims->>'sub' = old.user_id::text then 'user'
      else 'other'
    end,
    claims->>'sub',
    coalesce(claims->>'role', session_user::text),
    left(headers->>'user-agent', 300)
  );
  return old;
exception when others then
  -- Logging must never block the delete itself.
  return old;
end;
$$;

-- Trigger-only function (see 0018): not callable via /rest/v1/rpc.
revoke execute on function public.log_goal_deletion() from public, anon, authenticated;

create trigger goals_log_deletion
  after delete on public.goals
  for each row execute function public.log_goal_deletion();
