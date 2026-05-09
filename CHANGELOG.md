# Changelog

## 0.9.0-beta.6

Release polish for the npm beta after the final audit pass.

- Expanded `doctor` output with runtime, config, SQLite, snapshot directory, Docker fallback, and safety diagnostics.
- Strengthened `verify --json` failure exit behavior.
- Expanded tarball smoke testing for `prune`, `verify`, JSON output, npm scripts, `pnpm exec`, and paths with spaces.
- Aligned README/package docs with the real CLI command registry and global options.
- Added `RELEASE_AUDIT.md` and updated the feature roadmap.

## 0.9.0-beta.5

Republish release for the CI-stabilized release hardening changes.

- Keeps the `0.9.0-beta.4` hardening work intact.
- Includes the Windows CI fix for the README command reference regression test.

## 0.9.0-beta.4

Release-readiness hardening for the published scoped packages.

- Fixed CLI entrypoint detection when the installed `dbsnap` binary is reached through an npm-style symlink.
- Added restore target mismatch protection using snapshot metadata, with `--allow-different-target` and `allowDifferentTarget` for explicit overrides.
- Hardened child process execution by waiting for output stream completion, propagating input/output stream errors, and rejecting NUL bytes while allowing safe literal path characters with `shell: false`.
- Added `dbsnap verify <name>` and `verifySnapshot()` for metadata/artifact checks.
- Added `dbsnap prune` with `--keep-last`, `--older-than`, `--dry-run`, and `--json`.
- Blocked `save` against remote or production-looking databases by default, keeping `--force-i-know-what-i-am-doing` as the explicit local-disposable override.
- Improved `doctor` output with PostgreSQL client tool versions, DATABASE_URL source, Docker daemon guidance, and container matching warnings.
- Added npm pack smoke testing that installs the tarballs into a temporary project and runs `npx dbsnap` commands.
- Polished README/package docs for scoped npm install commands, visible safety boundaries, PostgreSQL tooling guidance, and npm-safe links.

## 0.9.0-beta.3

- Fixed SQLite WAL snapshots by copying and restoring `-wal` and `-shm` sidecar files.
- Removed stale SQLite sidecar files on restore when the snapshot does not include them.
- Added tests and docs for SQLite WAL behavior.

## 0.9.0-beta.2

- Published scoped beta packages for CLI and core.
- Added initial package metadata, README, and npm `files` whitelists.

## 0.9.0-beta.1

- Initial beta package structure with TypeScript core, CLI, PostgreSQL, SQLite, Docker detection, safety guards, examples, docs, and CI.
