-- Daily ritual: one row per user per calendar date (user's local date).
CREATE TABLE IF NOT EXISTS public.daily_intentions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          date        NOT NULL,
  focus_sphere  text        NOT NULL
                            CHECK (focus_sphere IN ('finance','health','career','relationships')),
  actions       jsonb       NOT NULL DEFAULT '[]',
  -- actions element shape:
  -- { "id": uuid, "text": string, "sphere": SphereId,
  --   "is_must_do": boolean, "done": boolean, "source": "goal_subtask"|"habit"|"free" }
  must_do_done  boolean     NOT NULL DEFAULT false,
  journal_line  text        CHECK (length(journal_line) <= 280),
  next_sphere   text        CHECK (next_sphere IN ('finance','health','career','relationships')),
  closed_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.daily_intentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_intentions_select_own"
  ON public.daily_intentions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "daily_intentions_insert_own"
  ON public.daily_intentions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_intentions_update_own"
  ON public.daily_intentions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
