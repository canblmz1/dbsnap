# Drizzle

dbsnap detects Drizzle projects by looking for `drizzle.config.ts`, `drizzle.config.js`, `drizzle.config.mjs`, or `drizzle.config.cjs`.

Typical flow:

```bash
pnpm drizzle-kit push
pnpm tsx seed.ts
dbsnap save drizzle-ready
```

Restore:

```bash
dbsnap restore drizzle-ready --yes
```

Keep `DATABASE_URL` in `.env`, `.env.local`, or `dbsnap.config.ts`.
