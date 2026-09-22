-- Journal fixes:
--
-- 1. Full entry text. The client previously stored only a 140-char `excerpt`,
--    so everything past that was lost. `body` holds the full entry; `excerpt`
--    stays as the short preview (and is what the AI coach reads, to bound
--    prompt size).
--
-- 2. Sentiment type. The column was `smallint` in [-2, 2], but the client
--    computes a float in [-1, 1] (e.g. 0.33). Postgres rejects "0.33" for a
--    smallint, so any entry with an emotional word failed to insert. Existing
--    rows can only be integers in [-2, 2]; map them onto [-1, 1].

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS body text CHECK (body IS NULL OR length(body) <= 20000);

ALTER TABLE public.journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_sentiment_check;

ALTER TABLE public.journal_entries
  ALTER COLUMN sentiment TYPE real USING (sentiment::real / 2);

ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_sentiment_check CHECK (sentiment BETWEEN -1 AND 1);
