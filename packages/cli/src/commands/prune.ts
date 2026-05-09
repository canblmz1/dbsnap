import type { Command } from "commander";
import { pruneSnapshots } from "@canblmz1/dbsnap-core";
import { bytes, createReporter } from "../ui/reporter.js";
import { readCliOptions } from "./options.js";

export function registerPruneCommand(program: Command): void {
  program
    .command("prune")
    .description("Delete old snapshots by retention policy")
    .option("--keep-last <count>", "Keep the newest N snapshots", parseNonNegativeInteger)
    .option("--older-than <duration>", "Delete snapshots older than a duration such as 7d, 12h, or 30m")
    .action(async function (this: Command) {
      const options = readCliOptions(this);
      const commandOptions = this.opts<{ keepLast?: number; olderThan?: string }>();
      const reporter = createReporter({ json: options.json });
      const result = await pruneSnapshots({
        ...options,
        keepLast: commandOptions.keepLast,
        olderThan: commandOptions.olderThan
      });

      if (options.json) {
        reporter.json(result);
        return;
      }

      if (result.pruned.length === 0) {
        reporter.info("No snapshots matched the prune criteria.");
        return;
      }

      reporter.table(
        result.pruned.map((snapshot) => ({
          name: snapshot.name,
          created: snapshot.createdAt,
          size: bytes(snapshot.sizeBytes)
        }))
      );
      reporter.success(
        result.dryRun
          ? `Would delete ${result.pruned.length} snapshot${result.pruned.length === 1 ? "" : "s"}.`
          : `Deleted ${result.pruned.length} snapshot${result.pruned.length === 1 ? "" : "s"}.`
      );
    });
}

function parseNonNegativeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("--keep-last must be a non-negative integer.");
  }
  return parsed;
}
