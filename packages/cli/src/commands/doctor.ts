import type { Command } from "commander";
import { getDoctorReport } from "@canblmz1/dbsnap-core";
import { createReporter } from "../ui/reporter.js";
import { readCliOptions } from "./options.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check dbsnap configuration, safety, and local tooling")
    .action(async function (this: Command) {
      const options = readCliOptions(this);
      const reporter = createReporter({ json: options.json });
      const report = await getDoctorReport(options);
      if (options.json) {
        reporter.json(report);
        return;
      }

      reporter.info("dbsnap doctor");
      reporter.table([
        { check: "Project root", status: report.projectRoot },
        { check: "DATABASE_URL", status: report.databaseUrl.found ? "found" : "missing" },
        { check: "Redacted URL", status: report.databaseUrl.redacted ?? "" },
        { check: "Database type", status: report.database?.type ?? "unknown" },
        { check: "Prisma", status: report.project.prisma.detected ? "detected" : "not detected" },
        { check: "Drizzle", status: report.project.drizzle.detected ? "detected" : "not detected" },
        { check: "Snapshots dir", status: report.snapshotsDir },
        { check: "Safety", status: report.safety?.level ?? "unknown" },
        { check: "pg_dump", status: report.tools.pgDump?.available === undefined ? "n/a" : report.tools.pgDump.available ? "available" : "missing" },
        { check: "pg_restore", status: report.tools.pgRestore?.available === undefined ? "n/a" : report.tools.pgRestore.available ? "available" : "missing" },
        { check: "Docker", status: report.tools.docker.cliAvailable ? (report.tools.docker.daemonAvailable ? "available" : "daemon unavailable") : "missing" },
        { check: "Docker PostgreSQL", status: report.tools.postgresContainer ? `${report.tools.postgresContainer.name} (${report.tools.postgresContainer.id})` : "not detected" }
      ]);

      for (const env of report.env) {
        reporter.info(`${env.path}: ${env.exists ? "found" : "missing"}`);
      }
      for (const warning of report.warnings) {
        reporter.warn(warning);
      }
    });
}
