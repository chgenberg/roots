# Masterdata CSV (`packages/db/data/master/`)

Canonical source of truth for the masterdata hierarchy (Riksorganisation → Segment).
These files are seeded into `master_riksorganisation` and `master_segment` by
`pnpm --filter @roots/db db:seed:masters`. The seed is **idempotent** and safe
to re-run after edits.

## Files

| File | Rows | Headers | Target table |
| --- | --- | --- | --- |
| `riksorganisationer.csv` | 114 | `Riksorganisation`, `Typ av Riksorganisation` | `master_riksorganisation` |
| `segment_master.csv` | 110 | `Riksorganisation`, `Segment / Förbund`, `Typ` | `master_segment` |

## Workflow

1. Edit the source Excel files in `public/Feedback_14:5/`.
2. Re-export the CSVs:
   ```bash
   pnpm --filter @roots/db db:masters:extract
   ```
3. Review the CSV diff in the PR — every row is human-readable.
4. After deploy, run the seed against the target database:
   ```bash
   DATABASE_URL=postgres://... pnpm --filter @roots/db db:seed:masters
   ```

## Design notes

- `code` columns are not in the CSV; they are derived by `slugify()` at seed
  time and made unique within scope (global for riksorg, per-riks for segments).
  This keeps the CSV stable across reordering.
- v1 is **additive-only**: rows removed from CSV are **not** deleted from the
  DB. A future migration will introduce tombstones (see
  `docs/feedback-plans/01-master-data/04_seed_import.txt`).
- Unknown riksorganisations referenced by segment rows are skipped with a
  loud warning. Fix the CSV and re-run.
