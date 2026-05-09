import type { Command } from "commander";
import { verifySnapshot } from "@canblmz1/dbsnap-core";
import { createReporter } from "../ui/reporter.js";
import { readCliOptions } from "./options.js";

export function registerVerifyCommand(program: Command): void {
  program
    .command("verify")
    .description("Verify snapshot metadata and artifacts")
    .argument("<name>", "Snapshot name")
    .action(async function (this: Command, name: string) {
      const options = readCliOptions(this);
      const reporter = createReporter({ json: options.json });
      const result = await verifySnapshot(name, options);
      if (options.json) {
        reporter.json(result);
        if (!result.ok) process.exitCode = 1;
        return;
      }

      reporter.table(
        result.checks.map((check) => ({
          check: check.name,
          status: check.status,
          message: check.message
        }))
      );
      if (result.ok) reporter.success(`Snapshot "${result.name}" verified.`);
      else {
        reporter.warn(`Snapshot "${result.name}" failed verification.`);
        process.exitCode = 1;
      }
    });
}
