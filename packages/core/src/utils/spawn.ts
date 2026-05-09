import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { redactSecrets } from "../safety/redact-url.js";
import { DatabaseError } from "./errors.js";

const DEFAULT_ALLOWED_COMMANDS = new Set(["docker", "pg_dump", "pg_restore"]);

export interface SpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: Readable;
  output?: Writable;
  timeoutMs?: number;
  verbose?: boolean;
  allowedCommands?: string[];
}

export interface SpawnResult {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export function assertSafeArgs(args: string[]): void {
  for (const arg of args) {
    if (arg.includes("\0")) {
      throw new DatabaseError("Refusing to run a command with a NUL byte in an argument.", {
        code: "UNSAFE_SPAWN_ARGUMENT",
        details: { arg: redactSecrets(arg) }
      });
    }
  }
}

export function assertAllowedCommand(command: string, allowedCommands: Iterable<string> = DEFAULT_ALLOWED_COMMANDS): void {
  const allowed = new Set(Array.from(allowedCommands, (name) => normalizeCommandName(name)));
  const commandName = normalizeCommandName(command);
  if (!allowed.has(commandName)) {
    throw new DatabaseError(`Refusing to run unsupported command "${commandName}".`, {
      code: "UNSAFE_SPAWN_COMMAND",
      details: { command: redactSecrets(command) }
    });
  }
}

function normalizeCommandName(command: string): string {
  const basename = path.basename(command).toLowerCase();
  return basename.replace(/\.(exe|cmd|bat)$/i, "");
}

function redactArgs(args: string[]): string[] {
  return args.map((arg) => redactSecrets(arg));
}

export async function runSpawn(command: string, args: string[], options: SpawnOptions = {}): Promise<SpawnResult> {
  assertAllowedCommand(command, options.allowedCommands);
  assertSafeArgs(args);

  return await new Promise<SpawnResult>((resolve, reject) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let outputFinished: Promise<void> = Promise.resolve();
    let child!: ChildProcessWithoutNullStreams;
    let timer: NodeJS.Timeout | undefined;

    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
    };

    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      child.kill("SIGTERM");
      reject(error);
    };

    child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true
    });

    timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, options.timeoutMs)
      : undefined;

    child.on("error", (error) => {
      fail(error);
    });

    if (options.input) {
      options.input.on("error", fail);
      options.input.pipe(child.stdin);
    } else {
      child.stdin.end();
    }

    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") fail(error);
    });

    if (options.output) {
      outputFinished = new Promise<void>((finishResolve) => {
        options.output?.once("finish", finishResolve);
        options.output?.once("error", (error) => {
          fail(error);
          finishResolve();
        });
      });
      child.stdout.pipe(options.output);
      child.stdout.on("data", (chunk: Buffer) => {
        if (options.verbose) stdout += chunk.toString();
      });
    } else {
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
    }

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (exitCode) => {
      void (async () => {
        try {
          await outputFinished;
          if (settled) return;
          settled = true;
          cleanup();
          resolve({
            command,
            args: redactArgs(args),
            stdout: redactSecrets(stdout),
            stderr: redactSecrets(stderr),
            exitCode: exitCode ?? 1,
            timedOut
          });
        } catch (error) {
          fail(error);
        }
      })();
    });
  });
}

export async function requireSuccessfulSpawn(command: string, args: string[], options: SpawnOptions = {}): Promise<SpawnResult> {
  const result = await runSpawn(command, args, options);
  if (result.timedOut) {
    throw new DatabaseError(`${command} timed out after ${options.timeoutMs}ms.`, {
      code: "COMMAND_TIMEOUT",
      details: { command, args: redactArgs(args) }
    });
  }
  if (result.exitCode !== 0) {
    throw new DatabaseError(`${command} failed: ${result.stderr || result.stdout || `exit code ${result.exitCode}`}`, {
      code: "COMMAND_FAILED",
      details: { command, args: redactArgs(args), exitCode: result.exitCode, stderr: result.stderr }
    });
  }
  return result;
}

export async function commandExists(command: string, args = ["--version"], timeoutMs = 5000): Promise<boolean> {
  try {
    const result = await runSpawn(command, args, { timeoutMs });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
