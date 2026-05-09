import { runSpawn } from "../utils/spawn.js";
import { detectDocker, type DockerStatus } from "../docker/detect-docker.js";
import { detectPostgresContainer, type DockerContainer } from "../docker/detect-postgres-container.js";
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

export interface ToolStatus {
  available: boolean;
  version?: string;
  guidance?: string;
}

export interface DoctorReport {
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
  safety?: SafetyCheckResult;
  tools: {
    pgDump?: ToolStatus;
    pgRestore?: ToolStatus;
    docker: DockerStatus;
    postgresContainer?: DockerContainer;
    dockerError?: string;
  };
  warnings: string[];
}

export async function getDoctorReport(options: { cwd?: string; projectRoot?: string; databaseUrl?: string; snapshotsDir?: string; processEnv?: NodeJS.ProcessEnv } = {}): Promise<DoctorReport> {
  const projectRoot = options.projectRoot ? resolveProjectRoot(options.projectRoot) : resolveProjectRoot(options.cwd);
  const [env, project, loadedConfig] = await Promise.all([
    loadEnv({ projectRoot, processEnv: options.processEnv }),
    detectProject({ projectRoot }),
    loadConfigFile(projectRoot)
  ]);
  const snapshotsDir = resolveSnapshotsDir(projectRoot, options.snapshotsDir ?? loadedConfig.config.snapshotsDir);
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
      projectRoot,
      env: env.files,
      config: { path: loadedConfig.configPath, loaded: Boolean(loadedConfig.configPath), value: safeConfig },
      databaseUrl: { found: false, error: error instanceof Error ? error.message : String(error) },
      project,
      snapshotsDir,
      tools: { docker: await detectDocker() },
      warnings: ["DATABASE_URL is missing."]
    };
  }

  let database: ParsedDatabaseUrl | undefined;
  let safety: SafetyCheckResult | undefined;
  try {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is missing.");
    }
    database = parseDatabaseUrl(databaseUrl);
    const resolvedSqlitePath = database.type === "sqlite" ? resolveSqlitePath(projectRoot, database) : undefined;
    safety = evaluateSafety(database, { resolvedSqlitePath });
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
  }

  return {
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
    safety,
    tools,
    warnings
  };
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
