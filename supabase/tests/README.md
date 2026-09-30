# Database tests

Plain SQL scripts that run inside one transaction and roll back. Run them
against a **local** Supabase database (`supabase start`), never production.

```bash
DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Streak rules: SQL must agree with lib/date.ts on the shared fixtures
psql "$DB" -v ON_ERROR_STOP=1 \
  -v fixtures="$(cat __tests__/fixtures/streak-cases.json)" \
  -f supabase/tests/streak_parity.sql

# XP ledger: awards, caps, revokes, RLS, backfill + carryover
psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/xp_ledger.sql
```

Each prints a `NOTICE ... all ... pass` line on success and stops with
`ERROR: FAIL ...` on the first broken check.
