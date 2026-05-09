import { expect, test } from "@playwright/test";
import { restoreSnapshot } from "dbsnap";

test.beforeEach(async () => {
  await restoreSnapshot("checkout-ready", { yes: true });
});

test("checkout page starts ready", async ({ page }) => {
  await page.goto("http://localhost:3000/checkout");
  await expect(page.getByRole("heading", { name: /checkout/i })).toBeVisible();
});
