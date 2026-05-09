import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../utils/fs.js";
import { resolveProjectRoot } from "../utils/paths.js";

export interface EnvFileStatus {
  path: string;
  exists: boolean;
  loaded: boolean;
}

export interface LoadedEnv {
  projectRoot: string;
  processEnv: NodeJS.ProcessEnv;
  fileValues: Record<string, string>;
  values: Record<string, string | undefined>;
  files: EnvFileStatus[];
}

export interface LoadEnvOptions {
  cwd?: string;
  projectRoot?: string;
  processEnv?: NodeJS.ProcessEnv;
}

function parseEnv(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([\w.-]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value.replace(/\\n/g, "\n");
  }
  return values;
}

export async function loadEnv(options: LoadEnvOptions = {}): Promise<LoadedEnv> {
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : resolveProjectRoot(options.cwd);
  const processEnv = options.processEnv ?? process.env;
  const files: EnvFileStatus[] = [];
  const fileValues: Record<string, string> = {};

  for (const filename of [".env", ".env.local"]) {
    const envPath = path.join(projectRoot, filename);
    const exists = await pathExists(envPath);
    let loaded = false;
    if (exists) {
      Object.assign(fileValues, parseEnv(await fs.readFile(envPath, "utf8")));
      loaded = true;
    }
    files.push({ path: envPath, exists, loaded });
  }

  return {
    projectRoot,
    processEnv,
    fileValues,
    values: { ...fileValues, ...processEnv },
    files
  };
}
