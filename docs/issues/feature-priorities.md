# Feature Priorities

Use these as GitHub issue bodies when splitting the next release.

## P0: Verify Snapshots

Status: shipped in `0.9.0-beta.4`.

- [x] Add `dbsnap verify <name>`
- [x] Support `--json`
- [x] Detect missing metadata
- [x] Detect missing artifacts
- [x] Detect size mismatch
- [x] Detect current `DATABASE_URL` type mismatch

## P1: Prune Snapshots

Status: shipped in `0.9.0-beta.4`.

- [x] Add `dbsnap prune`
- [x] Support `--keep-last 5`
- [x] Support `--older-than 7d`
- [x] Support `--dry-run`
- [x] Support `--json`
- [x] Add regression tests
- [x] Document CLI examples

## P1: Snapshot Compression

Status: planned.

- [ ] Add `dbsnap save <name> --compress gzip`
- [ ] Restore compressed snapshots automatically
- [ ] Add `compression` metadata with backward compatibility for old snapshots
- [ ] Keep uncompressed snapshots as the default until install/runtime impact is measured
- [ ] Add pack smoke coverage for compressed save/restore

## P1: Better Doctor

Status: partially shipped in `0.9.0-beta.4`.

- [x] Show `pg_dump` and `pg_restore` versions when available
- [x] Show `DATABASE_URL` source
- [x] Report Docker daemon/Desktop availability
- [x] Explain missing or ambiguous PostgreSQL Docker container matches
- [ ] Detect Docker Compose service labels when available
- [ ] Warn on PostgreSQL client/server major version mismatch when server version can be discovered safely

## P1: Test Runner Helpers

Status: planned.

- [ ] Add `@canblmz1/dbsnap/vitest`
- [ ] Add `@canblmz1/dbsnap/playwright`
- [ ] Provide `restoreBeforeEach(name, options)`
- [ ] Warn when a helper is used with parallel workers against one shared database
- [ ] Add example projects and docs

## P2: Shell Completions

Status: planned.

- [ ] Generate completions for Bash, Zsh, Fish, and PowerShell
- [ ] Document install commands without shell-string execution

## P2: MySQL Adapter

Status: planned.

- [ ] Add local-only MySQL safety checks
- [ ] Use `mysqldump` and `mysql` with spawn arg arrays and `shell: false`
- [ ] Add Docker fallback only when a matching local container is unambiguous

## P2: Snapshot Diff Metadata

Status: planned.

- [ ] Store optional table/file summary metadata
- [ ] Add `dbsnap diff <left> <right>` for metadata-only comparisons first

## P2: Demo App

Status: planned.

- [ ] Add a tiny Prisma SQLite example with a repeatable UI state
- [ ] Record a short terminal/browser demo for the README

## P2: Better Interactive TUI

Status: planned.

- [ ] Add safer snapshot selection and restore confirmation flows
- [ ] Keep JSON and non-interactive modes prompt-free
