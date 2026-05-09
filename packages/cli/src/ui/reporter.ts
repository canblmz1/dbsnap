import pc from "picocolors";
import { formatBytes } from "@dbsnap/core";
import { redactSecrets, formatError } from "@dbsnap/core";

const SECRET_KEYS = new Set([
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

export interface Reporter {
  json(value: unknown): void;
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(error: unknown, debug?: boolean): void;
  table(rows: Array<Record<string, string | number | undefined>>): void;
}

export function createReporter(options: { json?: boolean } = {}): Reporter {
  return {
    json(value) {
      process.stdout.write(`${redactSecrets(JSON.stringify(sanitizeForOutput(value), null, 2))}\n`);
    },
    info(message) {
      if (!options.json) process.stdout.write(`${redactSecrets(message)}\n`);
    },
    success(message) {
      if (!options.json) process.stdout.write(`${pc.green("Success")} ${redactSecrets(message)}\n`);
    },
    warn(message) {
      if (!options.json) process.stderr.write(`${pc.yellow("Warning")} ${redactSecrets(message)}\n`);
    },
    error(error, debug) {
      process.stderr.write(`${pc.red("Error")} ${formatError(error, debug)}\n`);
    },
    table(rows) {
      if (options.json) {
        this.json(rows);
        return;
      }
      if (rows.length === 0) return;
      const headers = Object.keys(rows[0]);
      const widths = headers.map((header) =>
        Math.max(header.length, ...rows.map((row) => String(row[header] ?? "").length))
      );
      const line = (values: string[]) => values.map((value, index) => value.padEnd(widths[index])).join("  ");
      process.stdout.write(`${redactSecrets(line(headers))}\n`);
      process.stdout.write(`${redactSecrets(line(widths.map((width) => "-".repeat(width))))}\n`);
      for (const row of rows) {
        process.stdout.write(`${redactSecrets(line(headers.map((header) => String(row[header] ?? ""))))}\n`);
      }
    }
  };
}

export function bytes(bytes: number): string {
  return formatBytes(bytes);
}

function sanitizeForOutput(value: unknown, key?: string): unknown {
  if (key && SECRET_KEYS.has(key.toLowerCase())) return "***";
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeForOutput(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeForOutput(entryValue, entryKey)
      ])
    );
  }
  return value;
}
