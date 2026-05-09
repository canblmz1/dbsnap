import path from "node:path";

export const DEFAULT_SNAPSHOTS_DIR = ".dbsnaps";

export function resolveProjectRoot(cwd = process.cwd()): string {
  return path.resolve(cwd);
}

export function resolveSnapshotsDir(projectRoot: string, snapshotsDir?: string): string {
  const dir = snapshotsDir ?? DEFAULT_SNAPSHOTS_DIR;
  return path.isAbsolute(dir) ? path.resolve(dir) : path.resolve(projectRoot, dir);
}

export function resolveInside(baseDir: string, child: string): string {
  return path.resolve(baseDir, child);
}

export function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function normalizeForDisplay(projectRoot: string, targetPath: string): string {
  const relative = path.relative(projectRoot, targetPath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : targetPath;
}
