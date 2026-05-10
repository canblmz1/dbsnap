import type { Command } from "commander";
import { saveSnapshot } from "@canblmz1/dbsnap-core";
import { bytes, createReporter } from "../ui/reporter.js";
import { readCliOptions } from "./options.js";

export function registerSaveCommand(program: Command): void {
  program
    .command("save")
    .description("Create a named checkpoint of the current local database")
    .argument("<name>", "Checkpoint name")
    .action(async function (this: Command, name: string) {
      const options = readCliOptions(this);
      const reporter = createReporter({ json: options.json });
      const result = await saveSnapshot(name, options);
      if (options.json) {
        reporter.json(result);
        return;
      }
      if (result.dryRun) {
        reporter.info(result.message);
        reporter.info(`Snapshot directory: ${result.snapshotDir}`);
        return;
      }
      reporter.success(`${result.message} ${result.metadata ? `(${bytes(result.metadata.sizeBytes)})` : ""}`.trim());
    });
}
