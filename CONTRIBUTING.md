# Contributing

Thanks for helping make local database workflows less repetitive.

## Setup

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Architecture

- `packages/core` contains config loading, safety checks, adapters, snapshot metadata, and the public Node API.
- `packages/cli` contains terminal UI, prompts, command formatting, and API re-exports for the publishable `dbsnap` package.
- Core code must not prompt or print.
- CLI code must use core APIs.

## Pull Requests

- Keep changes scoped.
- Add tests for important behavior.
- Do not log raw credentials or database URLs.
- Use `spawn` with argument arrays for external commands.
- Keep docs and README examples consistent with CLI behavior.
