# dbsnap

[![npm version](https://img.shields.io/npm/v/@canblmz1/dbsnap.svg)](https://www.npmjs.com/package/@canblmz1/dbsnap)
[![CI](https://github.com/canblmz1/dbsnap/actions/workflows/ci.yml/badge.svg)](https://github.com/canblmz1/dbsnap/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@canblmz1/dbsnap.svg)](https://github.com/canblmz1/dbsnap/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6.svg)](https://www.typescriptlang.org/)

**Time travel for your local development database.**

Stop re-running migrations, seeds, and UI setup flows just to recreate the same local database state.

```bash
npm install -D @canblmz1/dbsnap
npx dbsnap save checkout-ready
# break your local database while developing
npx dbsnap restore checkout-ready
```

Works with PostgreSQL, SQLite, Prisma, Drizzle, Docker, Vitest, and Playwright.
The npm package is `@canblmz1/dbsnap`; the installed CLI binary is `dbsnap`.

> [!WARNING]
> dbsnap is not a production backup tool. It is for disposable local development databases.
> Do not commit `.dbsnaps/`, `.env`, local SQLite files, PostgreSQL dumps, or other snapshot artifacts.

## Demo

<p align="center">
  <img src="https://raw.githubusercontent.com/canblmz1/dbsnap/main/assets/dbsnap-demo.gif" alt="dbsnap terminal demo" width="760">
</p>

See the [demo script](https://github.com/canblmz1/dbsnap/blob/main/docs/demo-script.md) for the full terminal flow.

```text
UI: Users: 10
$ npx dbsnap save ten-users
Saved snapshot "ten-users".

# delete all users
UI: Users: 0

$ npx dbsnap restore ten-users --yes
Restored snapshot "ten-users".
UI: Users: 10
```

## Quick Start

```bash
npm install -D @canblmz1/dbsnap
npx dbsnap --help
npx dbsnap init
npx dbsnap save dev-ready
```

Then make a mess and come back:

```bash
npx dbsnap restore dev-ready
```

Using pnpm:

```bash
pnpm add -D @canblmz1/dbsnap
pnpm exec dbsnap --help
pnpm exec dbsnap init
pnpm exec dbsnap save dev-ready
pnpm exec dbsnap restore dev-ready
```

Small local development databases usually restore quickly. Larger databases depend on dump size, disk speed, and PostgreSQL tooling, so save/restore can take noticeable time.

## The Problem

You are testing checkout.

You run migrations. You run seed scripts. You click through the app to create the perfect cart state: user logged in, cart populated, discount applied, payment step ready.

Then your test changes or corrupts the local database.

Now you have to repeat the entire setup flow.

`dbsnap` saves that useful state once:

```bash
npx dbsnap save checkout-ready
```

Then you can restore it later without rebuilding the state manually:

```bash
npx dbsnap restore checkout-ready
```

## Supported Workflows

- SQLite local files
- PostgreSQL via `pg_dump` / `pg_restore`
- Docker PostgreSQL
- Prisma projects
- Drizzle projects
- Vitest / Playwright test setup

## SQLite

```env
DATABASE_URL="file:./dev.db"
```

```bash
npx dbsnap save checkout-ready
npx dbsnap restore checkout-ready --yes
```

SQLite snapshots are file copies stored under:

```text
.dbsnaps/<name>/database.sqlite
```

If your SQLite database is in WAL mode, dbsnap also stores the matching `-wal` and `-shm` sidecar files. For the most reliable snapshot, pause writes before saving.

## PostgreSQL

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_dev"
```

```bash
npx dbsnap doctor
npx dbsnap save seed-ready
npx dbsnap restore seed-ready --yes
```

PostgreSQL snapshots use `pg_dump --format=custom` and `pg_restore --clean --if-exists --no-owner`.

`dbsnap` is designed for local development databases. Large databases may take longer to save and restore.
PostgreSQL support requires local `pg_dump` / `pg_restore` binaries or Docker fallback.

### PostgreSQL Client Tools

| Platform | Install guidance |
| --- | --- |
| macOS | `brew install libpq` or `brew install postgresql@16`; make sure `pg_dump` and `pg_restore` are on `PATH`. |
| Windows | Install PostgreSQL from the official installer and add the `bin` folder to `PATH`, or use Docker mode. |
| Linux | Install your distro package such as `postgresql-client` or `postgresql-client-16`. |

## Docker PostgreSQL

If local `pg_dump` or `pg_restore` is missing, dbsnap can use a matching PostgreSQL Docker container.

```bash
npx dbsnap doctor
npx dbsnap save docker-ready --docker
npx dbsnap restore docker-ready --docker --yes
```

Docker matching uses the exposed PostgreSQL port from `DATABASE_URL`. If multiple containers match, dbsnap stops and asks for an explicit choice.

On Windows, Docker mode expects Docker Desktop to be running and the container port to be published to the host.

## Prisma

```bash
pnpm prisma migrate dev
pnpm prisma db seed
pnpm exec dbsnap save seeded
```

`dbsnap init` detects `prisma/schema.prisma`, `.env`, `.env.local`, and `DATABASE_URL`.

## Drizzle

```bash
pnpm drizzle-kit push
pnpm tsx seed.ts
pnpm exec dbsnap save drizzle-ready
```

`dbsnap init` detects `drizzle.config.ts`.

## Vitest

```ts
import { beforeEach } from "vitest";
import { restoreSnapshot } from "@canblmz1/dbsnap";

beforeEach(async () => {
  await restoreSnapshot("test-ready", { yes: true });
});
```

## Playwright

```ts
import { test } from "@playwright/test";
import { restoreSnapshot } from "@canblmz1/dbsnap";

test.beforeEach(async () => {
  await restoreSnapshot("checkout-ready", { yes: true });
});
```

Avoid running tests in parallel against the same database unless your setup isolates state per worker.

## Safety

**dbsnap is safe by default.**

Saving and restoring are refused unless the target database looks local. This keeps dbsnap scoped to disposable development data instead of turning it into an accidental production backup workflow.

Allowed targets:

- `localhost`
- `127.0.0.1`
- `::1`
- local SQLite files

Blocked by default:

- hosted PostgreSQL providers
- non-local hosts
- database names or paths containing `prod`, `production`, `staging`, or `live`

Override the remote/risky target guard only when you are certain the database is disposable:

```bash
npx dbsnap restore snapshot-name --force-i-know-what-i-am-doing
```

dbsnap also records the database target that created each snapshot. If you try to restore a snapshot into a different local database, dbsnap asks for explicit confirmation. In non-interactive usage, pass this only when intentional:

```bash
npx dbsnap restore snapshot-name --allow-different-target --yes
```

These flags are intentionally different. `--force-i-know-what-i-am-doing` is only for the risky/remote database guard. `--allow-different-target` is only for restoring a snapshot into a different local database target. One flag does not bypass the other.

Secrets are redacted in normal and debug output. Raw database URLs with credentials are never printed.

dbsnap snapshots are local artifacts and should not be committed. `dbsnap init` adds the snapshots directory to `.gitignore`.
Users should still avoid committing `.env` files or any file containing database credentials.

## Not A Production Backup Tool

`dbsnap` is not:

- a production backup system
- a migration tool
- a cloud database branching service
- a disaster recovery solution

It is a local development workflow tool for disposable local databases.

## CLI Reference

| Command | Description |
|---|---|
| `dbsnap init` | Initialize dbsnap in this project |
| `dbsnap doctor` | Check configuration, safety, and local tooling |
| `dbsnap save <name>` | Save the current local database state |
| `dbsnap restore [name]` | Restore a saved database snapshot |
| `dbsnap list` | List saved database snapshots |
| `dbsnap prune [options]` | Delete old snapshots by retention policy |
| `dbsnap delete <name>` | Delete a saved snapshot |
| `dbsnap rename <old> <new>` | Rename a saved snapshot |
| `dbsnap info <name>` | Show details for one snapshot |
| `dbsnap verify <name>` | Verify snapshot metadata and artifacts |
| `dbsnap --version` | Print version |

Global options:

| Option | Description |
|---|---|
| `--json` | Print JSON output where supported |
| `--yes` | Skip confirmation prompts |
| `--dry-run` | Show what would happen without changing files or databases |
| `--debug` | Print additional debug information with secrets redacted |
| `--verbose` | Print more command output |
| `--snapshots-dir <dir>` | Snapshots directory |
| `--docker` | Use PostgreSQL client tools inside a matching Docker container |
| `--no-docker` | Do not fall back to Docker for PostgreSQL client tools |
| `--force-i-know-what-i-am-doing` | Allow save/restore to a database dbsnap considers risky |
| `--allow-different-target` | Allow restore when the snapshot was saved from a different database target |

For non-interactive JSON usage, destructive commands such as `restore` and `delete` require `--yes` or `--dry-run`.

Prune examples:

```bash
dbsnap prune --keep-last 5 --dry-run
dbsnap prune --older-than 7d --json
```

## Node API

```ts
import {
  saveSnapshot,
  restoreSnapshot,
  listSnapshots,
  deleteSnapshot,
  getSnapshotInfo,
  verifySnapshot,
  pruneSnapshots,
  loadDbsnapConfig,
} from "@canblmz1/dbsnap";

await saveSnapshot("checkout-ready");
await restoreSnapshot("checkout-ready", { yes: true });
await pruneSnapshots({ keepLast: 5, dryRun: true });
```

The API is typed, does not prompt, does not print to the terminal, and enforces safety by default.

Use `allowDifferentTarget: true` only when intentionally restoring a snapshot into a different local database.

## Why Not Just Use pg_dump?

You can. `dbsnap` uses boring database primitives under the hood.

The value is the workflow around them:

- named snapshots
- metadata
- `.env` detection
- SQLite + PostgreSQL support
- Docker-aware PostgreSQL
- safety guards
- source-target mismatch checks
- secret redaction
- test-runner API
- friendly CLI output

## Comparison

| Approach | What happens |
| --- | --- |
| `pg_dump` scripts | Powerful, but every repo reinvents naming, safety, redaction, Docker, and DX. |
| Docker volume hacks | Fast until you need named states, metadata, SQLite, or cross-platform behavior. |
| Cloud database branching | Great for hosted workflows; overkill for a local dev database on a laptop. |
| dbsnap | Local, named snapshots with safety guards and a small CLI. |

## Roadmap

- MySQL adapter
- Snapshot compression
- Snapshot diffs
- Test-runner fixtures
- Better interactive TUI
- Shell completions

## Good First Issues

- Add more framework examples
- Improve installation guidance for PostgreSQL client tools
- Add adapter docs for a new database
- Add shell completions
- Add a short demo GIF

## Known Limitations

- PostgreSQL support depends on `pg_dump` / `pg_restore` locally or inside Docker.
- Default tests mock command construction and do not require a real PostgreSQL server.
- SQLite in-memory databases cannot be snapshotted.
- `dbsnap` intentionally refuses remote-looking restores unless forced.
- Restoring to a different target requires separate explicit confirmation.
- Large local databases may take longer to save and restore.
- SQLite WAL sidecars are copied, but snapshots are most reliable when the app is not actively writing during `save`.

## Contributing

See the [contributing guide](https://github.com/canblmz1/dbsnap/blob/main/CONTRIBUTING.md) and [security policy](https://github.com/canblmz1/dbsnap/blob/main/SECURITY.md).

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```
