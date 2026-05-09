import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { runSpawn } from "../utils/spawn.js";
import { detectDocker, type DockerStatus } from "../docker/detect-docker.js";
import { detectPostgresContainer, type DockerContainer } from "../docker/detect-postgres-container.js";
import { SQLITE_SHM_SNAPSHOT_FILE, SQLITE_WAL_SNAPSHOT_FILE } from "../adapters/sqlite.js";
import { detectProject, type ProjectDetection } from "./detect-project.js";
import { detectDatabaseUrl, loadConfigFile, type DbsnapConfig } from "./load-config.js";
import { loadEnv, type LoadedEnv } from "./load-env.js";
import {
  parseDatabaseUrl,
  resolveSqlitePath,
  sanitizeParsedDatabaseUrl,
  type ParsedDatabaseUrl
} from "./parse-database-url.js";
import { evaluateSafety, type SafetyCheckResult } from "../safety/safety-check.js";
import { redactDatabaseUrl } from "../safety/redact-url.js";
import { resolveProjectRoot, resolveSnapshotsDir } from "../utils/paths.js";
import { pathExists } from "../utils/fs.js";
import { DBSNAP_VERSION } from "../snapshots/metadata.js";

export interface ToolStatus {
  available: boolean;
  version?: string;
  guidance?: string;
}

export interface DoctorReport {
  version: string;
  runtime: {
    nodeVersion: string;
    platform: NodeJS.Platform;
    arch: string;
    cwd: string;
  };
  projectRoot: string;
  env: LoadedEnv["files"];
  config: {
    path?: string;
    loaded: boolean;
    value: DbsnapConfig;
  };
  databaseUrl: {
    found: boolean;
    redacted?: string;
    source?: "explicit" | "config" | "process.env" | ".env";
    error?: string;
  };
  database?: ParsedDatabaseUrl;
  project: ProjectDetection;
  snapshotsDir: string;
  snapshotsDirStatus: {
    exists: boolean;
    writable: boolean;
    snapshotCount: number;
    error?: string;
  };
  safety?: SafetyCheckResult;
  sqlite?: {
    path: string;
    exists: boolean;
    parentDir: string;
    parentWritable: boolean;
    walPath: string;
    walExists: boolean;
    shmPath: string;
    shmExists: boolean;
    note: string;
  };
  tools: {
    pgDump?: ToolStatus;
    pgRestore?: ToolStatus;
    docker: DockerStatus;
    postgresContainer?: DockerContainer;
    dockerError?: string;
    dockerFallbackAvailable?: boolean;
  };
  restoreRequiresForce?: boolean;
  warnings: string[];
}

