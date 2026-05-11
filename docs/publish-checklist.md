# Publish Checklist

## Version Bump

- [ ] Update `version` in root `package.json`, `packages/core/package.json`, and `packages/cli/package.json`
- [ ] Update `packages/cli/package.json` dependency on `@canblmz1/dbsnap-core` to the same version
- [ ] Update `DBSNAP_VERSION` in `packages/core/src/snapshots/metadata.ts` to the same version
- [ ] Add a `CHANGELOG.md` entry for the version
- [ ] Run the version alignment test with `pnpm test`

You can update these files locally with:

```bash
pnpm version:bump 0.9.0-beta.8
pnpm install
```

Or use the manual GitHub Actions release workflow after configuring the `NPM_TOKEN` repository secret.

## Manual GitHub Actions Release

The `Release` workflow is intentionally manual. It does not publish on every push.

Required repository secret:

- `NPM_TOKEN`: npm automation token with publish access to `@canblmz1/dbsnap-core` and `@canblmz1/dbsnap`

Workflow inputs:

- `version`: exact version to publish, for example `0.9.0-beta.8`
- `npm_tag`: `beta` for beta releases or `latest` for stable releases
- `promote_to_latest`: also move the `latest` dist-tag to this version
- `release_notes`: Markdown used in `CHANGELOG.md` and the GitHub Release

The workflow:

1. Validates the version and checks it is not already published.
2. Bumps package versions and `DBSNAP_VERSION`.
3. Updates the lockfile.
4. Runs install, typecheck, tests, build, and pack smoke.
5. Commits the release version and creates `v<version>`.
6. Publishes core first, then CLI.
7. Runs a clean npm consumer smoke test.
8. Creates the GitHub Release.

## Pre-Publish Commands

- [ ] `pnpm install`
- [ ] `pnpm install --frozen-lockfile` in CI
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm pack:smoke`
- [ ] `dbsnap --help`
- [ ] `dbsnap --version`
- [ ] `dbsnap doctor`
- [ ] SQLite save/restore smoke test
- [ ] Confirm PostgreSQL command builders use argument arrays
- [ ] Confirm restore safety blocks remote hosts
- [ ] Confirm debug output redacts secrets
- [ ] Confirm README commands match CLI
- [ ] Confirm docs match behavior
- [ ] Confirm package exports
- [ ] Confirm `files` whitelist
- [ ] Confirm version is the next unpublished npm version.
- [ ] Confirm `dbsnap restore` different-target guard behavior
- [ ] Publish `@canblmz1/dbsnap-core` with the `beta` dist-tag before `@canblmz1/dbsnap`
- [ ] Publish `@canblmz1/dbsnap` with the `beta` dist-tag
- [ ] Confirm `@canblmz1/dbsnap` depends on the published `@canblmz1/dbsnap-core` version

## GitHub Repository Metadata

- Description: `Fast local database checkpoints for Prisma, Drizzle, Playwright and Vitest.`
- Topics: `database`, `snapshot`, `postgresql`, `sqlite`, `prisma`, `drizzle`, `docker`, `testing`, `developer-tools`, `typescript`
- Website/docs link: `https://github.com/canblmz1/dbsnap#readme`
