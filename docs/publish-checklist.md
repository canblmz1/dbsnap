# Publish Checklist

- [ ] `pnpm install`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
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
- [ ] Confirm version is `0.9.0-beta.1`
- [ ] Publish `@dbsnap/core` before `dbsnap`
- [ ] Confirm `dbsnap` depends on the published `@dbsnap/core` version
