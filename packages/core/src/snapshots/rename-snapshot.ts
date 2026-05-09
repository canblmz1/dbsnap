import fs from "node:fs/promises";
import type { DbsnapBaseOptions, RenameSnapshotResult } from "../types.js";
import { pathExists } from "../utils/fs.js";
import { SnapshotError } from "../utils/errors.js";
import { findSnapshotDir, getSnapshotDir } from "./snapshot-paths.js";
import { readMetadata, writeMetadata } from "./metadata.js";
import { resolveSnapshotStore } from "./snapshot-store.js";

export async function renameSnapshot(
  oldName: string,
  newName: string,
  options: DbsnapBaseOptions = {}
): Promise<RenameSnapshotResult> {
  const store = await resolveSnapshotStore(options);
  const oldSnapshotDir = await findSnapshotDir(store.snapshotsDir, oldName);
  const newSnapshotDir = getSnapshotDir(store.snapshotsDir, newName);
  if (await pathExists(newSnapshotDir)) {
    throw new SnapshotError(`Snapshot "${newName}" already exists.`, { code: "SNAPSHOT_ALREADY_EXISTS" });
  }
  const metadata = await readMetadata(oldSnapshotDir);
  const renamedMetadata = { ...metadata, name: newName };

  if (!options.dryRun) {
    await fs.rename(oldSnapshotDir, newSnapshotDir);
    await writeMetadata(newSnapshotDir, renamedMetadata);
  }

  return {
    oldName,
    newName,
    oldSnapshotDir,
    newSnapshotDir,
    dryRun: Boolean(options.dryRun),
    metadata: renamedMetadata
  };
}
