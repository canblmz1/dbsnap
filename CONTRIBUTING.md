# Contributing

Thanks for helping make local database workflows less repetitive.

## Project Scope

dbsnap is a local development and test database checkpoint tool. It should stay focused on disposable local PostgreSQL and SQLite workflows for Prisma, Drizzle, Playwright, Vitest, Docker, and similar developer tooling.

It should not become:

- a production backup system
- a hosted database branching service
- a migration framework
- a secret manager

## Setup

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:smoke
```

## Architecture

- `packages/core` contains config loading, safety checks, adapters, snapshot metadata, and the public Node API.
- `packages/cli` contains terminal UI, prompts, command formatting, and API re-exports for the publishable `@canblmz1/dbsnap` package.
- Core code must not prompt or print.
- CLI code must use core APIs.
- External commands must use spawn argument arrays with `shell: false`.

## Pull Requests

- Keep changes scoped.
- Add tests for important behavior.
- Update README/package README when CLI behavior changes.
- Do not log raw credentials or database URLs.
- Keep restore safety and target-mismatch behavior explicit.
- Add docs for new user-facing flags and workflows.

## Release Checklist

Before publishing a new npm version:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:smoke
```

Then test the packed or published package in a clean consumer directory with `npx dbsnap --version`, `npx dbsnap --help`, `npx dbsnap doctor`, and at least one SQLite save/restore/verify flow.
