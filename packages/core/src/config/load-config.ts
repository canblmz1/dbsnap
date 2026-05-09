import path from "node:path";
import { createJiti } from "jiti";
import { loadEnv, type LoadedEnv } from "./load-env.js";
import { parseDatabaseUrl, type ParsedDatabaseUrl } from "./parse-database-url.js";
import { ConfigError } from "../utils/errors.js";
import { pathExists } from "../utils/fs.js";
import { resolveProjectRoot, resolveSnapshotsDir } from "../utils/paths.js";

export interface DbsnapConfig {
  databaseUrl?: string;
  snapshotsDir?: string;
  docker?: boolean;
  timeoutMs?: number;
}

export interface LoadedDbsnapConfig {
  projectRoot: string;
  configPath?: string;
  config: DbsnapConfig;
  env: LoadedEnv;
  databaseUrl: string;
  database: ParsedDatabaseUrl;
  snapshotsDir: string;
}

export interface LoadDbsnapConfigOptions {
  cwd?: string;
  projectRoot?: string;
  databaseUrl?: string;
  snapshotsDir?: string;
  processEnv?: NodeJS.ProcessEnv;
}

export async function loadDbsnapConfig(options: LoadDbsnapConfigOptions = {}): Promise<LoadedDbsnapConfig> {
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : resolveProjectRoot(options.cwd);
  const env = await loadEnv({ projectRoot, processEnv: options.processEnv });
  const { config, configPath } = await loadConfigFile(projectRoot);
  const databaseUrl = detectDatabaseUrl({
    explicitDatabaseUrl: options.databaseUrl,
    configDatabaseUrl: config.databaseUrl,
    processEnv: env.processEnv,
    fileEnv: env.fileValues
  });
  const snapshotsDir = resolveSnapshotsDir(projectRoot, options.snapshotsDir ?? config.snapshotsDir);

  return {
    projectRoot,
    configPath,
    config,
    env,
    databaseUrl,
    database: parseDatabaseUrl(databaseUrl),
    snapshotsDir
  };
}

export async function loadConfigFile(projectRoot: string): Promise<{ config: DbsnapConfig; configPath?: string }> {
  for (const filename of ["dbsnap.config.ts", "dbsnap.config.js", "dbsnap.config.mjs", "dbsnap.config.cjs"]) {
    const configPath = path.join(projectRoot, filename);
    if (!(await pathExists(configPath))) continue;

    try {
      const jiti = createJiti(import.meta.url, { interopDefault: true });
      const imported = await jiti.import(configPath, { default: true });
      const config = (imported && typeof imported === "object" ? imported : {}) as DbsnapConfig;
      return { config, configPath };
    } catch (error) {
      throw new ConfigError(`Could not load ${filename}.`, {
        code: "CONFIG_LOAD_FAILED",
        cause: error,
        details: { configPath }
      });
    }
  }

  return { config: {} };
}

export function detectDatabaseUrl(input: {
  explicitDatabaseUrl?: string;
  configDatabaseUrl?: string;
  processEnv?: NodeJS.ProcessEnv;
  fileEnv?: Record<string, string>;
}): string {
  const databaseUrl =
    input.explicitDatabaseUrl ??
    input.configDatabaseUrl ??
    input.processEnv?.DATABASE_URL ??
    input.fileEnv?.DATABASE_URL;

  if (!databaseUrl) {
    throw new ConfigError(
      "Could not find DATABASE_URL. Set DATABASE_URL in your environment, .env, .env.local, or dbsnap.config.ts.",
      { code: "DATABASE_URL_MISSING" }
    );
  }

  return databaseUrl;
}
