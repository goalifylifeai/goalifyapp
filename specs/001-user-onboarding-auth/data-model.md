# Phase 1 Data Model: User Onboarding & Auth

All tables live in the `public` schema. Both reference `auth.users(id)` (Supabase-managed) with `ON DELETE CASCADE`.

## Entities

### `profiles`

One row per authenticated user; created by trigger on `auth.users` insert.

| Column                        | Type                       | Constraints                                  | Notes |
|-------------------------------|----------------------------|----------------------------------------------|-------|
| `user_id`                     | `uuid`                     | PK, FK → `auth.users(id)` ON DELETE CASCADE  | Same as auth user id |
| `display_name`                | `text`                     | NOT NULL, `length(display_name) BETWEEN 1 AND 50` | Defaults to empty string until onboarding step 1 |
| `pronouns`                    | `text`                     | NULL allowed, `length <= 30`                 | e.g., `she/her`, `they/them` |
| `gender_aware_coaching`       | `boolean`                  | NOT NULL DEFAULT true                        | Toggle on profile screen |
| `avatar_url`                  | `text`                     | NULL allowed                                 | Reserved for future; not surfaced in v1 |
| `created_at`                  | `timestamptz`              | NOT NULL DEFAULT `now()`                     |  |
| `updated_at`                  | `timestamptz`              | NOT NULL DEFAULT `now()`                     | Touched by `BEFORE UPDATE` trigger |

Indexes: PK on `user_id` is sufficient (one row per user, lookups always by id).

### `onboarding_state`

One row per authenticated user; created by trigger.

| Column          | Type            | Constraints                                                | Notes |
|-----------------|-----------------|------------------------------------------------------------|-------|
| `user_id`       | `uuid`          | PK, FK → `auth.users(id)` ON DELETE CASCADE                |  |
| `current_step`  | `onboarding_step` (enum) | NOT NULL DEFAULT `'name'`                          | See enum below |
| `selections`    | `jsonb`         | NOT NULL DEFAULT `'{}'::jsonb`                             | Captured per-step input |
| `completed_at`  | `timestamptz`   | NULL allowed                                               | Non-null ⇒ onboarding done |
| `created_at`    | `timestamptz`   | NOT NULL DEFAULT `now()`                                   |  |
| `updated_at`    | `timestamptz`   | NOT NULL DEFAULT `now()`                                   |  |

Enum:
```sql
CREATE TYPE onboarding_step AS ENUM ('name', 'spheres', 'tone', 'pronouns', 'complete');
```

`selections` shape (validated client-side; not enforced by Postgres):
```json
{
  "display_name": "string (1..50)",
  "spheres": ["sphereId", "..."],     // 1..N from constants/theme SphereId set
  "coaching_tone": "warm" | "direct" | "playful",
  "pronouns": "string|null"
}
```

State transitions:
```
name → spheres → tone → pronouns → complete
                                  ↘ (skip pronouns) → complete
```
Only forward transitions allowed by client; the server accepts any update (RLS gates auth, not transition order — keeps the policy simple).

## Relationships

```
auth.users (1) ─┬─< (1) profiles
                └─< (1) onboarding_state
```

Cascade: deleting `auth.users` row removes both child rows.

## Row-Level Security

### `profiles`
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT and DELETE intentionally have no policies → denied for client roles.
-- Trigger uses SECURITY DEFINER to insert; cascade handles delete.
```

### `onboarding_state`
```sql
ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_select_own"
  ON public.onboarding_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "onboarding_update_own"
  ON public.onboarding_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## Triggers & Functions

### `handle_new_user()`
Runs as `SECURITY DEFINER` (so it bypasses RLS) on `AFTER INSERT ON auth.users`.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));

  INSERT INTO public.onboarding_state (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### `set_updated_at()`
```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER onboarding_touch BEFORE UPDATE ON public.onboarding_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

## Validation rules (enforced client-side, mirrored where cheap in DB)

- `display_name`: trimmed, 1–50 chars (DB CHECK constraint).
- `pronouns`: optional, max 30 chars (DB CHECK constraint).
- `selections.spheres`: at least 1 entry, drawn from `SphereId` enum in `constants/theme.ts`. Not DB-enforced (would couple Postgres schema to client enum churn).
- `current_step` advances only forward (client guard); backend accepts any value because trying to enforce here either complicates the policy or requires a stored proc.
