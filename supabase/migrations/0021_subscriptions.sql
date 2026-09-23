-- Goalify Beyond subscription state, one row per user, written only by the
-- revenuecat-webhook and sync-subscription edge functions (service role).
-- getPlan() reads it; the app reads its own row (had_trial, dates).

create table public.subscriptions (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  has_entitlement  boolean not null default false,
  expires_at       timestamptz,
  grace_expires_at timestamptz,
  period_type      text check (period_type in ('trial', 'intro', 'normal')),
  store            text,
  product_id       text,
  will_renew       boolean not null default false,
  had_trial        boolean not null default false,
  updated_at       timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions: read own"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
