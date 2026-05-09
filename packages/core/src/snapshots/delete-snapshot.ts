import type { DbsnapBaseOptions, DeleteSnapshotResult } from "../types.js";
import { safeRemoveDir } from "../utils/fs.js";
import { findSnapshotDir } from "./snapshot-paths.js";
import { resolveSnapshotStore } from "./snapshot-store.js";

export async function deleteSnapshot(name: string, options: DbsnapBaseOptions = {}): Promise<DeleteSnapshotResult> {
  const store = await resolveSnapshotStore(options);
  const snapshotDir = await findSnapshotDir(store.snapshotsDir, name);
  if (!options.dryRun) {
    await safeRemoveDir(store.snapshotsDir, snapshotDir);
  }
  return { name, snapshotDir, dryRun: Boolean(options.dryRun) };
}
