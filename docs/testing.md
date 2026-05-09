# Testing

dbsnap is useful when a test suite needs the same expensive local database state repeatedly.

## Vitest

```ts
import { beforeEach } from "vitest";
import { restoreSnapshot } from "@canblmz1/dbsnap";

beforeEach(async () => {
  await restoreSnapshot("test-ready", { yes: true });
});
```

## Playwright

```ts
import { test } from "@playwright/test";
import { restoreSnapshot } from "@canblmz1/dbsnap";

test.beforeEach(async () => {
  await restoreSnapshot("checkout-ready", { yes: true });
});
```

## CI Note

dbsnap is designed for local development. It can run in CI for local disposable services, but it is not a replacement for production backup verification.
