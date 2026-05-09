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

| Platform | Install guidance |
| --- | --- |
| macOS | `brew install libpq` or `brew install postgresql@16`; make sure `pg_dump` and `pg_restore` are on `PATH`. |
| Windows | Install PostgreSQL from the official installer and add the `bin` folder to `PATH`, or use Docker mode. |
| Linux | Install your distro package such as `postgresql-client` or `postgresql-client-16`. |

## Target Matching

Restore checks the snapshot source against the current PostgreSQL host, port, and database name. Restoring into a different local database requires explicit confirmation or `--allow-different-target`.
