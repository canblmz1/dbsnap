import type { Command } from "commander";
import { listSnapshots } from "@canblmz1/dbsnap-core";
import { bytes, createReporter } from "../ui/reporter.js";
import { readCliOptions } from "./options.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List saved database snapshots")
    .action(async function (this: Command) {
      const options = readCliOptions(this);
      const reporter = createReporter({ json: options.json });
      const result = await listSnapshots(options);
      if (options.json) {
        reporter.json(result);
        return;
      }
      if (result.snapshots.length === 0) {
        reporter.info("No snapshots yet. Run `dbsnap save <name>` to create one.");
        return;
      }
      reporter.table(
        result.snapshots.map((snapshot) => ({
          name: snapshot.name,
          type: snapshot.metadata.databaseType,
          created: snapshot.metadata.createdAt,
          size: bytes(snapshot.metadata.sizeBytes),
          source: snapshot.metadata.source
        }))
      );
    });
}
