# SQLite

`dbsnap` supports these SQLite URL formats:

```env
DATABASE_URL="file:./dev.db"
DATABASE_URL="sqlite:./dev.db"
DATABASE_URL="sqlite://./dev.db"
```

## Save

```bash
dbsnap save dev-ready
```

The database file is copied to:

```text
.dbsnaps/dev-ready/database.sqlite
```

If SQLite WAL mode is active, dbsnap also stores the matching `database.sqlite-wal` and `database.sqlite-shm` sidecar files. Pause active writes before saving for the most consistent local snapshot.

## Restore

```bash
dbsnap restore dev-ready
```

The CLI asks for confirmation unless `--yes` is passed.

## Limitations

SQLite in-memory databases are not supported because there is no durable file to copy.
SQLite WAL sidecars are copied, but snapshots are most reliable when the app is not actively writing during `save`.
