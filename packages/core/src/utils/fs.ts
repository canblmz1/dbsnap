import fs from "node:fs/promises";
import path from "node:path";
import { SnapshotError } from "./errors.js";
import { isPathInside } from "./paths.js";

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function readJsonFile<T>(targetPath: string): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(targetPath, "utf8")) as T;
  } catch (error) {
    throw new SnapshotError(`Could not read snapshot metadata at ${targetPath}. The snapshot may be corrupted.`, {
      code: "CORRUPTED_METADATA",
      cause: error
    });
  }
}

export async function writeJsonFile(targetPath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function safeRemoveDir(parent: string, target: string): Promise<void> {
  if (!isPathInside(parent, target) || path.resolve(parent) === path.resolve(target)) {
    throw new SnapshotError("Refusing to remove a path outside the snapshots directory.", {
      code: "PATH_OUTSIDE_SNAPSHOTS",
      details: { parent, target }
    });
  }
  await fs.rm(target, { recursive: true, force: true });
}

export async function copyFileWithDirs(source: string, destination: string): Promise<void> {
  await ensureDir(path.dirname(destination));
  await fs.copyFile(source, destination);
}

export async function removeFileIfExists(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { force: true });
}

export async function fileSize(targetPath: string): Promise<number> {
  return (await fs.stat(targetPath)).size;
}
