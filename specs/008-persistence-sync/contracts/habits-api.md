# PostgREST Contract: habits + habit_logs

---

## habits

### Fetch all habits for current user (bootstrap)

```ts
const { data, error } = await supabase
  .from('habits')
  .select('*')
  .order('created_at', { ascending: true });
```

**Response shape** (array):
```ts
{
  id: string;
  user_id: string;
  label: string;
  icon: string;
  sphere: 'finance' | 'health' | 'career' | 'relationships';
  target_description: string;
  created_at: string;
  updated_at: string;
}
// Note: doneToday and streak are NOT columns; derived from habit_logs at bootstrap
```

---

### Upsert a habit

```ts
const { error } = await supabase
  .from('habits')
  .upsert({
    id,
    user_id,
    label,
    icon,
    sphere,
    target_description,
  }, { onConflict: 'id' });
```

---

### Delete a habit

```ts
const { error } = await supabase
  .from('habits')
  .delete()
  .eq('id', habitId);
```

Cascades to all `habit_logs` for this habit.

---

## habit_logs

### Fetch logs for streak calculation (bootstrap)

Fetch the last 366 days of logs for all user habits in one query:

```ts
const since = new Date();
since.setFullYear(since.getFullYear() - 1);

const { data, error } = await supabase
  .from('habit_logs')
  .select('habit_id, date, done')
  .gte('date', since.toISOString().slice(0, 10))
  .order('date', { ascending: false });
```

**Response shape** (array):
```ts
{
  habit_id: string;
  date: string;   // 'YYYY-MM-DD'
  done: boolean;
}
```

---

### Toggle habit completion for a date

Upsert with `(habit_id, date)` as the conflict target:

```ts
const { error } = await supabase
  .from('habit_logs')
  .upsert({
    id,           // client-generated uuid (stable for idempotent replay)
    habit_id,
    user_id,
    date,         // today's local date: new Date().toISOString().slice(0, 10)
    done,
  }, { onConflict: 'habit_id,date' });
```

The `UNIQUE (habit_id, date)` constraint ensures idempotent upserts — replaying a queued toggle twice is safe.

---

## Derived fields (client-side, post-fetch)

### doneToday

```ts
const today = new Date().toISOString().slice(0, 10);
const doneToday = logs.some(l => l.habit_id === habit.id && l.date === today && l.done);
```

### streak

```ts
function computeStreak(habitId: string, logs: HabitLog[]): number {
  const logsForHabit = logs
    .filter(l => l.habit_id === habitId && l.done)
    .map(l => l.date)
    .sort()
    .reverse();

  let streak = 0;
  let day = new Date();
  day.setDate(day.getDate() - 1); // start from yesterday

  for (const date of logsForHabit) {
    const expected = day.toISOString().slice(0, 10);
    if (date === expected) {
      streak++;
      day.setDate(day.getDate() - 1);
    } else if (date < expected) {
      break;
    }
  }
  return streak;
}
```

---

## Error Handling

| Error code | Meaning | Action |
|-----------|---------|--------|
| `23505` | Unique violation on `(habit_id, date)` | Use upsert, not insert — this should not occur |
| `PGRST301` | JWT expired | Refresh session |
| Network error | No connectivity | Enqueue in offline write queue |
