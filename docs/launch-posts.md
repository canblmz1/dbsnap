# Launch Posts

## Hacker News

Title:

```text
Show HN: dbsnap - time travel for your local development database
```

Post:

```text
I built dbsnap, a CLI for saving and restoring named local development database states.

The workflow is:
1. Run migrations/seeds/click through the UI once.
2. dbsnap save checkout-ready
3. Break the DB while building.
4. dbsnap restore checkout-ready

It supports SQLite, local PostgreSQL, Docker-based PostgreSQL, Prisma, Drizzle, Vitest, and Playwright workflows. It is intentionally not a production backup tool, and restore refuses remote/production-looking databases by default.
```

## Reddit

```text
I made dbsnap, a small CLI for local dev DB snapshots.

The problem: I kept re-running migrations, seed scripts, and UI setup flows just to get back to the same local state.

With dbsnap:
dbsnap save checkout-ready
dbsnap restore checkout-ready

It supports SQLite and PostgreSQL, works with Docker, and has safety guards so it will not restore remote/production-looking DBs unless explicitly forced.
```

## X/Twitter Thread

```text
1/ I built dbsnap: time travel for your local development database.

2/ Save a working DB state:
   dbsnap save checkout-ready

3/ Break everything while building.

4/ Restore quickly:
   dbsnap restore checkout-ready

5/ Works with SQLite, PostgreSQL, Docker, Prisma, Drizzle, Vitest, and Playwright.

6/ Not a production backup tool. Destructive restore is blocked for remote/production-looking databases by default.
```

## Dev.to Outline

- The local database reset loop
- Why seeds are not enough
- The dbsnap workflow
- SQLite example
- PostgreSQL and Docker example
- Safety model
- Testing with Vitest and Playwright
- What is next
