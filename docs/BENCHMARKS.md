# Benchmarks

dbsnap does not publish benchmark claims yet. Database snapshot timing depends heavily on database size, disk speed, PostgreSQL client version, Docker overhead, WAL state, indexes, and how much data your app writes between save and restore.

Use this document to generate repeatable numbers before making performance claims.

## Goals

Measure:

- time to save a checkpoint
- time to restore a checkpoint
- resulting snapshot artifact size
- impact on a test setup workflow

Do not compare unrelated datasets. Always record schema size, row counts, database version, OS, disk type, Node version, and dbsnap version.

## Benchmark Cases

Recommended cases:

| Case | Database | Description |
|---|---|---|
| SQLite small DB | SQLite | A local file with a few tables and thousands of rows |
| PostgreSQL small DB | PostgreSQL | Local Postgres with app-like seed data |
| PostgreSQL medium DB | PostgreSQL | Local Postgres with enough data to make dump/restore meaningful |
| Playwright restore | SQLite or PostgreSQL | Restore immediately before a representative Playwright run |

## Safe Runner

After building the repo, run:

```bash
pnpm build
DATABASE_URL=file:./dev.db pnpm benchmark
```

On Windows PowerShell:

```powershell
$env:DATABASE_URL = "file:./dev.db"
pnpm benchmark
```

The script prints environment info and times a dbsnap save/restore cycle. It refuses suspicious targets such as remote PostgreSQL hosts, production-like database names, and `NODE_ENV=production`.

## Suggested SQLite Small DB Setup

Create a local SQLite database with your app or with a small script. Then run:

```bash
DATABASE_URL=file:./dev.db pnpm benchmark
```

Record:

```text
OS:
Node:
dbsnap:
Database:
Rows:
DB file size:
Save time:
Restore time:
Snapshot size:
```

## Suggested PostgreSQL Small DB Setup

Use a disposable local database:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_benchmark"
```

Then run:

```bash
pnpm build
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_benchmark" pnpm benchmark
```

Record the PostgreSQL server version and whether Docker fallback was used.

## Comparing Against Alternatives

Compare only against workflows that solve the same problem:

- A handwritten `pg_dump` / `pg_restore` script can be very close to dbsnap for raw PostgreSQL dump/restore time because dbsnap uses those primitives.
- PostgreSQL template database approaches can be faster for local PostgreSQL restore, but they do not cover SQLite and have different setup and portability tradeoffs.
- Seed scripts are often better for deterministic baseline data, but they rebuild state instead of restoring an already-created state.
- Docker volume snapshots can be fast in Docker-only workflows, but they are less database-aware and tend to need platform-specific scripts.

Do not claim dbsnap is faster without benchmark data from the same machine and dataset.
