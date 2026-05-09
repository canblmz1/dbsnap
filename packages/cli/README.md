# dbsnap

## Time travel for your local development database.

Save a working DB state, break everything, restore it quickly.

```bash
pnpm add -D dbsnap
pnpm dbsnap init --yes
pnpm dbsnap save dev-ready
pnpm dbsnap restore dev-ready
```

dbsnap supports local SQLite, local PostgreSQL, Docker-based PostgreSQL, Prisma, Drizzle, Vitest, and Playwright workflows.

## CLI

```bash
dbsnap init
dbsnap doctor
dbsnap save <name>
dbsnap restore [name]
dbsnap list
dbsnap delete <name>
dbsnap rename <old> <new>
dbsnap info <name>
```

Useful options:

```bash
--json
--yes
--dry-run
--debug
--verbose
--snapshots-dir <dir>
--docker
--no-docker
--force-i-know-what-i-am-doing
```

`restore` and `delete` require `--yes` when used with `--json`.

## Node API

```ts
import { saveSnapshot, restoreSnapshot, listSnapshots } from "dbsnap";

await saveSnapshot("checkout-ready");
await restoreSnapshot("checkout-ready", { yes: true });
console.log(await listSnapshots());
```

## Safety

dbsnap is not a production backup tool. Destructive restore refuses remote or production-looking databases by default, and debug output redacts secrets.

Full docs: https://github.com/dbsnap/dbsnap#readme
