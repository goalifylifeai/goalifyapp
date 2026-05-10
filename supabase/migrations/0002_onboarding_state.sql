-- onboarding_state table: per-user step machine, created by trigger.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'onboarding_step') then
    create type public.onboarding_step as enum ('name', 'spheres', 'tone', 'pronouns', 'complete');
  end if;
end $$;

create table if not exists public.onboarding_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_step public.onboarding_step not null default 'name',
  selections jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_state enable row level security;

create policy "onboarding_select_own"
  on public.onboarding_state for select
  using (auth.uid() = user_id);

create policy "onboarding_update_own"
  on public.onboarding_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger onboarding_touch
  before update on public.onboarding_state
  for each row execute function public.set_updated_at();

-- Auto-create profile + onboarding rows when an auth user is inserted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));

  insert into public.onboarding_state (user_id)
  values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
