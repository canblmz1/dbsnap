import type { Command } from "commander";
import { getSnapshotInfo } from "@canblmz1/dbsnap-core";
import { bytes, createReporter } from "../ui/reporter.js";
import { readCliOptions } from "./options.js";

export function registerInfoCommand(program: Command): void {
  program
    .command("info")
    .description("Show metadata and artifact details for one checkpoint")
    .argument("<name>", "Checkpoint name")
    .action(async function (this: Command, name: string) {
      const options = readCliOptions(this);
      const reporter = createReporter({ json: options.json });
      const info = await getSnapshotInfo(name, options);
      if (options.json) {
        reporter.json(info);
        return;
      }
      reporter.table([
        {
          name: info.name,
          type: info.metadata.databaseType,
          created: info.metadata.createdAt,
          size: bytes(info.metadata.sizeBytes),
          source: info.metadata.source,
          version: info.metadata.dbsnapVersion
        }
      ]);
    });
}
