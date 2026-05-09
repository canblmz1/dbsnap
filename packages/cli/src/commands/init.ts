import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { detectProject, loadEnv, parseDatabaseUrl, redactDatabaseUrl, resolveProjectRoot } from "@canblmz1/dbsnap-core";
import { createReporter } from "../ui/reporter.js";
import { confirm } from "../ui/prompts.js";
import { readCliOptions } from "./options.js";

export interface InitResult {
  projectRoot: string;
  actions: string[];
  dryRun: boolean;
  detected: {
    prisma: boolean;
    drizzle: boolean;
    databaseType?: string;
    databaseUrl?: string;
  };
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize dbsnap in this project")
    .action(async function (this: Command) {
      const options = readCliOptions(this);
      const reporter = createReporter({ json: options.json });
      const result = await runInit(options);
      if (options.json) {
        reporter.json(result);
        return;
      }
      for (const action of result.actions) {
        reporter.info(action);
      }
      reporter.success(options.dryRun ? "Init dry run complete." : "dbsnap initialized.");
      reporter.info("Suggested scripts:");
      reporter.info('  "db:snap": "dbsnap save dev-ready"');
      reporter.info('  "db:restore": "dbsnap restore dev-ready --yes"');
    });
}

export async function runInit(options: ReturnType<typeof readCliOptions>): Promise<InitResult> {
  const projectRoot = resolveProjectRoot(options.cwd);
  const [project, env] = await Promise.all([detectProject({ projectRoot }), loadEnv({ projectRoot })]);
  const databaseUrl = options.databaseUrl ?? env.processEnv.DATABASE_URL ?? env.fileValues.DATABASE_URL;
  const parsed = databaseUrl ? parseDatabaseUrl(databaseUrl) : undefined;
  const actions: string[] = [];

  const snapshotsDir = path.resolve(projectRoot, options.snapshotsDir ?? ".dbsnaps");
  if (options.dryRun) {
    actions.push(`Would create snapshots directory at ${snapshotsDir}.`);
  } else {
    await fs.mkdir(snapshotsDir, { recursive: true });
    actions.push(`Created snapshots directory at ${snapshotsDir}.`);
  }

  const gitignorePath = path.join(projectRoot, ".gitignore");
  const gitignoreEntry = getGitignoreEntry(projectRoot, snapshotsDir);
  const gitignoreExists = await exists(gitignorePath);
  const gitignoreContent = gitignoreExists ? await fs.readFile(gitignorePath, "utf8") : "";
  if (!gitignoreEntry) {
    actions.push("Snapshots directory is outside the project; .gitignore was not changed.");
  } else if (!gitignoreContent.split(/\r?\n/).some((line) => line.trim() === gitignoreEntry)) {
    if (options.dryRun) {
      actions.push(`Would add ${gitignoreEntry} to .gitignore.`);
    } else {
      const prefix = gitignoreContent && !gitignoreContent.endsWith("\n") ? "\n" : "";
      await fs.writeFile(gitignorePath, `${gitignoreContent}${prefix}${gitignoreEntry}\n`, "utf8");
      actions.push(`Added ${gitignoreEntry} to .gitignore.`);
    }
  } else {
    actions.push(`${gitignoreEntry} is already in .gitignore.`);
  }

  const configPath = path.join(projectRoot, "dbsnap.config.ts");
  if (!(await exists(configPath))) {
    const shouldCreate =
      options.yes || options.dryRun || (!options.json && (await confirm("Create dbsnap.config.ts?")));
    if (shouldCreate) {
      const config = [
        "import type { DbsnapConfig } from \"@canblmz1/dbsnap\";",
        "",
        "const config: DbsnapConfig = {",
        "  snapshotsDir: \".dbsnaps\"",
        "};",
        "",
        "export default config;",
        ""
      ].join("\n");
      if (options.dryRun) {
        actions.push("Would create dbsnap.config.ts.");
      } else {
        await fs.writeFile(configPath, config, { encoding: "utf8", flag: "wx" });
        actions.push("Created dbsnap.config.ts.");
      }
    }
  } else {
    actions.push("dbsnap.config.ts already exists; leaving it unchanged.");
  }

  if (project.prisma.detected) actions.push("Detected Prisma project.");
  if (project.drizzle.detected) actions.push("Detected Drizzle project.");
  if (databaseUrl) actions.push(`Detected ${parsed?.type ?? "unknown"} DATABASE_URL: ${redactDatabaseUrl(databaseUrl)}.`);
  else actions.push("DATABASE_URL was not found yet. Add it to .env, .env.local, or dbsnap.config.ts.");
  actions.push("package.json was not modified. Add the suggested scripts if they fit your workflow.");

  return {
    projectRoot,
    actions,
    dryRun: Boolean(options.dryRun),
    detected: {
      prisma: project.prisma.detected,
      drizzle: project.drizzle.detected,
      databaseType: parsed?.type,
      databaseUrl: databaseUrl ? redactDatabaseUrl(databaseUrl) : undefined
    }
  };
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getGitignoreEntry(projectRoot: string, snapshotsDir: string): string | undefined {
  const relative = path.relative(projectRoot, snapshotsDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return relative.split(path.sep).join("/");
}
