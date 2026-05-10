import path from "node:path";
import { restorePostgresSnapshot } from "../adapters/postgres.js";
import { POSTGRES_SNAPSHOT_FILE } from "../adapters/postgres.js";
import { getSqliteDatabasePath, restoreSqliteSnapshot, SQLITE_SNAPSHOT_FILE } from "../adapters/sqlite.js";
import { loadDbsnapConfig } from "../config/load-config.js";
import { sanitizeParsedDatabaseUrl } from "../config/parse-database-url.js";
import { assertLocalDatabase } from "../safety/assert-local-database.js";
import type { DbsnapBaseOptions, SnapshotOperationResult } from "../types.js";
import { SnapshotError } from "../utils/errors.js";
import { pathExists } from "../utils/fs.js";
import { readMetadata } from "./metadata.js";
import { findSnapshotDir } from "./snapshot-paths.js";
import { evaluateSnapshotTarget } from "./target-check.js";
import { validateSnapshotName } from "./validate-snapshot-name.js";

export async function restoreSnapshot(name: string, options: DbsnapBaseOptions = {}): Promise<SnapshotOperationResult> {
  const snapshotName = validateSnapshotName(name);
  const config = await loadDbsnapConfig(options);
  const snapshotDir = await findSnapshotDir(config.snapshotsDir, snapshotName);
  const metadata = await readMetadata(snapshotDir);
  if (metadata.databaseType !== config.database.type) {
    throw new SnapshotError(
      `Snapshot "${snapshotName}" is for ${metadata.databaseType}, but current DATABASE_URL is ${config.database.type}.`,
      { code: "SNAPSHOT_DATABASE_TYPE_MISMATCH" }
    );
  }

  const resolvedSqlitePath =
    config.database.type === "sqlite" ? getSqliteDatabasePath(config.projectRoot, config.database) : undefined;
  const safety = assertLocalDatabase(config.database, {
    force: options.force,
    operation: "restore",
    snapshotName,
    resolvedSqlitePath,
    nodeEnv: config.env.values.NODE_ENV
  });
  const target = evaluateSnapshotTarget(metadata, config.database, {
    projectRoot: config.projectRoot,
    resolvedSqlitePath
  });
  if (!target.matches && !options.allowDifferentTarget && !options.dryRun) {
    throw new SnapshotError(
      `Snapshot "${snapshotName}" was saved from a different database target. Re-run with allowDifferentTarget only if this is intentional.`,
      {
        code: "SNAPSHOT_TARGET_MISMATCH",
        details: { target }
      }
    );
  }

  const artifactName = metadata.databaseType === "sqlite" ? SQLITE_SNAPSHOT_FILE : POSTGRES_SNAPSHOT_FILE;
  if (!(await pathExists(path.join(snapshotDir, artifactName)))) {
    throw new SnapshotError(`Snapshot "${snapshotName}" is missing ${artifactName}.`, { code: "SNAPSHOT_FILE_MISSING" });
  }

  if (options.dryRun) {
    return {
      name: snapshotName,
      snapshotDir,
      metadata,
      dryRun: true,
      database: sanitizeParsedDatabaseUrl(config.database),
      safety,
      target,
      message: `Would restore snapshot "${snapshotName}".`
    };
  }

  if (config.database.type === "sqlite") {
    await restoreSqliteSnapshot({ projectRoot: config.projectRoot, database: config.database, snapshotDir });
  } else {
    await restorePostgresSnapshot({
      database: config.database,
      snapshotDir,
      options: {
        timeoutMs: options.timeoutMs ?? config.config.timeoutMs,
        verbose: options.verbose,
        docker: options.docker ?? config.config.docker,
        noDocker: options.noDocker
      }
    });
  }

  return {
    name: snapshotName,
    snapshotDir,
    metadata,
    dryRun: false,
    database: sanitizeParsedDatabaseUrl(config.database),
    safety,
    target,
    message: `Restored snapshot "${snapshotName}".`
  };
}
