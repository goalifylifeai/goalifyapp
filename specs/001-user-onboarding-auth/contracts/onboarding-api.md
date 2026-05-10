# Contract: Onboarding (PostgREST)

Backed by `public.onboarding_state` with RLS.

## Read onboarding state

```ts
const { data, error } = await supabase
  .from('onboarding_state')
  .select('user_id, current_step, selections, completed_at')
  .eq('user_id', session.user.id)
  .single();
```

Routing rule (in `<AuthGate>`):

| Result                           | Route to                                |
|----------------------------------|-----------------------------------------|
| `completed_at !== null`          | `(tabs)`                                |
| `current_step === 'name'`        | `(onboarding)/name`                     |
| `current_step === 'spheres'`     | `(onboarding)/spheres`                  |
| `current_step === 'tone'`        | `(onboarding)/tone`                     |
| `current_step === 'pronouns'`    | `(onboarding)/pronouns`                 |
| 0 rows (shouldn't happen)        | Force re-trigger via INSERT? No — treat as bug, surface error |

## Advance step

After each step's submit:

```ts
await supabase
  .from('onboarding_state')
  .update({
    current_step: NEXT_STEP,                 // enum value
    selections: { ...prev, [stepKey]: value }, // jsonb merge done client-side
  })
  .eq('user_id', session.user.id);
```

## Mark complete

Final step submit:

```ts
await supabase
  .from('onboarding_state')
  .update({
    current_step: 'complete',
    completed_at: new Date().toISOString(),
    selections: { ...allSelections },
  })
  .eq('user_id', session.user.id);

// Also mirror display_name into profiles if not yet set:
await supabase
  .from('profiles')
  .update({ display_name: selections.display_name, pronouns: selections.pronouns })
  .eq('user_id', session.user.id);
```

After success, `<AuthGate>` reroutes to `(tabs)`.

## Failure handling

- Network failure during step advance: keep the user on the current step, show inline error, retry button. Do not advance UI optimistically.
- 403 (RLS denied): treat as session-expired; force sign-out.
- Concurrent device: PostgREST returns the latest row on next read; no conflict resolution needed because we always merge selections client-side using last-write-wins per key.

## Selections shape (client TypeScript)

```ts
type OnboardingSelections = {
  display_name?: string;
  spheres?: SphereId[];
  coaching_tone?: 'warm' | 'direct' | 'playful';
  pronouns?: string;
};
```

Mirrored to `profiles.display_name` / `profiles.pronouns` only at completion to keep profile reads cheap and avoid every keystroke writing to two tables.
