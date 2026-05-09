import type { Command } from "commander";
import { renameSnapshot } from "@canblmz1/dbsnap-core";
import { createReporter } from "../ui/reporter.js";
import { readCliOptions } from "./options.js";

export function registerRenameCommand(program: Command): void {
  program
    .command("rename")
    .description("Rename a saved snapshot")
    .argument("<old>", "Current snapshot name")
    .argument("<new>", "New snapshot name")
    .action(async function (this: Command, oldName: string, newName: string) {
      const options = readCliOptions(this);
      const reporter = createReporter({ json: options.json });
      const result = await renameSnapshot(oldName, newName, options);
      if (options.json) {
        reporter.json(result);
        return;
      }
      reporter.success(
        result.dryRun
          ? `Would rename snapshot "${oldName}" to "${newName}".`
          : `Renamed snapshot "${oldName}" to "${newName}".`
      );
    });
}
