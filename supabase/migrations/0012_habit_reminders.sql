-- Add per-habit reminder scheduling.
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS reminder_hour   smallint CHECK (reminder_hour BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS reminder_minute smallint CHECK (reminder_minute BETWEEN 0 AND 59);

-- `calendar_event_id` is written by the app (SET_HABIT_CALENDAR_ID) but was
-- missing from the original 0008 migration — add it now so those writes persist.
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS calendar_event_id text;
