import { beforeEach } from "vitest";
import { restoreSnapshot } from "@canblmz1/dbsnap";

beforeEach(async () => {
  await restoreSnapshot("test-ready", { yes: true });
});
