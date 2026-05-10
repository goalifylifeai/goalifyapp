CREATE TABLE IF NOT EXISTS public.journal_entries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date        NOT NULL,
  sphere     text        NOT NULL CHECK (sphere IN ('finance','health','career','relationships')),
  sentiment  smallint    NOT NULL CHECK (sentiment BETWEEN -2 AND 2),
  excerpt    text        NOT NULL CHECK (length(excerpt) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journal_entries_user_id_idx        ON public.journal_entries (user_id);
CREATE INDEX IF NOT EXISTS journal_entries_user_id_date_idx   ON public.journal_entries (user_id, date);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entries_select_own"
  ON public.journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "journal_entries_insert_own"
  ON public.journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journal_entries_update_own"
  ON public.journal_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journal_entries_delete_own"
  ON public.journal_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER journal_entries_touch
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- GDPR/CCPA note: ON DELETE CASCADE on user_id ensures all rows are removed
-- when the user's auth.users record is deleted. This satisfies the right-to-erasure
-- requirement. The account deletion endpoint (future task) must call
-- supabase.auth.admin.deleteUser(userId) to trigger the cascade.
