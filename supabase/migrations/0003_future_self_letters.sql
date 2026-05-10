-- Extend the onboarding_step enum to include the future_letter step.
ALTER TYPE public.onboarding_step ADD VALUE IF NOT EXISTS 'future_letter' BEFORE 'complete';

-- future_self_letters: one row per letter (original + AI-generated updates).
CREATE TABLE IF NOT EXISTS public.future_self_letters (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  horizon      text        NOT NULL CHECK (horizon IN ('1m', '3m', '6m', '1y')),
  letter_type  text        NOT NULL DEFAULT 'original'
                           CHECK (letter_type IN ('original', 'quarterly_update', 'yearend_reflection')),
  body         text        NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  audio_url    text,
  period_label text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.future_self_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "future_letters_select_own"
  ON public.future_self_letters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "future_letters_insert_own"
  ON public.future_self_letters FOR INSERT
  WITH CHECK (auth.uid() = user_id);
