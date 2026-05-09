import path from "node:path";
import { SnapshotError } from "../utils/errors.js";
import { ensureDir, pathExists } from "../utils/fs.js";
import { isPathInside } from "../utils/paths.js";
import { validateSnapshotName } from "./validate-snapshot-name.js";

export function getSnapshotDir(snapshotsDir: string, name: string): string {
  const safeName = validateSnapshotName(name);
  const snapshotDir = path.resolve(snapshotsDir, safeName);
  if (!isPathInside(snapshotsDir, snapshotDir)) {
    throw new SnapshotError("Snapshot path escaped the snapshots directory.", { code: "PATH_TRAVERSAL" });
  }
  return snapshotDir;
}

export async function createSnapshotDir(snapshotsDir: string, name: string, options: { dryRun?: boolean } = {}): Promise<string> {
  const snapshotDir = getSnapshotDir(snapshotsDir, name);
  if (await pathExists(snapshotDir)) {
    throw new SnapshotError(`Snapshot "${name}" already exists. Delete it or use a different name.`, {
      code: "SNAPSHOT_ALREADY_EXISTS"
    });
  }
  if (!options.dryRun) {
    await ensureDir(snapshotDir);
  }
  return snapshotDir;
}

export async function findSnapshotDir(snapshotsDir: string, name: string): Promise<string> {
  const snapshotDir = getSnapshotDir(snapshotsDir, name);
  if (!(await pathExists(snapshotDir))) {
    throw new SnapshotError(`Snapshot "${name}" was not found.`, { code: "SNAPSHOT_NOT_FOUND" });
  }
  return snapshotDir;
}
