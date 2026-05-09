import type { Command } from "commander";
import { listSnapshots, restoreSnapshot, UserError } from "@canblmz1/dbsnap-core";
import { createReporter } from "../ui/reporter.js";
import { confirm, selectSnapshot } from "../ui/prompts.js";
import { readCliOptions } from "./options.js";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore")
    .description("Restore a saved database snapshot")
    .argument("[name]", "Snapshot name")
    .action(async function (this: Command, name?: string) {
      const options = readCliOptions(this);
      const reporter = createReporter({ json: options.json });
      let snapshotName = name;
      if (!snapshotName) {
        const snapshots = await listSnapshots(options);
        snapshotName = await selectSnapshot("Select a snapshot to restore:", snapshots.snapshots.map((snapshot) => snapshot.name));
      }

      const dryRunResult = await restoreSnapshot(snapshotName, { ...options, dryRun: true });
      if (options.json && !options.yes && !options.dryRun) {
        throw new UserError("Refusing to restore in --json mode without --yes. Re-run with --yes or --dry-run.", {
          code: "CONFIRMATION_REQUIRED"
        });
      }
      if (!options.yes && !options.dryRun && !options.json) {
        reporter.info("Restore target:");
        reporter.table([
          {
            snapshot: snapshotName,
            type: dryRunResult.safety.databaseType,
            host: dryRunResult.safety.host ?? "",
            database: dryRunResult.safety.databaseNameOrPath
          }
        ]);
        const accepted = await confirm("Restore will replace the current local database state. Continue?");
        if (!accepted) {
          reporter.info("Restore cancelled.");
          return;
        }
      }

      const result = options.dryRun ? dryRunResult : await restoreSnapshot(snapshotName, options);
      if (options.json) {
        reporter.json(result);
        return;
      }
      reporter.success(result.message);
    });
}
