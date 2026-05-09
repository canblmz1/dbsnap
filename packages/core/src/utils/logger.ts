import { redactSecrets } from "../safety/redact-url.js";

export interface DebugLogger {
  debug(message: string, details?: unknown): void;
}

export function createMemoryLogger(enabled = false): { logger: DebugLogger; messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    logger: {
      debug(message, details) {
        if (!enabled) return;
        const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
        messages.push(redactSecrets(`${message}${suffix}`));
      }
    }
  };
}
