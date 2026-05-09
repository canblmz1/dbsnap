import path from "node:path";
import type { DbsnapBaseOptions } from "../types.js";
import { loadConfigFile } from "../config/load-config.js";
import { resolveProjectRoot, resolveSnapshotsDir } from "../utils/paths.js";

export interface SnapshotStore {
  projectRoot: string;
  snapshotsDir: string;
}

export async function resolveSnapshotStore(options: DbsnapBaseOptions = {}): Promise<SnapshotStore> {
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : resolveProjectRoot(options.cwd);
  const { config } = await loadConfigFile(projectRoot);
  return {
    projectRoot,
    snapshotsDir: resolveSnapshotsDir(projectRoot, options.snapshotsDir ?? config.snapshotsDir)
  };
}
