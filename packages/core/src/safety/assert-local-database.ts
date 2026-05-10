import type { ParsedDatabaseUrl } from "../config/parse-database-url.js";
import { SafetyError } from "../utils/errors.js";
import { evaluateSafety, type SafetyCheckResult } from "./safety-check.js";

export interface AssertLocalDatabaseOptions {
  force?: boolean;
  operation?: "save" | "restore";
  snapshotName?: string;
  resolvedSqlitePath?: string;
  nodeEnv?: string;
}

export function assertLocalDatabase(database: ParsedDatabaseUrl, options: AssertLocalDatabaseOptions = {}): SafetyCheckResult {
  const result = evaluateSafety(database, { resolvedSqlitePath: options.resolvedSqlitePath, nodeEnv: options.nodeEnv });
  if (result.allowedByDefault || options.force) {
    return result;
  }

  const snapshot = options.snapshotName ? `\nSnapshot: ${options.snapshotName}` : "";
  const host = result.host ? `\nHost: ${result.host}` : "";
  throw new SafetyError(
    [
      `Refusing to ${options.operation ?? "operate on"} a database that does not look local.`,
      `Database type: ${result.databaseType}`,
      `Database name/path: ${result.databaseNameOrPath}`,
      host.trim(),
      snapshot.trim(),
      "",
      ...result.reasons,
      "",
      "Use --force-i-know-what-i-am-doing only if you are absolutely sure this is a disposable local database."
    ]
      .filter(Boolean)
      .join("\n"),
    {
      code: "REMOTE_OR_PRODUCTION_DATABASE_BLOCKED",
      details: { ...result }
    }
  );
}
