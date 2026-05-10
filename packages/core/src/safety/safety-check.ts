import path from "node:path";
import type { ParsedDatabaseUrl } from "../config/parse-database-url.js";
import { redactDatabaseUrl } from "./redact-url.js";

export type SafetyLevel = "safe" | "warning" | "blocked";

export interface SafetyCheckResult {
  level: SafetyLevel;
  allowedByDefault: boolean;
  databaseType: ParsedDatabaseUrl["type"];
  host?: string;
  databaseNameOrPath: string;
  redactedUrl: string;
  reasons: string[];
  warnings: string[];
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const RISKY_HOST_PATTERNS = [
  /rds\.amazonaws\.com$/i,
  /supabase\.co$/i,
  /neon\.tech$/i,
  /planetscale/i,
  /railway\.app$/i,
  /render\.com$/i,
  /fly\.dev$/i
];
const RISKY_NAME_PATTERN = /(^|[_\-.\/\\])(prod|production|staging|live)([_\-.\/\\]|$)/i;

export function evaluateSafety(database: ParsedDatabaseUrl, options: { resolvedSqlitePath?: string; nodeEnv?: string } = {}): SafetyCheckResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (options.nodeEnv?.toLowerCase() === "production") {
    reasons.push("NODE_ENV=production is set.");
  }

  if (database.type === "sqlite") {
    const databaseNameOrPath = options.resolvedSqlitePath ?? database.sqlitePath;
    if (RISKY_NAME_PATTERN.test(path.basename(databaseNameOrPath)) || RISKY_NAME_PATTERN.test(databaseNameOrPath)) {
      reasons.push("The SQLite database path looks production-like.");
    }
    return {
      level: reasons.length ? "blocked" : "safe",
      allowedByDefault: reasons.length === 0,
      databaseType: "sqlite",
      databaseNameOrPath,
      redactedUrl: redactDatabaseUrl(database.raw),
      reasons,
      warnings
    };
  }

  const host = database.host;
  const databaseNameOrPath = database.databaseName;

  if (!LOCAL_HOSTS.has(host)) {
    reasons.push(`Host "${host}" is not a local database host.`);
  }
  if (RISKY_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    reasons.push(`Host "${host}" looks like a hosted database provider.`);
  }
  if (RISKY_NAME_PATTERN.test(databaseNameOrPath)) {
    reasons.push(`Database name "${databaseNameOrPath}" looks production-like.`);
  }

  if (database.port === undefined && LOCAL_HOSTS.has(host)) {
    warnings.push("PostgreSQL port was not specified; dbsnap will use PostgreSQL client defaults.");
  }

  return {
    level: reasons.length ? "blocked" : warnings.length ? "warning" : "safe",
    allowedByDefault: reasons.length === 0,
    databaseType: "postgres",
    host,
    databaseNameOrPath,
    redactedUrl: redactDatabaseUrl(database.raw),
    reasons,
    warnings
  };
}
