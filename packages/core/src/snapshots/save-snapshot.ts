import { savePostgresSnapshot } from "../adapters/postgres.js";
import { getSqliteDatabasePath, saveSqliteSnapshot } from "../adapters/sqlite.js";
import { sanitizeParsedDatabaseUrl } from "../config/parse-database-url.js";
import { loadDbsnapConfig } from "../config/load-config.js";
import { assertLocalDatabase } from "../safety/assert-local-database.js";
import { evaluateSafety } from "../safety/safety-check.js";
import type { DbsnapBaseOptions, SnapshotOperationResult } from "../types.js";
import { pathExists, safeRemoveDir } from "../utils/fs.js";
import { DatabaseError } from "../utils/errors.js";
import { normalizeForDisplay } from "../utils/paths.js";
import { createSnapshotDir } from "./snapshot-paths.js";
import { validateSnapshotName } from "./validate-snapshot-name.js";
import { writeMetadata } from "./metadata.js";

export async function saveSnapshot(name: string, options: DbsnapBaseOptions = {}): Promise<SnapshotOperationResult> {
  const snapshotName = validateSnapshotName(name);
  const config = await loadDbsnapConfig(options);
  const resolvedSqlitePath =
    config.database.type === "sqlite" ? getSqliteDatabasePath(config.projectRoot, config.database) : undefined;
  const safety = evaluateSafety(config.database, { resolvedSqlitePath });
  const snapshotDir = await createSnapshotDir(config.snapshotsDir, snapshotName, { dryRun: options.dryRun });

  if (options.dryRun && config.database.type === "sqlite" && resolvedSqlitePath && !(await pathExists(resolvedSqlitePath))) {
    throw new DatabaseError(
      `SQLite database file was not found at ${normalizeForDisplay(config.projectRoot, resolvedSqlitePath)}.`,
      { code: "SQLITE_DATABASE_MISSING" }
    );
  }

  if (options.dryRun) {
    return {
      name: snapshotName,
      snapshotDir,
      dryRun: true,
      database: sanitizeParsedDatabaseUrl(config.database),
      safety,
      message: `Would save snapshot "${snapshotName}".`
    };
  }

  try {
    const metadata =
      config.database.type === "sqlite"
        ? await saveSqliteSnapshot({
            projectRoot: config.projectRoot,
            database: config.database,
            snapshotName,
            snapshotDir,
            now: options.now
          })
        : await savePostgresSnapshot({
            database: config.database,
            snapshotName,
            snapshotDir,
            options: {
              timeoutMs: options.timeoutMs ?? config.config.timeoutMs,
              verbose: options.verbose,
              docker: options.docker ?? config.config.docker,
              noDocker: options.noDocker,
              now: options.now
            }
          });

    await writeMetadata(snapshotDir, metadata);
    return {
      name: snapshotName,
      snapshotDir,
      metadata,
      dryRun: false,
      database: sanitizeParsedDatabaseUrl(config.database),
      safety,
      message: `Saved snapshot "${snapshotName}".`
    };
  } catch (error) {
    await safeRemoveDir(config.snapshotsDir, snapshotDir).catch(() => undefined);
    throw error;
  }
}

export { assertLocalDatabase };
