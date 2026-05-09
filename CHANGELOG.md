# Changelog

## 0.9.0-beta.4

Release-readiness hardening for the published scoped packages.

- Fixed CLI entrypoint detection when the installed `dbsnap` binary is reached through an npm-style symlink.
- Added restore target mismatch protection using snapshot metadata, with `--allow-different-target` and `allowDifferentTarget` for explicit overrides.
- Hardened child process execution by waiting for output stream completion, propagating input/output stream errors, and rejecting NUL bytes while allowing safe literal path characters with `shell: false`.
- Added `dbsnap verify <name>` and `verifySnapshot()` for metadata/artifact checks.
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
