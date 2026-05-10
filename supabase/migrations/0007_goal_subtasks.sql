CREATE TABLE IF NOT EXISTS public.goal_subtasks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    uuid        NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       text        NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  done       boolean     NOT NULL DEFAULT false,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_subtasks_goal_id_idx  ON public.goal_subtasks (goal_id);
CREATE INDEX IF NOT EXISTS goal_subtasks_user_id_idx  ON public.goal_subtasks (user_id);

ALTER TABLE public.goal_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_subtasks_select_own"
  ON public.goal_subtasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "goal_subtasks_insert_own"
  ON public.goal_subtasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goal_subtasks_update_own"
  ON public.goal_subtasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goal_subtasks_delete_own"
  ON public.goal_subtasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER goal_subtasks_touch
  BEFORE UPDATE ON public.goal_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
