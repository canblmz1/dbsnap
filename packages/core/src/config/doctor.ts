import { commandExists } from "../utils/spawn.js";
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
    const [pgDump, pgRestore] = await Promise.all([commandExists("pg_dump"), commandExists("pg_restore")]);
    tools.pgDump = {
      available: pgDump,
      guidance: pgDump ? undefined : "Install PostgreSQL client tools or use --docker."
    };
    tools.pgRestore = {
      available: pgRestore,
      guidance: pgRestore ? undefined : "Install PostgreSQL client tools or use --docker."
    };
    if (tools.docker.cliAvailable && tools.docker.daemonAvailable) {
      try {
        tools.postgresContainer = await detectPostgresContainer(database);
      } catch (error) {
        tools.dockerError = error instanceof Error ? error.message : String(error);
      }
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
