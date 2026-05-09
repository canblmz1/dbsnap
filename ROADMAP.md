# Roadmap

`dbsnap` is a local development database snapshot tool for SQLite and local PostgreSQL workflows. It is not a production backup system.

## P1: Better Doctor

Problem: users need a single command that explains why save/restore will or will not work on their machine.

Proposed API: `getDoctorReport(options)` returns JSON-safe diagnostics for runtime, config, DATABASE_URL, database type, local tooling, snapshots directory, and safety.

CLI syntax:

```bash
dbsnap doctor
dbsnap doctor --json
```

Edge cases:

- Missing `DATABASE_URL`
- Redacted credentials and tokens
- Missing SQLite file
- Missing or unwritable snapshots directory
- Missing `pg_dump` / `pg_restore`
- Docker installed but daemon unavailable
- Multiple matching PostgreSQL Docker containers

Required tests:

- Human output includes runtime and safety sections
- JSON output parses and redacts secrets
- Missing database URL is actionable
- SQLite diagnostics include WAL/SHM note
- PostgreSQL tool guidance is present when tools are missing

Docs impact: README doctor section, PostgreSQL install guidance, troubleshooting docs.

## P1: Demo GIF / asciinema Terminal Demo

Problem: npm users should understand the workflow within the first 20 seconds.

Proposed API: no API change.

CLI syntax:

```bash
dbsnap save ten-users
dbsnap restore ten-users --yes
```

Edge cases:

- Keep demo local and disposable
- Do not show real credentials
- Keep output short enough for npm README rendering

Required tests:

- Demo script commands are included in pack smoke or docs smoke
- README links remain valid

Docs impact: replace "Demo GIF coming soon" with a short GIF or asciinema link.

## P1: Vitest Helper

Problem: repeated restore setup in tests is easy to copy incorrectly.

Proposed API:

```ts
import { restoreBeforeEach } from "@canblmz1/dbsnap/vitest";

restoreBeforeEach("test-ready", { yes: true });
```

CLI syntax: none.

Edge cases:

- Parallel workers sharing one database
- Missing snapshot
- Different target mismatch
- JSON/no prompt behavior in CI

Required tests:

- Helper restores before each test
- Helpful warning for parallel worker configs
- Type exports resolve from package tarball

Docs impact: README Vitest section and examples.

## P1: Playwright Helper

Problem: e2e tests often need a known database state before each test or suite.

Proposed API:

```ts
import { restoreBeforeEach } from "@canblmz1/dbsnap/playwright";

restoreBeforeEach("checkout-ready", { yes: true });
```

CLI syntax: none.

Edge cases:

- Parallel projects/workers
- Shared database target
- Restore failures before browser startup

Required tests:

- Helper installs from packed package
- Type exports resolve
- Parallel warning is documented

Docs impact: README Playwright section and example project.

## P1: Snapshot Compression

Problem: local PostgreSQL dumps and SQLite files can be large.

Proposed API:

```ts
await saveSnapshot("seeded", { compression: "gzip" });
```

CLI syntax:

```bash
dbsnap save seeded --compress gzip
dbsnap restore seeded --yes
```

Edge cases:

- Backward-compatible metadata for uncompressed snapshots
- Verify compressed artifact size and decompression
- Restore should auto-detect compression
- Avoid streaming bugs before metadata size is calculated

Required tests:

- Save compressed SQLite snapshot
- Restore compressed SQLite snapshot
- Verify compressed snapshot
- Pack smoke with compressed save/restore

Docs impact: README CLI Reference, metadata docs, known limitations.

## P2: MySQL Adapter

Problem: many Node apps use local MySQL/MariaDB for development.

Proposed API: extend `DatabaseType` with `mysql`.

CLI syntax:

```bash
DATABASE_URL=mysql://root:password@localhost:3306/app_dev dbsnap save seeded
```

Edge cases:

- Local-only safety checks
- `mysqldump` / `mysql` binary discovery
- Docker fallback ambiguity
- Secret redaction for passwords and query params

Required tests:

- URL parsing
- command arg builders with `shell: false`
- missing tool guidance
- remote/risky target blocking

Docs impact: MySQL setup docs and README supported workflows.

## P2: Shell Completions

Problem: CLI discoverability improves with completion support.

Proposed API: none.

CLI syntax:

```bash
dbsnap completions bash
dbsnap completions zsh
dbsnap completions fish
dbsnap completions powershell
```

Edge cases:

- Cross-shell output
- No shell execution in generation
- Windows PowerShell path handling

Required tests:

- Each shell command prints non-empty completion text
- Pack smoke confirms command is registered

Docs impact: CLI Reference and install instructions.

## P2: Snapshot Diff Metadata

Problem: users need to know which snapshot is worth restoring.

Proposed API:

```ts
await getSnapshotDiff("before", "after");
```

CLI syntax:

```bash
dbsnap diff before after
dbsnap diff before after --json
```

Edge cases:

- Metadata-only diff first
- Avoid reading large database files by default
- Missing/corrupt metadata

Required tests:

- Diff same database type
- Diff different database type
- JSON output is stable

Docs impact: README CLI Reference and examples.

## P2: Interactive TUI

Problem: restore/delete flows benefit from safer selection and confirmation.

Proposed API: no public API change.

CLI syntax:

```bash
dbsnap restore
dbsnap delete
```

Edge cases:

- Non-interactive mode must never prompt when `--json` is used
- Terminal-less CI should fail clearly
- Large snapshot lists should stay readable

Required tests:

- Prompt skipped in JSON mode
- Prompt cancellation exits cleanly
- Selection handles empty list

Docs impact: CLI usage docs.

## P2: Example Apps

Problem: users need copyable Prisma, Drizzle, Vitest, and Playwright examples.

Proposed API: no API change.

CLI syntax: use existing `dbsnap save` / `dbsnap restore` flows.

Edge cases:

- Examples must not commit local DB snapshots
- Example scripts must run cross-platform
- No real credentials in `.env.example`

Required tests:

- Example package install
- Example smoke scripts

Docs impact: README examples and npm package links.
