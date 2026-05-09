# Publish Checklist

## Version Bump

- [ ] Update `version` in root `package.json`, `packages/core/package.json`, and `packages/cli/package.json`
- [ ] Update `packages/cli/package.json` dependency on `@canblmz1/dbsnap-core` to the same version
- [ ] Update `DBSNAP_VERSION` in `packages/core/src/snapshots/metadata.ts` to the same version
- [ ] Add a `CHANGELOG.md` entry for the version
- [ ] Run the version alignment test with `pnpm test`

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
- [ ] Confirm version is `0.9.0-beta.4`
- [ ] Confirm `dbsnap restore` different-target guard behavior
- [ ] Publish `@canblmz1/dbsnap-core` with the `beta` dist-tag before `@canblmz1/dbsnap`
- [ ] Publish `@canblmz1/dbsnap` with the `beta` dist-tag
- [ ] Confirm `@canblmz1/dbsnap` depends on the published `@canblmz1/dbsnap-core` version

## GitHub Repository Metadata

- Description: `Time travel for your local development database.`
- Topics: `database`, `snapshot`, `postgresql`, `sqlite`, `prisma`, `drizzle`, `docker`, `testing`, `developer-tools`, `typescript`
- Website/docs link: `https://github.com/canblmz1/dbsnap#readme`
