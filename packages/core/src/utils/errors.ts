import { redactSecrets } from "../safety/redact-url.js";

export type DbsnapErrorName =
  | "UserError"
  | "ConfigError"
  | "SafetyError"
  | "SnapshotError"
  | "DatabaseError"
  | "DockerError";

export interface DbsnapErrorOptions {
  code?: string;
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class UserError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly isExpected = true;

  constructor(message: string, options: DbsnapErrorOptions = {}) {
    super(message);
    this.name = "UserError";
    this.code = options.code ?? "USER_ERROR";
    this.details = options.details;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export class ConfigError extends UserError {
  constructor(message: string, options: DbsnapErrorOptions = {}) {
    super(message, { code: options.code ?? "CONFIG_ERROR", cause: options.cause, details: options.details });
    this.name = "ConfigError";
  }
}

export class SafetyError extends UserError {
  constructor(message: string, options: DbsnapErrorOptions = {}) {
    super(message, { code: options.code ?? "SAFETY_ERROR", cause: options.cause, details: options.details });
    this.name = "SafetyError";
  }
}

export class SnapshotError extends UserError {
  constructor(message: string, options: DbsnapErrorOptions = {}) {
    super(message, { code: options.code ?? "SNAPSHOT_ERROR", cause: options.cause, details: options.details });
    this.name = "SnapshotError";
  }
}

export class DatabaseError extends UserError {
  constructor(message: string, options: DbsnapErrorOptions = {}) {
    super(message, { code: options.code ?? "DATABASE_ERROR", cause: options.cause, details: options.details });
    this.name = "DatabaseError";
  }
}

export class DockerError extends UserError {
  constructor(message: string, options: DbsnapErrorOptions = {}) {
    super(message, { code: options.code ?? "DOCKER_ERROR", cause: options.cause, details: options.details });
    this.name = "DockerError";
  }
}

export function isDbsnapError(error: unknown): error is UserError {
  return error instanceof UserError;
}

export function formatError(error: unknown, debug = false): string {
  if (isDbsnapError(error)) {
    const base = `${error.name}: ${redactSecrets(error.message)}`;
    if (!debug) return base;
    const details = error.details ? `\nDetails: ${redactSecrets(JSON.stringify(error.details, null, 2))}` : "";
    const stack = error.stack ? `\n${redactSecrets(error.stack)}` : "";
    return `${base}${details}${stack}`;
  }

  if (error instanceof Error) {
    if (debug) {
      return redactSecrets(error.stack ?? error.message);
    }
    return `${redactSecrets(error.message)}\nRun with --debug for more detail.`;
  }

  return redactSecrets(String(error));
}
