# dbsnap Beta Release Audit

## Current version

`0.9.0-beta.7`

Registry status checked on 2026-05-10: npm `@beta` and `latest` still point to `0.9.0-beta.6`. Publish `0.9.0-beta.7` before expecting public `npx @canblmz1/dbsnap@beta` smoke tests to match this repository state.

## Smoke tested commands

- `npx dbsnap --version`
- `npx dbsnap --help`
- `npx dbsnap init --dry-run`
- `npx dbsnap list --json`
- `npx dbsnap prune --help`
- `npx dbsnap verify --help`

Final local verification passed on Windows with:

- `pnpm install`
- `pnpm typecheck`
- `pnpm test` (`51` core tests, `22` CLI tests)
- `pnpm build`
- `pnpm pack:smoke`
- temp consumer install from the local publishable tarballs
- `npx dbsnap --version` -> `0.9.0-beta.7`

## Fixed Issues

- Aligned root, CLI, core, lockfile, examples, and metadata version values at `0.9.0-beta.7`.
- Kept `dbsnap --version` tied to the core metadata version and covered it with regression tests.
- Verified that `prune` and `verify` are registered CLI commands and public Node API exports.
- Reworked README CLI Reference into a command table that matches the real command registry.
- Added README global options coverage for all top-level flags.
- Clarified the difference between `--force-i-know-what-i-am-doing` and `--allow-different-target`.
- Expanded pack smoke coverage for tarball install, `npx`, npm scripts, `pnpm exec`, path-with-spaces installs, `verify`, and `prune`.
- Improved `doctor` JSON and human output with runtime, config, DATABASE_URL source, SQLite, snapshots directory, PostgreSQL tooling, Docker, and safety diagnostics.
- Ensured failed `verify --json` exits with code 1.

## Remaining Known Limitations

- PostgreSQL and Docker integration behavior is covered mostly with unit/mocked tests; a live integration job can be added later.
- SQLite WAL/SHM sidecars are copied, but snapshots are most reliable when the app is not writing during `save`.
- Large local databases can take noticeable time depending on disk speed and dump size.
- Snapshot compression, first-party test runner helper exports, MySQL support, completions, and richer TUI flows are planned.

## Recommended GitHub Metadata

Description:

```text
Fast local database checkpoints for Prisma, Drizzle, Playwright and Vitest.
```

Topics:

```text
database, snapshot, postgresql, sqlite, prisma, drizzle, developer-tools, cli, typescript, testing, playwright, vitest
```

Website:

```text
https://github.com/canblmz1/dbsnap#readme
```

## Recommended Release Note

## v0.9.0-beta.7

### Fixed

- Fixed npm/npx CLI binary invocation.
- Added real pack smoke testing.
- Added `prune` command.
- Added `verify` command.
- Aligned CLI/core package versions.
- Hardened restore safety checks.
- Improved `doctor` diagnostics.
- Repositioned README and examples around local development checkpoints.
- Added benchmark methodology and safe benchmark runner.
- Added `NODE_ENV=production` safety blocking.

### Notes

- Beta release.
- Local development database snapshot tool.
- Not a production backup tool.
- PostgreSQL requires `pg_dump`/`pg_restore` or Docker fallback.
