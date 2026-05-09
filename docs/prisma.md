# Prisma

dbsnap works well with Prisma because Prisma projects commonly keep local database URLs in `.env`.

```bash
pnpm prisma migrate dev
pnpm prisma db seed
dbsnap save seeded
```

Restore before repeating UI or integration tests:

```bash
dbsnap restore seeded --yes
```

`dbsnap init` detects `prisma/schema.prisma`.

## SQLite

```env
DATABASE_URL="file:./dev.db"
```

## PostgreSQL

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_dev"
```
