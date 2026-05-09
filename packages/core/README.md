# @canblmz1/dbsnap-core

Core snapshot engine for [dbsnap](https://github.com/canblmz1/dbsnap).

Most users should install the CLI package instead:

```bash
npm install -D @canblmz1/dbsnap
npx dbsnap --help
```

This package contains the typed Node API used by the CLI. It does not prompt, does not print to the terminal, redacts secrets, and enforces restore safety guards by default.

```ts
import { saveSnapshot, restoreSnapshot, verifySnapshot } from "@canblmz1/dbsnap-core";

await saveSnapshot("checkout-ready");
await restoreSnapshot("checkout-ready", { yes: true });
await verifySnapshot("checkout-ready");
```

dbsnap is for disposable local development databases. It is not a production backup tool.
