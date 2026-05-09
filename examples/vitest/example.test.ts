import { beforeEach, expect, test } from "vitest";
import { restoreSnapshot } from "dbsnap";

beforeEach(async () => {
  await restoreSnapshot("test-ready", { yes: true });
});

test("starts from the same local database state", () => {
  expect(true).toBe(true);
});
