import path from "node:path";
import { POSTGRES_SNAPSHOT_FILE } from "../adapters/postgres.js";
import { SQLITE_SHM_SNAPSHOT_FILE, SQLITE_SNAPSHOT_FILE, SQLITE_WAL_SNAPSHOT_FILE } from "../adapters/sqlite.js";
import { loadDbsnapConfig } from "../config/load-config.js";
import type { DbsnapBaseOptions, SnapshotMetadata, VerifyCheck, VerifySnapshotResult } from "../types.js";
import { fileSize, pathExists } from "../utils/fs.js";
import { readMetadata } from "./metadata.js";
import { findSnapshotDir } from "./snapshot-paths.js";
import { resolveSnapshotStore } from "./snapshot-store.js";

export async function verifySnapshot(name: string, options: DbsnapBaseOptions = {}): Promise<VerifySnapshotResult> {
  const store = await resolveSnapshotStore(options);
  const snapshotDir = await findSnapshotDir(store.snapshotsDir, name);
  const checks: VerifyCheck[] = [];
  let metadata: SnapshotMetadata | undefined;

  try {
    metadata = await readMetadata(snapshotDir);
    checks.push({ name: "metadata", status: "pass", message: "metadata.json is readable." });
  } catch (error) {
    checks.push({
      name: "metadata",
      status: "fail",
      message: error instanceof Error ? error.message : "metadata.json could not be read."
    });
    return { name, snapshotDir, ok: false, checks };
  }

  if (metadata.databaseType === "sqlite") {
    await verifyArtifact(snapshotDir, SQLITE_SNAPSHOT_FILE, true, checks);
    await verifyArtifact(snapshotDir, SQLITE_WAL_SNAPSHOT_FILE, false, checks);
    await verifyArtifact(snapshotDir, SQLITE_SHM_SNAPSHOT_FILE, false, checks);
  } else {
    await verifyArtifact(snapshotDir, POSTGRES_SNAPSHOT_FILE, true, checks);
  }

  await verifySize(snapshotDir, metadata, checks);
  await verifyDatabaseTypeCompatibility(metadata, options, checks);

  return {
    name: metadata.name,
    snapshotDir,
    metadata,
    ok: checks.every((check) => check.status !== "fail"),
    checks
  };
}

async function verifyArtifact(
  snapshotDir: string,
  filename: string,
  required: boolean,
  checks: VerifyCheck[]
): Promise<void> {
  const artifactPath = path.join(snapshotDir, filename);
  if (await pathExists(artifactPath)) {
    checks.push({ name: `artifact:${filename}`, status: "pass", message: `${filename} exists.` });
    return;
  }
  checks.push({
    name: `artifact:${filename}`,
    status: required ? "fail" : "skip",
    message: required ? `${filename} is missing.` : `${filename} is not present for this snapshot.`
  });
}

async function verifySize(snapshotDir: string, metadata: SnapshotMetadata, checks: VerifyCheck[]): Promise<void> {
  const files =
    metadata.databaseType === "sqlite"
      ? [SQLITE_SNAPSHOT_FILE, SQLITE_WAL_SNAPSHOT_FILE, SQLITE_SHM_SNAPSHOT_FILE]
      : [POSTGRES_SNAPSHOT_FILE];
  let actualSize = 0;
  for (const file of files) {
    const artifactPath = path.join(snapshotDir, file);
    if (await pathExists(artifactPath)) actualSize += await fileSize(artifactPath);
  }
  if (actualSize === metadata.sizeBytes) {
    checks.push({ name: "size", status: "pass", message: `Artifact size matches metadata (${actualSize} bytes).` });
  } else {
    checks.push({
      name: "size",
      status: "fail",
      message: `Artifact size is ${actualSize} bytes, but metadata says ${metadata.sizeBytes} bytes.`
    });
  }
  if (metadata.sourceHash || metadata.sourceId) {
    checks.push({ name: "source-identity", status: "pass", message: "Snapshot source identity is present." });
  } else {
    checks.push({ name: "source-identity", status: "warning", message: "Snapshot source identity is missing." });
  }
}

async function verifyDatabaseTypeCompatibility(
  metadata: SnapshotMetadata,
  options: DbsnapBaseOptions,
  checks: VerifyCheck[]
): Promise<void> {
  try {
    const config = await loadDbsnapConfig(options);
    checks.push({
      name: "database-type",
      status: config.database.type === metadata.databaseType ? "pass" : "fail",
      message:
        config.database.type === metadata.databaseType
          ? `Current DATABASE_URL type matches snapshot (${metadata.databaseType}).`
          : `Snapshot is for ${metadata.databaseType}, but current DATABASE_URL is ${config.database.type}.`
    });
  } catch {
    checks.push({
      name: "database-type",
      status: "skip",
      message: "DATABASE_URL is not available; skipped current database type compatibility check."
    });
  }
}
