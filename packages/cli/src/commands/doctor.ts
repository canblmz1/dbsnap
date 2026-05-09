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
        { check: "DATABASE_URL source", status: report.databaseUrl.source ?? "unknown" },
        { check: "Redacted URL", status: report.databaseUrl.redacted ?? "" },
        { check: "Database type", status: report.database?.type ?? "unknown" },
        { check: "Prisma", status: report.project.prisma.detected ? "detected" : "not detected" },
        { check: "Drizzle", status: report.project.drizzle.detected ? "detected" : "not detected" },
        { check: "Snapshots dir", status: report.snapshotsDir },
        { check: "Safety", status: report.safety?.level ?? "unknown" },
        { check: "pg_dump", status: toolStatus(report.tools.pgDump) },
        { check: "pg_restore", status: toolStatus(report.tools.pgRestore) },
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

function toolStatus(tool: { available: boolean; version?: string } | undefined): string {
  if (!tool) return "n/a";
  if (!tool.available) return "missing";
  return tool.version ? `available (${tool.version})` : "available";
}
