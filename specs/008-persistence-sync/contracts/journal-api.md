# PostgREST Contract: journal_entries

---

## Fetch all journal entries for current user (bootstrap)

```ts
const { data, error } = await supabase
  .from('journal_entries')
  .select('*')
  .order('date', { ascending: false });
```

**Response shape** (array):
```ts
{
  id: string;
  user_id: string;
  date: string;     // 'YYYY-MM-DD'
  sphere: 'finance' | 'health' | 'career' | 'relationships';
  sentiment: number;  // -2 to +2
  excerpt: string;
  created_at: string;
  updated_at: string;
}
```

---

## Upsert a journal entry

```ts
const { error } = await supabase
  .from('journal_entries')
  .upsert({
    id,           // client-generated uuid
    user_id,
    date,
    sphere,
    sentiment,
    excerpt,
  }, { onConflict: 'id' });
```

---

## Delete a journal entry

```ts
const { error } = await supabase
  .from('journal_entries')
  .delete()
  .eq('id', entryId);
```

---

## Mapping to AppState.JournalEntry

```ts
// Supabase row → AppState type
function toJournalEntry(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    date: row.date,
    sphere: row.sphere as SphereId,
    sentiment: row.sentiment,
    excerpt: row.excerpt,
  };
}

// AppState type → Supabase upsert payload
function fromJournalEntry(entry: JournalEntry, userId: string): JournalRow {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    sphere: entry.sphere,
    sentiment: entry.sentiment,
    excerpt: entry.excerpt,
  };
}
```

---

## Error Handling

| Error code | Meaning | Action |
|-----------|---------|--------|
| `23514` | CHECK constraint violation (e.g. sentiment out of range) | Validate client-side before upsert |
| `PGRST301` | JWT expired | Refresh session |
| Network error | No connectivity | Enqueue in offline write queue |
