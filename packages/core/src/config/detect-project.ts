import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../utils/fs.js";
import { resolveProjectRoot } from "../utils/paths.js";

export interface ProjectDetection {
  projectRoot: string;
  prisma: {
    detected: boolean;
    schemaPath?: string;
  };
  drizzle: {
    detected: boolean;
    configPath?: string;
  };
  packageJson: {
    detected: boolean;
    path?: string;
    scripts: Record<string, string>;
  };
}

export async function detectProject(options: { cwd?: string; projectRoot?: string } = {}): Promise<ProjectDetection> {
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : resolveProjectRoot(options.cwd);
  const prismaSchemaPath = path.join(projectRoot, "prisma", "schema.prisma");
  const drizzleConfigNames = ["drizzle.config.ts", "drizzle.config.js", "drizzle.config.mjs", "drizzle.config.cjs"];
  const drizzleConfigPath = drizzleConfigNames.map((name) => path.join(projectRoot, name));
  const packageJsonPath = path.join(projectRoot, "package.json");

  let scripts: Record<string, string> = {};
  if (await pathExists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as { scripts?: Record<string, string> };
      scripts = packageJson.scripts ?? {};
    } catch {
      scripts = {};
    }
  }

  const detectedDrizzlePath = await firstExisting(drizzleConfigPath);

  return {
    projectRoot,
    prisma: {
      detected: await pathExists(prismaSchemaPath),
      schemaPath: (await pathExists(prismaSchemaPath)) ? prismaSchemaPath : undefined
    },
    drizzle: {
      detected: Boolean(detectedDrizzlePath),
      configPath: detectedDrizzlePath
    },
    packageJson: {
      detected: await pathExists(packageJsonPath),
      path: (await pathExists(packageJsonPath)) ? packageJsonPath : undefined,
      scripts
    }
  };
}

async function firstExisting(paths: string[]): Promise<string | undefined> {
  for (const targetPath of paths) {
    if (await pathExists(targetPath)) return targetPath;
  }
  return undefined;
}
