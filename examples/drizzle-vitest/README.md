# Drizzle + Vitest + dbsnap

Minimal skeleton for restoring a known local Drizzle database checkpoint before integration tests.

## Install

```bash
npm install -D @canblmz1/dbsnap drizzle-kit tsx typescript vitest
npm install drizzle-orm better-sqlite3
```

## Configure

Create `.env`:

```env
DATABASE_URL="file:./dev.db"
```

Create your database state:

```bash
npx drizzle-kit migrate
npm run db:seed
npx dbsnap save test-ready
```

## Run tests

```bash
npm test
```

`test/setup.ts` restores `test-ready` before each integration test. For large databases, restoring before every test can be expensive; restore once per suite or use one isolated database per worker.
