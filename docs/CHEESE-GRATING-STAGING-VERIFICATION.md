# Cheese Grating — isolated staging verification runbook (2026-11-03)

**Status:** Instructions only. This document does not authorize running SQL against production. Do not merge or deploy PR #57 on source-regex tests alone.

## 1. Preflight — read-only, BEFORE migration

Connect to an isolated staging database populated with representative schema and data. Verify the connection target and record migration version, transaction ID, and operator. Do not use production credentials.

```sql
select current_database(), current_user, current_schema();
select con.conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid=con.conrelid
join pg_namespace ns on ns.oid=rel.relnamespace
where ns.nspname='public' and rel.relname='movies'
  and (con.contype='c' or con.conname ilike '%cheese%')
order by con.conname;
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='movies'
  and column_name='cheese_score';
```

**Stop** if a second ceiling exists, the constraint name differs, the column is absent, or the schema does not match expectations. Document and review the discrepancy; do not blindly drop constraints.

Snapshot existing movie IDs, stored scores, and movie-trait associations into a protected staging audit export before applying the migration. Exclude private notes and personal information. Use stable ordering and compare row counts and content hashes after migration.

## 2. Migration and constraint checks — staging only

Apply `supabase/migrations/20261103010000_uncap_cheese_grating.sql` using the same migration mechanism as release. Rerun the catalog queries above and confirm the effective constraint is nonnegative only. In a transaction, test a **disposable staging movie** with score 140, verify a negative score fails, and roll back. Respect all required columns and FKs in the real schema; do not fabricate INSERT templates from assumed columns. Verify NULL behavior separately against `is_nullable`, not merely the CHECK expression.

Repeat the migration in staging and verify the resulting catalog has one intended named constraint. The SQL's `DROP CONSTRAINT IF EXISTS` is not proof that a different ceiling has been removed.

## 3. Trigger integration tests — staging only

Create a disposable staging movie and verified traits totaling 140. Through the real `movie_traits` insert/delete path, confirm the trigger stores the exact uncapped sum, and that removing a trait reduces the sum correctly. Do not treat unverified/predicted traits or Bingo marks as confirmed movie traits. Inspect the trigger function and its security context before invoking it.

Test a `cheese_traits.points` update on a disposable trait and document the current behavior without adding an unreviewed global recalculation. Preserve historical stored values until a separate provenance-aware reconciliation is approved.

## 4. Security, release, and recovery gates

- Exercise anonymous, nonmember, and authorized workspace sessions against the actual RLS and mutation paths; assert unauthorized writes are denied and authorized legitimate edits work.
- Confirm pre/post-migration row hashes for existing movies and movie-trait links are unchanged; investigate every difference.
- Capture exact Git commit, migration version, SQL query results, trigger test output, and auth test results in the release record.
- Back up schema and relevant data before production release. Define a restore plan; **do not blindly reintroduce a <=100 constraint** if valid scores above 100 have been written.
- Merge only after current-head CI, staging checks, authenticated laptop/phone recovery, Bingo snapshot verification, and real REAPER marker import are recorded.

**Acceptance:** all tests have captured evidence, no historical score backfill, no unauthorized writes, and an explicit reviewer sign-off. A passing source-contract test alone is insufficient.
