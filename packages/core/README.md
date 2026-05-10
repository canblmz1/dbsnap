# @canblmz1/dbsnap-core

Core checkpoint engine for [dbsnap](https://github.com/canblmz1/dbsnap), the local database checkpoint CLI for Prisma, Drizzle, Playwright and Vitest workflows.

Most users should install the CLI package instead:

```bash
npm install -D @canblmz1/dbsnap
npx dbsnap --help
```

This package contains the typed Node API used by the CLI. It does not prompt, does not print to the terminal, redacts secrets, and enforces local-development safety guards by default.

```ts
import { saveSnapshot, restoreSnapshot, verifySnapshot, pruneSnapshots } from "@canblmz1/dbsnap-core";

await saveSnapshot("checkout-ready");
await restoreSnapshot("checkout-ready", { yes: true });
await verifySnapshot("checkout-ready");
await pruneSnapshots({ keepLast: 5, dryRun: true });
```

dbsnap is for disposable local development and test databases. It is not a production backup tool. Do not commit snapshots, local database files, dumps, or `.env` files.
