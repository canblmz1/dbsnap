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
        { check: "dbsnap version", status: report.version },
        { check: "Node", status: report.runtime.nodeVersion },
        { check: "Platform", status: `${report.runtime.platform} ${report.runtime.arch}` },
        { check: "Current directory", status: report.runtime.cwd },
        { check: "Project root", status: report.projectRoot },
        { check: "Config file", status: report.config.loaded ? report.config.path ?? "loaded" : "not found" },
        { check: "DATABASE_URL", status: report.databaseUrl.found ? "found" : "missing" },
        { check: "DATABASE_URL source", status: report.databaseUrl.source ?? "unknown" },
        { check: "Redacted URL", status: report.databaseUrl.redacted ?? "" },
        { check: "Database type", status: report.database?.type ?? "unknown" },
        { check: "Prisma", status: report.project.prisma.detected ? "detected" : "not detected" },
        { check: "Drizzle", status: report.project.drizzle.detected ? "detected" : "not detected" },
        { check: "Snapshots dir", status: report.snapshotsDir },
        { check: "Snapshots dir exists", status: report.snapshotsDirStatus.exists ? "yes" : "no" },
        { check: "Snapshots dir writable", status: report.snapshotsDirStatus.writable ? "yes" : "no" },
        { check: "Snapshot count", status: report.snapshotsDirStatus.snapshotCount },
        { check: "Safety", status: report.safety?.level ?? "unknown" },
        { check: "Restore needs force", status: report.restoreRequiresForce === undefined ? "unknown" : report.restoreRequiresForce ? "yes" : "no" },
        { check: "pg_dump", status: toolStatus(report.tools.pgDump) },
        { check: "pg_restore", status: toolStatus(report.tools.pgRestore) },
        { check: "Docker", status: report.tools.docker.cliAvailable ? (report.tools.docker.daemonAvailable ? "available" : "daemon unavailable") : "missing" },
        { check: "Docker fallback", status: report.tools.dockerFallbackAvailable ? "available" : "not available" },
        { check: "Docker PostgreSQL", status: report.tools.postgresContainer ? `${report.tools.postgresContainer.name} (${report.tools.postgresContainer.id})` : "not detected" }
      ]);

      if (report.sqlite) {
        reporter.table([
          { check: "SQLite file", status: report.sqlite.path },
          { check: "SQLite file exists", status: report.sqlite.exists ? "yes" : "no" },
          { check: "SQLite parent writable", status: report.sqlite.parentWritable ? "yes" : "no" },
          { check: "SQLite WAL", status: report.sqlite.walExists ? "present" : "not present" },
          { check: "SQLite SHM", status: report.sqlite.shmExists ? "present" : "not present" }
        ]);
        reporter.info(report.sqlite.note);
      }

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
