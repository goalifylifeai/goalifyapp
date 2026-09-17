CREATE TABLE IF NOT EXISTS public.coach_insights (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         text        NOT NULL CHECK (kind IN ('insights', 'weekly')),
  content      jsonb       NOT NULL,
  model        text        NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);

ALTER TABLE public.coach_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_insights_select_own"
  ON public.coach_insights FOR SELECT
  USING (auth.uid() = user_id);

-- No insert/update/delete policies for the anon/authenticated role: rows are
-- written exclusively by the ai-coach Edge Function via the service-role key.