export async function getDoctorReport(options: { cwd?: string; projectRoot?: string; databaseUrl?: string; snapshotsDir?: string; processEnv?: NodeJS.ProcessEnv } = {}): Promise<DoctorReport> {
  const cwd = options.cwd ?? process.cwd();
  const projectRoot = options.projectRoot ? resolveProjectRoot(options.projectRoot) : resolveProjectRoot(options.cwd);
  const [env, project, loadedConfig] = await Promise.all([
    loadEnv({ projectRoot, processEnv: options.processEnv }),
    detectProject({ projectRoot }),
    loadConfigFile(projectRoot)
  ]);
  const snapshotsDir = resolveSnapshotsDir(projectRoot, options.snapshotsDir ?? loadedConfig.config.snapshotsDir);
  const snapshotsDirStatus = await inspectSnapshotsDir(snapshotsDir);
  const safeConfig = loadedConfig.config.databaseUrl
    ? { ...loadedConfig.config, databaseUrl: redactDatabaseUrl(loadedConfig.config.databaseUrl) }
    : loadedConfig.config;
  const warnings: string[] = [];

  let databaseUrl: string | undefined;
  let databaseUrlSource: DoctorReport["databaseUrl"]["source"];
  try {
    if (options.databaseUrl) {
      databaseUrl = options.databaseUrl;
      databaseUrlSource = "explicit";
    } else if (loadedConfig.config.databaseUrl) {
      databaseUrl = loadedConfig.config.databaseUrl;
      databaseUrlSource = "config";
    } else if (env.processEnv.DATABASE_URL) {
      databaseUrl = env.processEnv.DATABASE_URL;
      databaseUrlSource = "process.env";
    } else if (env.fileValues.DATABASE_URL) {
      databaseUrl = env.fileValues.DATABASE_URL;
      databaseUrlSource = ".env";
    } else {
      detectDatabaseUrl({
        explicitDatabaseUrl: options.databaseUrl,
        configDatabaseUrl: loadedConfig.config.databaseUrl,
        processEnv: env.processEnv,
        fileEnv: env.fileValues
      });
    }
  } catch (error) {
    return {
      version: DBSNAP_VERSION,
      runtime: runtimeInfo(cwd),
      projectRoot,
      env: env.files,
      config: { path: loadedConfig.configPath, loaded: Boolean(loadedConfig.configPath), value: safeConfig },
      databaseUrl: { found: false, error: error instanceof Error ? error.message : String(error) },
      project,
      snapshotsDir,
      snapshotsDirStatus,
      tools: { docker: await detectDocker() },
      warnings: ["DATABASE_URL is missing."]
    };
  }

  let database: ParsedDatabaseUrl | undefined;
  let safety: SafetyCheckResult | undefined;
  let sqlite: DoctorReport["sqlite"];
  try {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is missing.");
    }
    database = parseDatabaseUrl(databaseUrl);
    const resolvedSqlitePath = database.type === "sqlite" ? resolveSqlitePath(projectRoot, database) : undefined;
    safety = evaluateSafety(database, { resolvedSqlitePath });
    if (database.type === "sqlite" && resolvedSqlitePath) {
      sqlite = await inspectSqliteDatabase(resolvedSqlitePath);
      if (!sqlite.exists) warnings.push(`SQLite database file does not exist yet: ${sqlite.path}`);
      if (!sqlite.parentWritable) warnings.push(`SQLite database parent directory is not writable: ${sqlite.parentDir}`);
    }
    warnings.push(...safety.reasons, ...safety.warnings);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  const tools: DoctorReport["tools"] = { docker: await detectDocker() };
  if (database?.type === "postgres") {
    const [pgDump, pgRestore] = await Promise.all([getPostgresToolStatus("pg_dump"), getPostgresToolStatus("pg_restore")]);
    tools.pgDump = pgDump;
    tools.pgRestore = pgRestore;
    if (!pgDump.available) warnings.push(pgDump.guidance ?? "pg_dump is missing.");
    if (!pgRestore.available) warnings.push(pgRestore.guidance ?? "pg_restore is missing.");
    if (tools.docker.cliAvailable && tools.docker.daemonAvailable) {
      try {
        tools.postgresContainer = await detectPostgresContainer(database);
        if (!tools.postgresContainer) {
          warnings.push(
            `No PostgreSQL Docker container matched DATABASE_URL host "${database.host}" on port ${database.port ?? 5432}.`
          );
        }
      } catch (error) {
        tools.dockerError = error instanceof Error ? error.message : String(error);
        warnings.push(tools.dockerError);
      }
    } else if (tools.docker.cliAvailable && !tools.docker.daemonAvailable) {
      warnings.push(`Docker CLI is installed, but Docker Desktop or the Docker daemon is not running. ${tools.docker.error ?? ""}`.trim());
    }
    tools.dockerFallbackAvailable = Boolean(
      tools.docker.cliAvailable && tools.docker.daemonAvailable && tools.postgresContainer
    );
  }

  return {
    version: DBSNAP_VERSION,
    runtime: runtimeInfo(cwd),
    projectRoot,
    env: env.files,
    config: { path: loadedConfig.configPath, loaded: Boolean(loadedConfig.configPath), value: safeConfig },
    databaseUrl: {
      found: Boolean(databaseUrl),
      redacted: databaseUrl ? redactDatabaseUrl(databaseUrl) : undefined,
      source: databaseUrlSource
    },
    database: database ? sanitizeParsedDatabaseUrl(database) : undefined,
    project,
    snapshotsDir,
    snapshotsDirStatus,
    safety,
    sqlite,
    tools,
    restoreRequiresForce: safety ? !safety.allowedByDefault : undefined,
    warnings
  };
}

function runtimeInfo(cwd: string): DoctorReport["runtime"] {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd
  };
}

async function inspectSnapshotsDir(snapshotsDir: string): Promise<DoctorReport["snapshotsDirStatus"]> {
  const exists = await pathExists(snapshotsDir);
  const writable = exists ? await canWrite(snapshotsDir) : false;
  if (!exists) return { exists, writable, snapshotCount: 0 };

  try {
    const entries = await fs.readdir(snapshotsDir, { withFileTypes: true });
    return {
      exists,
      writable,
      snapshotCount: entries.filter((entry) => entry.isDirectory()).length
    };
  } catch (error) {
    return {
      exists,
      writable,
      snapshotCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function inspectSqliteDatabase(databasePath: string): Promise<NonNullable<DoctorReport["sqlite"]>> {
  const parentDir = path.dirname(databasePath);
  return {
    path: databasePath,
    exists: await pathExists(databasePath),
    parentDir,
    parentWritable: await canWrite(parentDir),
    walPath: `${databasePath}-wal`,
    walExists: await pathExists(`${databasePath}-wal`),
    shmPath: `${databasePath}-shm`,
    shmExists: await pathExists(`${databasePath}-shm`),
    note: `If SQLite WAL mode is active, dbsnap copies ${SQLITE_WAL_SNAPSHOT_FILE} and ${SQLITE_SHM_SNAPSHOT_FILE} sidecars. Pause writes before saving for the most reliable snapshot.`
  };
}

async function canWrite(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function getPostgresToolStatus(command: "pg_dump" | "pg_restore"): Promise<ToolStatus> {
  try {
    const result = await runSpawn(command, ["--version"], { timeoutMs: 5000 });
    if (result.exitCode !== 0) {
      return {
        available: false,
        guidance: `Install PostgreSQL client tools or use --docker. ${result.stderr || result.stdout}`.trim()
      };
    }
    return {
      available: true,
      version: (result.stdout || result.stderr).trim().split(/\r?\n/)[0]
    };
  } catch (error) {
    return {
      available: false,
      guidance: `Install PostgreSQL client tools or use --docker. ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}
