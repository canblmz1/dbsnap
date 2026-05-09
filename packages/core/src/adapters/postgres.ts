import fs from "node:fs";
import path from "node:path";
import type { ParsedPostgresDatabaseUrl } from "../config/parse-database-url.js";
import { detectDocker } from "../docker/detect-docker.js";
import { detectPostgresContainer, type DockerContainer } from "../docker/detect-postgres-container.js";
import { buildDockerPgDumpArgs, buildDockerPgRestoreArgs } from "../docker/docker-exec.js";
import type { SnapshotMetadata } from "../types.js";
import { DatabaseError, DockerError } from "../utils/errors.js";
import { fileSize, pathExists } from "../utils/fs.js";
import { commandExists, requireSuccessfulSpawn } from "../utils/spawn.js";
import { DBSNAP_VERSION, hashSource } from "../snapshots/metadata.js";
import { nowIso } from "../utils/time.js";

export const POSTGRES_SNAPSHOT_FILE = "dump.pgcustom";

export interface PostgresExecutionPlan {
  mode: "local" | "docker";
  container?: DockerContainer;
  reason: string;
}

export interface PostgresAdapterOptions {
  timeoutMs?: number;
  verbose?: boolean;
  docker?: boolean;
  noDocker?: boolean;
  now?: () => Date;
}

export function buildPgDumpArgs(database: ParsedPostgresDatabaseUrl, dumpPath: string): string[] {
  const args = ["--format=custom", "--no-owner", "--file", dumpPath];
  if (database.host) args.push("--host", database.host);
  if (database.port) args.push("--port", String(database.port));
  if (database.username) args.push("--username", database.username);
  args.push("--dbname", database.databaseName);
  return args;
}

export function buildPgRestoreArgs(database: ParsedPostgresDatabaseUrl, dumpPath: string): string[] {
  const args = ["--clean", "--if-exists", "--no-owner"];
  if (database.host) args.push("--host", database.host);
  if (database.port) args.push("--port", String(database.port));
  if (database.username) args.push("--username", database.username);
  args.push("--dbname", database.databaseName, dumpPath);
  return args;
}

function postgresEnv(database: ParsedPostgresDatabaseUrl): NodeJS.ProcessEnv {
  return database.password ? { ...process.env, PGPASSWORD: database.password } : process.env;
}

export async function resolvePostgresExecutionPlan(
  database: ParsedPostgresDatabaseUrl,
  tool: "pg_dump" | "pg_restore",
  options: PostgresAdapterOptions = {}
): Promise<PostgresExecutionPlan> {
  if (options.docker && options.noDocker) {
    throw new DatabaseError("Use either --docker or --no-docker, not both.", { code: "CONFLICTING_DOCKER_OPTIONS" });
  }

  if (options.docker) {
    const container = await detectPostgresContainer(database);
    if (!container) {
      throw new DockerError("Could not find a PostgreSQL Docker container matching DATABASE_URL.", {
        code: "POSTGRES_CONTAINER_NOT_FOUND"
      });
    }
    return { mode: "docker", container, reason: "Detected PostgreSQL in Docker" };
  }

  if (await commandExists(tool)) {
    return { mode: "local", reason: `${tool} is available locally` };
  }

  if (options.noDocker) {
    throw missingPostgresTool(tool);
  }

  const docker = await detectDocker();
  if (docker.cliAvailable && docker.daemonAvailable) {
    const container = await detectPostgresContainer(database);
    if (container) {
      return { mode: "docker", container, reason: `Local ${tool} was missing; using PostgreSQL in Docker` };
    }
  }

  throw missingPostgresTool(tool);
}

function missingPostgresTool(tool: "pg_dump" | "pg_restore"): DatabaseError {
  return new DatabaseError(
    `${tool} was not found. Install PostgreSQL client tools or run with --docker if your local PostgreSQL runs in Docker.`,
    { code: tool === "pg_dump" ? "PG_DUMP_MISSING" : "PG_RESTORE_MISSING" }
  );
}

export async function savePostgresSnapshot(input: {
  database: ParsedPostgresDatabaseUrl;
  snapshotName: string;
  snapshotDir: string;
  options?: PostgresAdapterOptions;
}): Promise<SnapshotMetadata> {
  const dumpPath = path.join(input.snapshotDir, POSTGRES_SNAPSHOT_FILE);
  const plan = await resolvePostgresExecutionPlan(input.database, "pg_dump", input.options);

  if (plan.mode === "docker") {
    if (!plan.container) throw new DockerError("Docker execution plan is missing a container.");
    await requireSuccessfulSpawn("docker", buildDockerPgDumpArgs(plan.container, input.database), {
      env: postgresEnv(input.database),
      output: fs.createWriteStream(dumpPath),
      timeoutMs: input.options?.timeoutMs,
      verbose: input.options?.verbose
    });
  } else {
    await requireSuccessfulSpawn("pg_dump", buildPgDumpArgs(input.database, dumpPath), {
      env: postgresEnv(input.database),
      timeoutMs: input.options?.timeoutMs,
      verbose: input.options?.verbose
    });
  }

  const sizeBytes = await fileSize(dumpPath);
  const source = `${input.database.host}:${input.database.port ?? 5432}/${input.database.databaseName}`;
  return {
    name: input.snapshotName,
    databaseType: "postgres",
    createdAt: nowIso(input.options?.now),
    sizeBytes,
    source,
    sourceHash: hashSource(source),
    dbsnapVersion: DBSNAP_VERSION
  };
}

export async function restorePostgresSnapshot(input: {
  database: ParsedPostgresDatabaseUrl;
  snapshotDir: string;
  options?: PostgresAdapterOptions;
}): Promise<void> {
  const dumpPath = path.join(input.snapshotDir, POSTGRES_SNAPSHOT_FILE);
  if (!(await pathExists(dumpPath))) {
    throw new DatabaseError("Snapshot is missing dump.pgcustom.", { code: "SNAPSHOT_FILE_MISSING" });
  }

  const plan = await resolvePostgresExecutionPlan(input.database, "pg_restore", input.options);
  if (plan.mode === "docker") {
    if (!plan.container) throw new DockerError("Docker execution plan is missing a container.");
    await requireSuccessfulSpawn("docker", buildDockerPgRestoreArgs(plan.container, input.database), {
      env: postgresEnv(input.database),
      input: fs.createReadStream(dumpPath),
      timeoutMs: input.options?.timeoutMs,
      verbose: input.options?.verbose
    });
  } else {
    await requireSuccessfulSpawn("pg_restore", buildPgRestoreArgs(input.database, dumpPath), {
      env: postgresEnv(input.database),
      timeoutMs: input.options?.timeoutMs,
      verbose: input.options?.verbose
    });
  }
}
