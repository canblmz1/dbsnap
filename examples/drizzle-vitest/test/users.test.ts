import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";

describe("users", () => {
  it("starts from the dbsnap checkpoint", () => {
    const db = new Database("dev.db", { readonly: true });
    const row = db.prepare("select email from users limit 1").get() as { email?: string } | undefined;
    db.close();

    expect(row?.email).toBe("demo@example.com");
  });
});
