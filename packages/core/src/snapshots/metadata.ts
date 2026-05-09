import crypto from "node:crypto";
import path from "node:path";
import type { SnapshotMetadata } from "../types.js";
import { readJsonFile, writeJsonFile } from "../utils/fs.js";
import { SnapshotError } from "../utils/errors.js";

export const DBSNAP_VERSION = "0.9.0-beta.6";
export const METADATA_FILE = "metadata.json";

export function metadataPath(snapshotDir: string): string {
  return path.join(snapshotDir, METADATA_FILE);
}

export function hashSource(source: string): string {
  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);
}

export async function writeMetadata(snapshotDir: string, metadata: SnapshotMetadata): Promise<void> {
  await writeJsonFile(metadataPath(snapshotDir), metadata);
}

export async function readMetadata(snapshotDir: string): Promise<SnapshotMetadata> {
  const metadata = await readJsonFile<SnapshotMetadata>(metadataPath(snapshotDir));
  assertMetadata(metadata);
  return metadata;
}

export function assertMetadata(metadata: SnapshotMetadata): void {
  const required: Array<keyof SnapshotMetadata> = [
    "name",
    "databaseType",
    "createdAt",
    "sizeBytes",
    "source",
    "dbsnapVersion"
  ];
  for (const key of required) {
    if (metadata[key] === undefined || metadata[key] === null || metadata[key] === "") {
      throw new SnapshotError(`Snapshot metadata is missing "${key}".`, { code: "CORRUPTED_METADATA" });
    }
  }
  if (metadata.databaseType !== "sqlite" && metadata.databaseType !== "postgres") {
    throw new SnapshotError("Snapshot metadata has an unsupported database type.", { code: "CORRUPTED_METADATA" });
  }
}
