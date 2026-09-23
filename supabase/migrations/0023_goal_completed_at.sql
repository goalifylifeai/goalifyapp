-- A goal is completed when the user marks it so; null means active.
alter table public.goals add column if not exists completed_at timestamptz;
