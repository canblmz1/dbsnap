import fs from "node:fs/promises";
import path from "node:path";
import type { DbsnapBaseOptions, ListSnapshotsResult, SnapshotInfo } from "../types.js";
import { pathExists } from "../utils/fs.js";
import { readMetadata } from "./metadata.js";
import { findSnapshotDir } from "./snapshot-paths.js";
import { resolveSnapshotStore } from "./snapshot-store.js";

export async function listSnapshots(options: DbsnapBaseOptions = {}): Promise<ListSnapshotsResult> {
  const store = await resolveSnapshotStore(options);
  if (!(await pathExists(store.snapshotsDir))) {
    return { snapshotsDir: store.snapshotsDir, snapshots: [] };
  }

  const entries = await fs.readdir(store.snapshotsDir, { withFileTypes: true });
  const snapshots: SnapshotInfo[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const snapshotDir = path.join(store.snapshotsDir, entry.name);
    const metadata = await readMetadata(snapshotDir);
    snapshots.push({ name: metadata.name, path: snapshotDir, metadata });
  }

  snapshots.sort((a, b) => b.metadata.createdAt.localeCompare(a.metadata.createdAt));
  return { snapshotsDir: store.snapshotsDir, snapshots };
}

export async function getSnapshotInfo(name: string, options: DbsnapBaseOptions = {}): Promise<SnapshotInfo> {
  const store = await resolveSnapshotStore(options);
  const snapshotDir = await findSnapshotDir(store.snapshotsDir, name);
  const metadata = await readMetadata(snapshotDir);
  return { name: metadata.name, path: snapshotDir, metadata };
}
