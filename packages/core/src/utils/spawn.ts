import { spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { redactSecrets } from "../safety/redact-url.js";
import { DatabaseError } from "./errors.js";

export interface SpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: Readable;
  output?: Writable;
  timeoutMs?: number;
  verbose?: boolean;
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
    if (/[;&|`$<>]/.test(arg)) {
      throw new DatabaseError("Refusing to run a command with shell metacharacters in an argument.", {
        code: "UNSAFE_SPAWN_ARGUMENT",
        details: { arg: redactSecrets(arg) }
      });
    }
  }
}

export async function runSpawn(command: string, args: string[], options: SpawnOptions = {}): Promise<SpawnResult> {
  assertSafeArgs(args);

  return await new Promise<SpawnResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, options.timeoutMs)
      : undefined;

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });

    if (options.input) {
      options.input.pipe(child.stdin);
    } else {
      child.stdin.end();
    }

    if (options.output) {
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
      if (timer) clearTimeout(timer);
      resolve({
        command,
        args,
        stdout: redactSecrets(stdout),
        stderr: redactSecrets(stderr),
        exitCode: exitCode ?? 1,
        timedOut
      });
    });
  });
}

export async function requireSuccessfulSpawn(command: string, args: string[], options: SpawnOptions = {}): Promise<SpawnResult> {
  const result = await runSpawn(command, args, options);
  if (result.timedOut) {
    throw new DatabaseError(`${command} timed out after ${options.timeoutMs}ms.`, {
      code: "COMMAND_TIMEOUT",
      details: { command, args }
    });
  }
  if (result.exitCode !== 0) {
    throw new DatabaseError(`${command} failed: ${result.stderr || result.stdout || `exit code ${result.exitCode}`}`, {
      code: "COMMAND_FAILED",
      details: { command, args, exitCode: result.exitCode, stderr: result.stderr }
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
