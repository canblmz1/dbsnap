import { beforeEach, expect, test } from "vitest";
import { restoreSnapshot } from "@canblmz1/dbsnap";

beforeEach(async () => {
  await restoreSnapshot("test-ready", { yes: true });
});

test("starts from the same local database state", () => {
  expect(true).toBe(true);
});
