# PostgREST Contract: goals + goal_subtasks

The Supabase client speaks directly to PostgREST. All calls require a valid JWT (Bearer token from `supabase.auth.session()`). RLS enforces user isolation server-side.

---

## goals

### Fetch all goals for current user

```ts
const { data, error } = await supabase
  .from('goals')
  .select('*')
  .order('created_at', { ascending: true });
```

**Response shape** (array):
```ts
{
  id: string;           // uuid
  user_id: string;      // uuid
  sphere: 'finance' | 'health' | 'career' | 'relationships';
  title: string;
  due_date: string | null;  // ISO date 'YYYY-MM-DD'
  created_at: string;
  updated_at: string;
}
```

---

### Upsert a goal

```ts
const { error } = await supabase
  .from('goals')
  .upsert({
    id,           // client-generated uuid
    user_id,      // from auth session
    sphere,
    title,
    due_date,
  }, { onConflict: 'id' });
```

---

### Delete a goal

```ts
const { error } = await supabase
  .from('goals')
  .delete()
  .eq('id', goalId);
```

Cascades to `goal_subtasks` automatically (FK ON DELETE CASCADE).

---

## goal_subtasks

### Fetch all subtasks for a goal

```ts
const { data, error } = await supabase
  .from('goal_subtasks')
  .select('*')
  .eq('goal_id', goalId)
  .order('sort_order', { ascending: true });
```

**Response shape** (array):
```ts
{
  id: string;
  goal_id: string;
  user_id: string;
  text: string;
  done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

---

### Fetch all subtasks for current user (bootstrap)

```ts
const { data, error } = await supabase
  .from('goal_subtasks')
  .select('*')
  .order('sort_order', { ascending: true });
```

---

### Upsert a subtask

```ts
const { error } = await supabase
  .from('goal_subtasks')
  .upsert({
    id,
    goal_id,
    user_id,
    text,
    done,
    sort_order,
  }, { onConflict: 'id' });
```

---

### Delete a subtask

```ts
const { error } = await supabase
  .from('goal_subtasks')
  .delete()
  .eq('id', subtaskId);
```

---

## Error Handling

| Error code | Meaning | Action |
|-----------|---------|--------|
| `PGRST301` | JWT expired | Re-authenticate via `supabase.auth.refreshSession()` |
| `42501` | RLS violation | Should not occur if `user_id` is always set from session |
| Network error | No connectivity | Enqueue operation in offline write queue |
