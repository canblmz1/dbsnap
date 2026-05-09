import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@canblmz1/dbsnap-core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 20000
  }
});
