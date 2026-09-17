-- Journal entries no longer carry a sphere (finance/health/career/relationships) tag —
-- product decision to remove the 4-pillar categorization from journaling.
ALTER TABLE public.journal_entries
  DROP COLUMN IF EXISTS sphere;
