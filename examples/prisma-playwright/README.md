# Prisma + Playwright + dbsnap

Minimal skeleton for restoring a known local Prisma database checkpoint before Playwright runs.

## Install

```bash
npm install -D @canblmz1/dbsnap @playwright/test prisma tsx typescript
npm install @prisma/client
```

## Configure

Create `.env`:

```env
DATABASE_URL="file:./prisma/dev.db"
```

Create your database state:

```bash
npx prisma migrate dev
npm run db:seed
npx dbsnap save e2e-ready
```

## Run tests

```bash
npm test
```

`tests/global-setup.ts` restores `e2e-ready` before Playwright starts.

If you run Playwright in parallel, use one isolated database per worker or restore once before the run with `workers: 1`.
