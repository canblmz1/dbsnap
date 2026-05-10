# Safety

dbsnap is a local development snapshot tool, not a production backup tool. Saving and restoring are blocked for risky targets by default.

## Allowed By Default

- SQLite file databases
- PostgreSQL on `localhost`
- PostgreSQL on `127.0.0.1`
- PostgreSQL on `::1`

## Blocked By Default

- Non-local PostgreSQL hosts
- Hosted providers such as RDS, Supabase, Neon, Railway, Render, and Fly
- Database names or paths containing `prod`, `production`, `staging`, or `live`
- `NODE_ENV=production`

## Overrides

```bash
dbsnap save snapshot-name --force-i-know-what-i-am-doing
dbsnap restore snapshot-name --force-i-know-what-i-am-doing
```

Use `--force-i-know-what-i-am-doing` only for disposable local databases when dbsnap blocks a risky or remote-looking target.

## Snapshot Target Matching

dbsnap stores a local source identity in snapshot metadata. Restore compares that identity with the current `DATABASE_URL` target.

If the snapshot was created from a different SQLite path or PostgreSQL database target, restore is blocked in non-interactive mode and asks for confirmation in the CLI. This catches mistakes such as restoring `app_dev` into `other_dev`.

Use this only when the target mismatch is intentional:

```bash
dbsnap restore snapshot-name --allow-different-target --yes
```

The remote/risky database guard and the different-target guard are separate. `--force-i-know-what-i-am-doing` does not bypass target mismatch protection.
Likewise, `--allow-different-target` does not bypass remote or production-like database safety.

## Secret Redaction

dbsnap redacts database passwords and token-like query parameters in normal and debug output.

## Git Hygiene

dbsnap snapshots are local artifacts and should not be committed. `dbsnap init` adds the snapshots directory to `.gitignore`.
