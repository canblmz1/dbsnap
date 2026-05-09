#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { DBSNAP_VERSION, formatError } from "@canblmz1/dbsnap-core";
import { registerDeleteCommand } from "./commands/delete.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerInfoCommand } from "./commands/info.js";
import { registerInitCommand } from "./commands/init.js";
import { registerListCommand } from "./commands/list.js";
import { registerRenameCommand } from "./commands/rename.js";
import { registerRestoreCommand } from "./commands/restore.js";
import { registerSaveCommand } from "./commands/save.js";
import { registerVerifyCommand } from "./commands/verify.js";

export function createProgram(): Command {
  const program = new Command();
  program
    .name("dbsnap")
    .description("Time travel for your local development database.")
    .version(DBSNAP_VERSION)
    .option("--json", "Print JSON output where supported")
    .option("--yes", "Skip confirmation prompts")
    .option("--dry-run", "Show what would happen without changing files or databases")
    .option("--debug", "Print additional debug information with secrets redacted")
    .option("--verbose", "Print more command output")
    .option("--snapshots-dir <dir>", "Snapshots directory")
    .option("--docker", "Use PostgreSQL client tools inside a matching Docker container")
    .option("--no-docker", "Do not fall back to Docker for PostgreSQL client tools")
    .option("--force-i-know-what-i-am-doing", "Allow restore to a database dbsnap considers risky")
    .option("--allow-different-target", "Allow restore when the snapshot was saved from a different database target");

  registerInitCommand(program);
  registerDoctorCommand(program);
  registerSaveCommand(program);
  registerRestoreCommand(program);
  registerListCommand(program);
  registerDeleteCommand(program);
  registerRenameCommand(program);
  registerInfoCommand(program);
  registerVerifyCommand(program);

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();
  try {
    await program.parseAsync(argv);
  } catch (error) {
    const debug = Boolean(program.opts<{ debug?: boolean }>().debug);
    process.stderr.write(`Error ${formatError(error, debug)}\n`);
    process.exitCode = 1;
  }
}

function realpathIfPossible(targetPath: string): string {
  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

export function isDirectCliInvocation(metaUrl = import.meta.url, argvEntry = process.argv[1]): boolean {
  if (!argvEntry) return false;
  const modulePath = realpathIfPossible(fileURLToPath(metaUrl));
  const entryPath = realpathIfPossible(path.resolve(argvEntry));
  return modulePath === entryPath;
}

if (isDirectCliInvocation()) {
  void main();
}
