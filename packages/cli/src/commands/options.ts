import type { Command } from "commander";
import type { DbsnapBaseOptions } from "@dbsnap/core";

export interface CliOptions extends DbsnapBaseOptions {
  json?: boolean;
}

export function readCliOptions(command: Command): CliOptions {
  const opts = command.optsWithGlobals<{
    json?: boolean;
    yes?: boolean;
    dryRun?: boolean;
    debug?: boolean;
    verbose?: boolean;
    snapshotsDir?: string;
    docker?: boolean;
    forceIKnowWhatIAmDoing?: boolean;
  }>();

  return {
    cwd: process.cwd(),
    snapshotsDir: opts.snapshotsDir,
    json: Boolean(opts.json),
    yes: Boolean(opts.yes),
    dryRun: Boolean(opts.dryRun),
    debug: Boolean(opts.debug),
    verbose: Boolean(opts.verbose),
    docker: opts.docker === true,
    noDocker: opts.docker === false,
    force: Boolean(opts.forceIKnowWhatIAmDoing)
  };
}
