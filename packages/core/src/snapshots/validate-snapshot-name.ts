import { SnapshotError } from "../utils/errors.js";

const VALID_SNAPSHOT_NAME = /^[A-Za-z0-9._-]+$/;

export function validateSnapshotName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new SnapshotError("Snapshot name cannot be empty.", { code: "INVALID_SNAPSHOT_NAME" });
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    throw new SnapshotError("Snapshot name cannot contain slashes.", { code: "INVALID_SNAPSHOT_NAME" });
  }
  if (trimmed.includes("..") || trimmed === "." || trimmed === "..") {
    throw new SnapshotError("Snapshot name cannot contain path traversal.", { code: "INVALID_SNAPSHOT_NAME" });
  }
  if (!VALID_SNAPSHOT_NAME.test(trimmed)) {
    throw new SnapshotError("Snapshot name can only contain letters, numbers, dash, underscore, and dot.", {
      code: "INVALID_SNAPSHOT_NAME"
    });
  }
  return trimmed;
}
