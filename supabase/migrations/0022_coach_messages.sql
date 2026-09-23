-- Coach chat history, so conversations survive app restarts and new devices.
-- Rows are written only by the ai-coach edge function (service role) after a
-- real exchange; users can read their own history. Deleted with the account.
--
-- Numbered 0022 because the billing branch owns 0021 (subscriptions). If 0021
-- reaches production after this one, apply it with `supabase db push --include-all`.

create table if not exists public.coach_messages (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        text        not null check (role in ('user', 'coach')),
  text        text        not null check (length(text) between 1 and 4000),
  created_at  timestamptz not null default now()
);

create index if not exists coach_messages_user_created_idx
  on public.coach_messages (user_id, created_at desc);

alter table public.coach_messages enable row level security;

create policy "coach_messages_select_own"
  on public.coach_messages for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No insert/update/delete policies: only the ai-coach function writes.
