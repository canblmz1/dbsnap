# Safety

Restore is destructive, so dbsnap blocks risky targets by default.

## Allowed By Default

- SQLite file databases
- PostgreSQL on `localhost`
- PostgreSQL on `127.0.0.1`
- PostgreSQL on `::1`

## Blocked By Default

- Non-local PostgreSQL hosts
- Hosted providers such as RDS, Supabase, Neon, Railway, Render, and Fly
- Database names or paths containing `prod`, `production`, `staging`, or `live`

## Override

```bash
dbsnap restore snapshot-name --force-i-know-what-i-am-doing
```

Use the override only for disposable local databases.

## Secret Redaction

dbsnap redacts database passwords and token-like query parameters in normal and debug output.

## Git Hygiene

dbsnap snapshots are local artifacts and should not be committed. `dbsnap init` adds the snapshots directory to `.gitignore`.
