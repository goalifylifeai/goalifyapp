CREATE TABLE IF NOT EXISTS public.habit_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id   uuid        NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date        NOT NULL,
  done       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, date)
);

CREATE INDEX IF NOT EXISTS habit_logs_habit_id_date_idx ON public.habit_logs (habit_id, date);
CREATE INDEX IF NOT EXISTS habit_logs_user_id_date_idx  ON public.habit_logs (user_id, date);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habit_logs_select_own"
  ON public.habit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "habit_logs_insert_own"
  ON public.habit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habit_logs_update_own"
  ON public.habit_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habit_logs_delete_own"
  ON public.habit_logs FOR DELETE
  USING (auth.uid() = user_id);
-- No updated_at trigger: habit_logs are toggled via upsert (delete+reinsert semantics),
-- not in-place updates.
