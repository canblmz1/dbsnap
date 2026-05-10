import type { Command } from "commander";
import { deleteSnapshot, UserError } from "@canblmz1/dbsnap-core";
import { createReporter } from "../ui/reporter.js";
import { confirm } from "../ui/prompts.js";
import { readCliOptions } from "./options.js";

export function registerDeleteCommand(program: Command): void {
  program
    .command("delete")
    .description("Delete a saved checkpoint")
    .argument("<name>", "Checkpoint name")
    .action(async function (this: Command, name: string) {
      const options = readCliOptions(this);
      const reporter = createReporter({ json: options.json });
      if (options.json && !options.yes && !options.dryRun) {
        throw new UserError("Refusing to delete in --json mode without --yes. Re-run with --yes or --dry-run.", {
          code: "CONFIRMATION_REQUIRED"
        });
      }
      if (!options.yes && !options.dryRun && !options.json) {
        const accepted = await confirm(`Delete snapshot "${name}"?`);
        if (!accepted) {
          reporter.info("Delete cancelled.");
          return;
        }
      }
      const result = await deleteSnapshot(name, options);
      if (options.json) {
        reporter.json(result);
        return;
      }
      reporter.success(result.dryRun ? `Would delete snapshot "${name}".` : `Deleted snapshot "${name}".`);
    });
}
