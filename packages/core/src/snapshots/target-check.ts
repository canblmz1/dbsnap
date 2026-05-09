import path from "node:path";
import type { ParsedDatabaseUrl } from "../config/parse-database-url.js";
import type { SnapshotMetadata, SnapshotTargetCheck } from "../types.js";
import { normalizeForDisplay } from "../utils/paths.js";
import { hashSource } from "./metadata.js";

export function evaluateSnapshotTarget(
  metadata: SnapshotMetadata,
  database: ParsedDatabaseUrl,
  input: { projectRoot: string; resolvedSqlitePath?: string }
): SnapshotTargetCheck {
  const current = currentSourceIdentity(database, input);
  const reasons: string[] = [];

  if (metadata.sourceId) {
    if (metadata.sourceId !== current.sourceId) {
      reasons.push(`Snapshot source "${metadata.source}" does not match current target "${current.source}".`);
    }
  } else if (metadata.sourceHash) {
    if (metadata.sourceHash !== current.sourceHash) {
      reasons.push(`Snapshot source "${metadata.source}" does not match current target "${current.source}".`);
    }
  } else if (metadata.source !== current.source) {
    reasons.push(`Snapshot source "${metadata.source}" does not match current target "${current.source}".`);
  }

  return {
    matches: reasons.length === 0,
    currentSource: current.source,
    currentSourceHash: current.sourceHash,
    currentSourceId: current.sourceId,
    snapshotSource: metadata.source,
    snapshotSourceHash: metadata.sourceHash,
    snapshotSourceId: metadata.sourceId,
    reasons
  };
}

function currentSourceIdentity(
  database: ParsedDatabaseUrl,
  input: { projectRoot: string; resolvedSqlitePath?: string }
): { source: string; sourceHash?: string; sourceId?: string } {
  if (database.type === "sqlite") {
    const databasePath = input.resolvedSqlitePath ?? database.sqlitePath;
    return {
      source: normalizeForDisplay(input.projectRoot, databasePath),
      sourceId: hashSource(path.resolve(databasePath))
    };
  }

  const source = `${database.host}:${database.port ?? 5432}/${database.databaseName}`;
  return {
    source,
    sourceHash: hashSource(source)
  };
}
