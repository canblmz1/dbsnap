# PostgreSQL

`dbsnap` supports local PostgreSQL through `pg_dump` and `pg_restore`.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_dev"
```

## Save

```bash
dbsnap save seed-ready
```

dbsnap runs `pg_dump` with custom format and writes:

```text
.dbsnaps/seed-ready/dump.pgcustom
```

## Restore

```bash
dbsnap restore seed-ready --yes
```

dbsnap runs `pg_restore` with:

```text
--clean --if-exists --no-owner
```

## Missing Tools

Install PostgreSQL client tools if `dbsnap doctor` reports missing `pg_dump` or `pg_restore`. If your database is in Docker, use `--docker`.
