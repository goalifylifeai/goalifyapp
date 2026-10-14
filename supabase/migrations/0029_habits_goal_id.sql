-- Persist the habit → goal link.
-- Spec: specs/011-goal-health (FR-001, Story 1).
--
-- The app has offered "add a habit for this goal" since the habit prompt
-- shipped, but the link only ever lived in client memory: bootstrap rebuilt
-- habits from this table without it, so every link vanished on the next
-- launch. Goal health reads linked-habit consistency, so the link has to
-- survive a restart and a second device.
--
-- ON DELETE SET NULL: deleting a goal keeps its habits (existing behaviour),
-- they simply stop counting toward any goal. Links made before this
-- migration are already gone and cannot be recovered.

alter table public.habits
  add column if not exists goal_id uuid null references public.goals(id) on delete set null;

create index if not exists habits_goal_id_idx on public.habits (goal_id) where goal_id is not null;
