CREATE TABLE IF NOT EXISTS public.habits (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label              text        NOT NULL CHECK (length(label) BETWEEN 1 AND 100),
  icon               text        NOT NULL,
  sphere             text        NOT NULL CHECK (sphere IN ('finance','health','career','relationships')),
  target_description text        NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS habits_user_id_idx ON public.habits (user_id);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habits_select_own"
  ON public.habits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "habits_insert_own"
  ON public.habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habits_update_own"
  ON public.habits FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habits_delete_own"
  ON public.habits FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER habits_touch
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
