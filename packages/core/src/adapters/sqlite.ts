import path from "node:path";
import type { ParsedSqliteDatabaseUrl } from "../config/parse-database-url.js";
import { resolveSqlitePath } from "../config/parse-database-url.js";
import type { SnapshotMetadata } from "../types.js";
import { copyFileWithDirs, fileSize, pathExists, removeFileIfExists } from "../utils/fs.js";
import { DatabaseError, SnapshotError } from "../utils/errors.js";
import { normalizeForDisplay } from "../utils/paths.js";
import { DBSNAP_VERSION, hashSource } from "../snapshots/metadata.js";
import { nowIso } from "../utils/time.js";

export const SQLITE_SNAPSHOT_FILE = "database.sqlite";
export const SQLITE_WAL_SNAPSHOT_FILE = "database.sqlite-wal";
export const SQLITE_SHM_SNAPSHOT_FILE = "database.sqlite-shm";

export interface SqliteSaveInput {
  projectRoot: string;
  database: ParsedSqliteDatabaseUrl;
  snapshotName: string;
  snapshotDir: string;
  now?: () => Date;
}

export interface SqliteRestoreInput {
  projectRoot: string;
  database: ParsedSqliteDatabaseUrl;
  snapshotDir: string;
}

export function getSqliteDatabasePath(projectRoot: string, database: ParsedSqliteDatabaseUrl): string {
  return resolveSqlitePath(projectRoot, database);
}

function sqliteSidecars(databasePath: string): Array<{ source: string; snapshotName: string }> {
  return [
    { source: `${databasePath}-wal`, snapshotName: SQLITE_WAL_SNAPSHOT_FILE },
    { source: `${databasePath}-shm`, snapshotName: SQLITE_SHM_SNAPSHOT_FILE }
  ];
}

export async function saveSqliteSnapshot(input: SqliteSaveInput): Promise<SnapshotMetadata> {
  const databasePath = getSqliteDatabasePath(input.projectRoot, input.database);
  if (!(await pathExists(databasePath))) {
    throw new DatabaseError(`SQLite database file was not found at ${normalizeForDisplay(input.projectRoot, databasePath)}.`, {
      code: "SQLITE_DATABASE_MISSING"
    });
  }

  const destination = path.join(input.snapshotDir, SQLITE_SNAPSHOT_FILE);
  await copyFileWithDirs(databasePath, destination);
  let sizeBytes = await fileSize(destination);
  for (const sidecar of sqliteSidecars(databasePath)) {
    if (await pathExists(sidecar.source)) {
      const sidecarDestination = path.join(input.snapshotDir, sidecar.snapshotName);
      await copyFileWithDirs(sidecar.source, sidecarDestination);
      sizeBytes += await fileSize(sidecarDestination);
    }
  }
  const source = normalizeForDisplay(input.projectRoot, databasePath);

  return {
    name: input.snapshotName,
    databaseType: "sqlite",
    createdAt: nowIso(input.now),
    sizeBytes,
    source,
    sourceId: hashSource(path.resolve(databasePath)),
    dbsnapVersion: DBSNAP_VERSION
  };
}

export async function restoreSqliteSnapshot(input: SqliteRestoreInput): Promise<void> {
  const source = path.join(input.snapshotDir, SQLITE_SNAPSHOT_FILE);
  if (!(await pathExists(source))) {
    throw new SnapshotError("Snapshot is missing database.sqlite.", { code: "SNAPSHOT_FILE_MISSING" });
  }
  const databasePath = getSqliteDatabasePath(input.projectRoot, input.database);
  await copyFileWithDirs(source, databasePath);
  for (const sidecar of sqliteSidecars(databasePath)) {
    const sidecarSource = path.join(input.snapshotDir, sidecar.snapshotName);
    if (await pathExists(sidecarSource)) {
      await copyFileWithDirs(sidecarSource, sidecar.source);
    } else {
      await removeFileIfExists(sidecar.source);
    }
  }
}
