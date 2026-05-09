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

## Restore

```bash
dbsnap restore dev-ready
```

The CLI asks for confirmation unless `--yes` is passed.

## Limitations

SQLite in-memory databases are not supported because there is no durable file to copy.
