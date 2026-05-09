import type { DbsnapBaseOptions, PruneSnapshotInfo, PruneSnapshotsResult, SnapshotInfo } from "../types.js";
import { UserError } from "../utils/errors.js";
import { safeRemoveDir } from "../utils/fs.js";
import { listSnapshots } from "./list-snapshots.js";

export interface PruneSnapshotsOptions extends DbsnapBaseOptions {
  keepLast?: number;
  olderThan?: string;
}

const DURATION_UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000
};

export async function pruneSnapshots(options: PruneSnapshotsOptions = {}): Promise<PruneSnapshotsResult> {
  const keepLast = validateKeepLast(options.keepLast);
  const olderThanMs = options.olderThan === undefined ? undefined : parseDurationMs(options.olderThan);

  if (keepLast === undefined && olderThanMs === undefined) {
    throw new UserError("Provide at least one prune criterion: --keep-last or --older-than.", {
      code: "PRUNE_CRITERIA_REQUIRED"
    });
  }

  const listed = await listSnapshots(options);
  const now = options.now ? options.now() : new Date();
  const cutoff = olderThanMs === undefined ? undefined : new Date(now.getTime() - olderThanMs);
  const keepByPosition = new Set(
    keepLast === undefined ? [] : listed.snapshots.slice(0, keepLast).map((snapshot) => snapshot.name)
  );
  const pruned: PruneSnapshotInfo[] = [];
  const kept: SnapshotInfo[] = [];

  for (const snapshot of listed.snapshots) {
    const olderThanCutoff = cutoff ? new Date(snapshot.metadata.createdAt).getTime() < cutoff.getTime() : true;
    const beyondKeepLast = keepLast === undefined ? true : !keepByPosition.has(snapshot.name);
    const shouldPrune = olderThanCutoff && beyondKeepLast;

    if (!shouldPrune) {
      kept.push(snapshot);
      continue;
    }

    pruned.push({
      name: snapshot.name,
      path: snapshot.path,
      createdAt: snapshot.metadata.createdAt,
      sizeBytes: snapshot.metadata.sizeBytes
    });
  }

  if (!options.dryRun) {
    for (const snapshot of pruned) {
      await safeRemoveDir(listed.snapshotsDir, snapshot.path);
    }
  }

  return {
    snapshotsDir: listed.snapshotsDir,
    dryRun: Boolean(options.dryRun),
    criteria: {
      keepLast,
      olderThan: options.olderThan,
      olderThanCutoff: cutoff?.toISOString()
    },
    pruned,
    kept
  };
}

function validateKeepLast(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0) {
    throw new UserError("--keep-last must be a non-negative integer.", { code: "INVALID_PRUNE_KEEP_LAST" });
  }
  return value;
}

function parseDurationMs(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d|w)$/.exec(value.trim());
  if (!match) {
    throw new UserError("--older-than must use a duration such as 7d, 12h, or 30m.", {
      code: "INVALID_PRUNE_DURATION"
    });
  }
  const amount = Number(match[1]);
  const unit = match[2];
  if (amount <= 0) {
    throw new UserError("--older-than must be greater than zero.", { code: "INVALID_PRUNE_DURATION" });
  }
  return amount * DURATION_UNITS[unit];
}
