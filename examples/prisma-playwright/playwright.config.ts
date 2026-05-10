import { defineConfig } from "@playwright/test";

export default defineConfig({
  globalSetup: "./tests/global-setup.ts",
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
  },
});
