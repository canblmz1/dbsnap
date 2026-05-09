# Roadmap

`dbsnap` starts with SQLite and local PostgreSQL because those cover a large slice of Node, Next.js, Prisma, Drizzle, Vitest, and Playwright development.

## Near Term

- Improve PostgreSQL installation guidance per OS.
- Add shell completions.
- Add compressed snapshot storage.
- Add richer doctor diagnostics for Docker Compose.
- Add fixtures for Vitest and Playwright.

## Later

- MySQL adapter.
- SQL Server adapter.
- Snapshot diff metadata.
- Optional snapshot retention policies.
- First-party demo app and GIF.

## Not Planned

- Production backup scheduling.
- Hosted database branching.
- Migration generation.
