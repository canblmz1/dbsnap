# dbsnap Release Hardening Report

Date: 2026-05-09  
Recommended next version: `0.9.0-beta.4`

## Executive Summary

This pass focused on publish-after-install behavior, destructive restore safety, child process reliability, package smoke testing, docs accuracy, and release readiness.

Status: **GO for `0.9.0-beta.4` after publishing both packages and moving the `latest` dist-tag only after smoke testing.**

## Critical Bugs Found

1. **Installed CLI could silently do nothing through npm bin symlinks.**  
   The CLI entrypoint compared the literal module path with `process.argv[1]`, which can differ when npm/pnpm invokes a symlinked binary.

2. **Restore could target the wrong local database if `DATABASE_URL` changed after saving.**  
   The safety guard blocked remote and production-looking targets, but it did not verify that a snapshot created from one local DB was being restored into the same local DB.

3. **PostgreSQL dump streams could resolve before the output file fully finished writing.**  
   `pg_dump` Docker mode streamed stdout to a local file, but `runSpawn` previously resolved on child close without waiting for the output stream `finish` event.

4. **Spawn argument safety blocked valid Windows/user paths while not modeling the real risk.**  
   The blanket shell-metacharacter ban could reject safe literal args such as paths containing spaces or `&`, even though runtime uses `shell: false`.

5. **CI did not test the actual npm tarball user path.**  
   Typecheck/test/build could pass while the published package binary, files whitelist, shebang, or installed `npx dbsnap` workflow was broken.

## Fixes Made

- Fixed CLI entrypoint detection with `fs.realpathSync.native()` so npm/pnpm symlinked binaries invoke `main()` correctly.
- Added `isDirectCliInvocation()` regression coverage.
- Added restore target identity checks based on snapshot metadata:
  - SQLite uses a resolved path identity.
  - PostgreSQL uses host, port, and database name identity.
- Added `--allow-different-target` to the CLI and `allowDifferentTarget?: boolean` to the Node API.
- Kept remote/risky target override separate from target mismatch override; `--force-i-know-what-i-am-doing` does not bypass different-target protection.
- Added `dbsnap verify <name>` and `verifySnapshot()` for snapshot metadata/artifact validation.
- Hardened `runSpawn()`:
  - waits for output stream `finish`
  - propagates output stream errors
  - propagates input stream errors
  - keeps `shell: false`
  - rejects NUL bytes
  - allowlists runtime commands: `pg_dump`, `pg_restore`, `docker`
  - redacts args in command error details
- Added `pnpm pack:smoke`:
  - runs `npm pack`
  - validates tarball files
  - checks CLI shebang
  - installs core and CLI tarballs into a temp project
  - imports public Node API exports from the installed CLI package
  - runs `npx dbsnap --version`
  - runs `npx dbsnap --help`
  - runs `npx dbsnap init --dry-run`
  - runs SQLite `save` and `restore`
- Added CI pack smoke coverage on Ubuntu, macOS, and Windows for Node 20 and 22.
- Updated README and package README:
  - scoped install commands: `@canblmz1/dbsnap`
  - npm-safe links
  - badges
  - visible production-backup warning
  - PostgreSQL client tool guidance
  - target mismatch safety docs
  - `verify` command reference
- Updated safety, SQLite, PostgreSQL, roadmap, and publish checklist docs.
- Added `CHANGELOG.md`.

## Tests Added

- CLI direct invocation through npm-style symlink.
- CLI help includes `verify`.
- CLI JSON restore blocks different-target restore in non-interactive mode.
- CLI `verify --json` output.
- Core `verifySnapshot()` metadata/artifact checks.
- SQLite different-target restore blocks by default.
- SQLite different-target restore succeeds with `allowDifferentTarget`.
- Different-target protection still applies when `force` bypasses remote safety.
- Spawn waits for output stream finish.
- Spawn propagates output stream errors.
- Spawn propagates input stream errors.
- Spawn allows spaces and `&` as literal args with `shell: false`.
- Spawn rejects NUL bytes.
- Spawn rejects unsupported commands.
- Spawn reports timeouts after terminating child processes.

## Verification Run

Passed locally:

```bash
pnpm install --lockfile-only
pnpm typecheck
pnpm test
pnpm build
pnpm pack:smoke
```

Smoke-tested package behavior:

```bash
npm pack
npm init -y
npm install -D <core tarball> <cli tarball>
npx dbsnap --version
npx dbsnap --help
npx dbsnap init --dry-run
DATABASE_URL=file:./dev.db npx dbsnap save test
DATABASE_URL=file:./dev.db npx dbsnap restore test --yes
```

## Known Limitations

- PostgreSQL integration tests are mocked by default and do not require a real PostgreSQL server.
- Docker tests are mocked by default and do not require a real Docker daemon.
- SQLite in-memory databases cannot be snapshotted.
- SQLite WAL sidecars are copied, but snapshots are most reliable when the app is not actively writing during `save`.
- Large local databases may take longer to save and restore.
- Compression, prune/retention policies, and first-party test-runner helpers are planned, not included in this release.

## Planned Features

1. `save --compress gzip` and compressed restore with backward-compatible metadata.
2. `@canblmz1/dbsnap/vitest` and `@canblmz1/dbsnap/playwright` helper exports.
3. Better `doctor` output with `pg_dump` / `pg_restore` versions and richer Docker mismatch explanations.
4. `dbsnap prune --keep-last 5` and `dbsnap prune --older-than 7d`.
5. Shell completions.

## npm Publish Checklist

Run from a clean working tree after CI is green:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm pack:smoke

cd packages/core
npm publish --access public --tag beta

cd ../cli
npm publish --access public --tag beta

npm dist-tag add @canblmz1/dbsnap-core@0.9.0-beta.4 latest
npm dist-tag add @canblmz1/dbsnap@0.9.0-beta.4 latest
npm dist-tag ls @canblmz1/dbsnap-core
npm dist-tag ls @canblmz1/dbsnap
```

If npm web authentication returns `E403` for a dist-tag update, retry the same `npm dist-tag add` command after completing the browser authentication. The package publish can be successful even when a later dist-tag update fails.

## GitHub Launch Checklist

- Push the `0.9.0-beta.4` hardening commit.
- Confirm GitHub Actions passes on Node 20 and 22 across Ubuntu, macOS, and Windows.
- Confirm npm package pages show the updated README and version.
- Confirm `npx dbsnap --version` reports `0.9.0-beta.4` in a fresh temp project.
- Confirm npm dist-tags:
  - `@canblmz1/dbsnap-core`: `latest` and `beta` point to `0.9.0-beta.4`
  - `@canblmz1/dbsnap`: `latest` and `beta` point to `0.9.0-beta.4`
- Publish launch posts only after the above smoke checks pass.
