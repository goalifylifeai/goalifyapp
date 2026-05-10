# Reset Onboarding State

Run this in the [Supabase SQL Editor](https://supabase.com/dashboard/project/xirdtuifhaqrzlvgynyb/sql/new).

## SQL

```sql
-- Fix: add missing enum value so the future_letter step can be saved
ALTER TYPE public.onboarding_step ADD VALUE IF NOT EXISTS 'future_letter' BEFORE 'complete';

-- Reset onboarding for pulkitinberlin@gmail.com
UPDATE public.onboarding_state
SET current_step = 'name',
    selections   = '{}'::jsonb,
    completed_at = NULL,
    updated_at   = now()
WHERE user_id = (
  SELECT id FROM auth.users
  WHERE email = 'pulkitinberlin@gmail.com'
  LIMIT 1
);

-- Verify
SELECT os.current_step, os.completed_at, u.email
FROM public.onboarding_state os
JOIN auth.users u ON u.id = os.user_id
WHERE u.email = 'pulkitinberlin@gmail.com';
```

## What this does

| Step | Effect |
|------|--------|
| `ALTER TYPE` | Adds `future_letter` to the DB enum — was missing, which broke the pronouns → future-letter transition |
| `UPDATE` | Resets `current_step` to `name`, clears selections, nulls `completed_at` |
| `SELECT` | Confirms the reset — you should see `current_step = name` and `completed_at = null` |

## To reset any other user

Replace the email in the `WHERE` clause.

## Full onboarding flow after reset

```
Sign in
  → name
  → spheres
  → tone
  → pronouns
  → future-letter
  → (welcome) add-goal    ← explains what the app is
  → (welcome) add-task    ← first task for that goal
  → (tabs)                ← main app
```
