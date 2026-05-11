import path from "node:path";
import { ConfigError } from "../utils/errors.js";
import { redactDatabaseUrl } from "../safety/redact-url.js";

export type DatabaseType = "postgres" | "sqlite";

export interface ParsedPostgresDatabaseUrl {
  type: "postgres";
  raw: string;
  redacted: string;
  protocol: "postgres" | "postgresql";
  host: string;
  port?: number;
  databaseName: string;
  username?: string;
  password?: string;
  searchParams: Record<string, string>;
}

export interface ParsedSqliteDatabaseUrl {
  type: "sqlite";
  raw: string;
  redacted: string;
  sqlitePath: string;
  isMemory: boolean;
}

export type ParsedDatabaseUrl = ParsedPostgresDatabaseUrl | ParsedSqliteDatabaseUrl;

const SECRET_SEARCH_PARAM_KEYS = new Set([
  "password",
  "pass",
  "pwd",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "secret",
  "client_secret",
  "auth"
]);

function stripLeadingSlashesForRelativeSqlite(input: string): string {
  if (input.startsWith("./") || input.startsWith("../")) return input;
  if (/^[A-Za-z]:[\\/]/.test(input)) return input;
  if (input.startsWith("//")) return input.slice(2);
  if (input.startsWith("/") && input[2] === ":" && /^[A-Za-z]$/.test(input[1])) {
    return input.slice(1);
  }
  return input;
}

export function parseDatabaseUrl(databaseUrl: string): ParsedDatabaseUrl {
  const trimmed = databaseUrl.trim();

  if (/^postgres(?:ql)?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const protocol = parsed.protocol.replace(":", "") as "postgres" | "postgresql";
      const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
      if (!databaseName) {
        throw new ConfigError("PostgreSQL DATABASE_URL must include a database name.", {
          code: "POSTGRES_DATABASE_NAME_MISSING"
        });
      }
      const searchParams: Record<string, string> = {};
      for (const [key, value] of parsed.searchParams.entries()) {
        searchParams[key] = value;
      }
      return {
        type: "postgres",
        raw: trimmed,
        redacted: redactDatabaseUrl(trimmed),
        protocol,
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : undefined,
        databaseName,
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        searchParams
      };
    } catch (error) {
      if (error instanceof ConfigError) throw error;
      throw new ConfigError(`Unsupported or invalid PostgreSQL DATABASE_URL: ${redactDatabaseUrl(trimmed)}`, {
        code: "INVALID_DATABASE_URL",
        cause: error
      });
    }
  }

  if (/^file:/i.test(trimmed)) {
    const sqlitePath = trimmed.slice("file:".length);
    return {
      type: "sqlite",
      raw: trimmed,
      redacted: redactDatabaseUrl(trimmed),
      sqlitePath: sqlitePath || ":memory:",
      isMemory: sqlitePath === ":memory:"
    };
  }

  if (/^sqlite:\/\//i.test(trimmed)) {
    const sqlitePath = stripLeadingSlashesForRelativeSqlite(trimmed.slice("sqlite://".length));
    return {
      type: "sqlite",
      raw: trimmed,
      redacted: redactDatabaseUrl(trimmed),
      sqlitePath: sqlitePath || ":memory:",
      isMemory: sqlitePath === ":memory:"
    };
  }

  if (/^sqlite:/i.test(trimmed)) {
    const sqlitePath = trimmed.slice("sqlite:".length);
    return {
      type: "sqlite",
      raw: trimmed,
      redacted: redactDatabaseUrl(trimmed),
      sqlitePath: sqlitePath || ":memory:",
      isMemory: sqlitePath === ":memory:"
    };
  }

  throw new ConfigError(
    "Unsupported DATABASE_URL. dbsnap currently supports postgres://, postgresql://, file:, sqlite:, and sqlite:// URLs.",
    {
      code: "UNSUPPORTED_DATABASE_URL",
      details: { databaseUrl: redactDatabaseUrl(trimmed) }
    }
  );
}

export function resolveSqlitePath(projectRoot: string, parsed: ParsedSqliteDatabaseUrl): string {
  if (parsed.isMemory) {
    throw new ConfigError("SQLite in-memory databases cannot be snapshotted.", {
      code: "SQLITE_MEMORY_UNSUPPORTED"
    });
  }
  const normalized = parsed.sqlitePath.replace(/^["']|["']$/g, "");
  return path.isAbsolute(normalized) ? path.resolve(normalized) : path.resolve(projectRoot, normalized);
}

export function sanitizeParsedDatabaseUrl(database: ParsedDatabaseUrl): ParsedDatabaseUrl {
  if (database.type === "sqlite") {
    return { ...database, raw: database.redacted };
  }

  const searchParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(database.searchParams)) {
    searchParams[key] = SECRET_SEARCH_PARAM_KEYS.has(key.toLowerCase()) ? "***" : value;
  }
  return {
    ...database,
    raw: database.redacted,
    username: undefined,
    password: undefined,
    searchParams
  };
}
