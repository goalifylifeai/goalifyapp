-- Vision assets: one row per goal per progress stage (0–3).
-- status lifecycle: pending → generating → ready | error
CREATE TABLE IF NOT EXISTS public.vision_assets (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id        text        NOT NULL,
  stage          smallint    NOT NULL CHECK (stage BETWEEN 0 AND 3),
  storage_path   text        NOT NULL DEFAULT '',
  prompt_hash    text        NOT NULL DEFAULT '',
  seed           bigint      NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'generating', 'ready', 'error')),
  error_msg      text,
  generated_at   timestamptz,
  last_regen_at  timestamptz,
  regen_count    int         NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_id, stage)
);

ALTER TABLE public.vision_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vision_assets_select_own"
  ON public.vision_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "vision_assets_insert_own"
  ON public.vision_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vision_assets_update_own"
  ON public.vision_assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Storage bucket created via Supabase dashboard or SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('vision-assets', 'vision-assets', false)
--   ON CONFLICT DO NOTHING;
