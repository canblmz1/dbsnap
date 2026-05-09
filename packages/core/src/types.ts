import type { ParsedDatabaseUrl, DatabaseType } from "./config/parse-database-url.js";
import type { SafetyCheckResult } from "./safety/safety-check.js";

export interface DbsnapBaseOptions {
  cwd?: string;
  projectRoot?: string;
  databaseUrl?: string;
  snapshotsDir?: string;
  debug?: boolean;
  verbose?: boolean;
  timeoutMs?: number;
  docker?: boolean;
  noDocker?: boolean;
  force?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  processEnv?: NodeJS.ProcessEnv;
  now?: () => Date;
}

export interface SnapshotMetadata {
  name: string;
  databaseType: DatabaseType;
  createdAt: string;
  sizeBytes: number;
  source: string;
  sourceHash?: string;
  sourceId?: string;
  dbsnapVersion: string;
}

export interface SnapshotInfo {
  name: string;
  path: string;
  metadata: SnapshotMetadata;
}

export interface SnapshotOperationResult {
  name: string;
  snapshotDir: string;
  metadata?: SnapshotMetadata;
  dryRun: boolean;
  database: ParsedDatabaseUrl;
  safety: SafetyCheckResult;
  message: string;
}

export interface ListSnapshotsResult {
  snapshotsDir: string;
  snapshots: SnapshotInfo[];
}

export interface DeleteSnapshotResult {
  name: string;
  snapshotDir: string;
  dryRun: boolean;
}

export interface RenameSnapshotResult {
  oldName: string;
  newName: string;
  oldSnapshotDir: string;
  newSnapshotDir: string;
  dryRun: boolean;
  metadata?: SnapshotMetadata;
}
