# Fixes

Date: 2026-05-10

## Critical Bugs Found

1. Package, core, CLI, example, lockfile, and metadata versions could drift during release.
2. The installed CLI binary needed regression coverage for npm/npx invocation through package tarballs.
3. README command documentation needed to be tied to the real Commander registry.
4. `save` needed the same local-development safety posture as restore.
5. `verify --json` needed to return a failing process status when checks fail.
6. Pack smoke needed to cover `prune`, `verify`, JSON output, npm scripts, `pnpm exec`, and paths with spaces.
7. `doctor` needed actionable diagnostics for real local machines, not only a shallow config summary.

## Fixed

- Version alignment is locked to `0.9.0-beta.7`.
- `dbsnap --version` matches the publishable package version.
- `pruneSnapshots` and `verifySnapshot` are public exports.
- `dbsnap prune` and `dbsnap verify` are registered commands.
- README and package README document all important CLI commands and global options.
- `--force-i-know-what-i-am-doing` and `--allow-different-target` are documented as separate safety controls.
- `doctor` reports runtime, config, DATABASE_URL source, SQLite, snapshots directory, PostgreSQL tools, Docker fallback, and safety status.
- `scripts/pack-smoke.mjs` validates the real tarball install path and command behavior.

## Tests Added Or Strengthened

- Version mismatch tests.
- README command and option alignment tests.
- SQLite save/restore/verify/list lifecycle tests.
- Prune keep-last, older-than, dry-run, JSON, and invalid input tests.
- Verify success, missing snapshot, corrupt/missing artifact, size mismatch, type mismatch, and JSON failure status tests.
- Doctor JSON, missing DATABASE_URL, SQLite diagnostics, and secret redaction tests.
- Spawn and PostgreSQL/Docker command planning tests.

## Verification

- `pnpm install`
- `pnpm typecheck`
- `pnpm test` (`51` core tests, `22` CLI tests)
- `pnpm build`
- `pnpm pack:smoke`
- Local publishable tarball smoke with `@canblmz1/dbsnap` and `@canblmz1/dbsnap-core`
- npm registry `@beta` currently points to `0.9.0-beta.6`; publish `0.9.0-beta.7` before public registry smoke should match this repo.
- `npx dbsnap --version` -> `0.9.0-beta.7`
- `npx dbsnap --help`, `init --dry-run`, `list --json`, `prune --help`, and `verify --help`

## Remaining Risks

- Live PostgreSQL/Docker integration tests are not yet part of CI.
- Compression and first-party test helpers are planned, not shipped.
- Large local databases may be slow.

## Publish Notes

Publish order:

```bash
cd packages/core
npm publish --access public --tag beta

cd ../cli
npm publish --access public --tag beta
```

Post-publish smoke:

```bash
npm install -D @canblmz1/dbsnap@beta
npx dbsnap --version
npx dbsnap --help
npx dbsnap init --dry-run
npx dbsnap list --json
npx dbsnap prune --help
npx dbsnap verify --help
```
