import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DBSNAP_VERSION, writeMetadata } from "@canblmz1/dbsnap-core";
import { createProgram, isDirectCliInvocation, main } from "../src/index.js";

let originalCwd: string;
let originalDatabaseUrl: string | undefined;

async function tempProject(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "dbsnap-cli-test-"));
}

async function write(projectRoot: string, relativePath: string, content: string): Promise<void> {
  const target = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

async function captureStdout(task: () => Promise<void>): Promise<string> {
  let output = "";
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  try {
    await task();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output;
}

async function captureOutput(task: () => Promise<void>): Promise<{ stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write;
  try {
    await task();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
  return { stdout, stderr };
}

async function withStdinTty<T>(isTTY: boolean, task: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: isTTY });
  try {
    return await task();
  } finally {
    if (descriptor) Object.defineProperty(process.stdin, "isTTY", descriptor);
    else Reflect.deleteProperty(process.stdin, "isTTY");
  }
}

beforeEach(() => {
  originalCwd = process.cwd();
  originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  process.exitCode = undefined;
});

describe("CLI", () => {
  it("loads and prints help", async () => {
    const program = createProgram();
    let output = "";
    program.configureOutput({
      writeOut: (chunk) => {
        output += chunk;
      },
      writeErr: (chunk) => {
        output += chunk;
      }
    });
    program.exitOverride();
    await expect(program.parseAsync(["node", "dbsnap", "--help"])).rejects.toMatchObject({
      code: "commander.helpDisplayed"
    });
    expect(output).toContain("Fast local database checkpoints for Prisma, Drizzle, Playwright and Vitest");
    expect(output).toContain("save");
    expect(output).toContain("restore");
    expect(output).toContain("verify");
    expect(output).toContain("prune");
  });

  it("prints version", async () => {
    const program = createProgram();
    let output = "";
    program.configureOutput({
      writeOut: (chunk) => {
        output += chunk;
      }
    });
    program.exitOverride();
    await expect(program.parseAsync(["node", "dbsnap", "--version"])).rejects.toMatchObject({
      code: "commander.version"
    });
    expect(output.trim()).toBe(DBSNAP_VERSION);
  });

  it("keeps CLI version aligned with the publishable package version", async () => {
    const cliPackage = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
    expect(DBSNAP_VERSION).toBe(cliPackage.version);
  });

  it("keeps README CLI reference aligned with registered commands", async () => {
    const readme = await fs.readFile(new URL("../../../README.md", import.meta.url), "utf8");
    const cliReference = /## CLI Reference(?<section>[\s\S]*?)## Node API/.exec(readme)?.groups?.section ?? "";
    const documented = cliReference
      .split(/\r?\n/)
      .map((line) => /`\s*dbsnap\s+([^\s`]+)/.exec(line)?.[1])
      .filter((name): name is string => typeof name === "string" && !name.startsWith("--"));
    const registered = createProgram().commands.map((command) => command.name());

    expect(new Set(documented)).toEqual(new Set(registered));
  });

  it("keeps README global options aligned with the program options", async () => {
    const readme = await fs.readFile(new URL("../../../README.md", import.meta.url), "utf8");
    const documented = new Set(
      Array.from(readme.matchAll(/`\s*(--[a-z0-9-]+)(?:\s+<[^`]+>)?\s*`/gi), (match) => match[1])
        .filter((option) => option !== "--keep-last" && option !== "--older-than")
    );
    const registered = new Set(
      createProgram().options.map((option) => option.long).filter((option): option is string => Boolean(option) && option !== "--version")
    );

    expect(documented).toEqual(registered);
  });

  it("detects direct CLI invocation through an npm bin symlink", async () => {
    const root = await tempProject();
    const entry = path.join(root, "dist", "index.js");
    const bin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "dbsnap.cmd-target" : "dbsnap");
    await fs.mkdir(path.dirname(entry), { recursive: true });
    await fs.mkdir(path.dirname(bin), { recursive: true });
    await fs.writeFile(entry, "#!/usr/bin/env node\n", "utf8");

    try {
      await fs.symlink(entry, bin);
    } catch {
      return;
    }

    expect(isDirectCliInvocation(pathToFileURL(entry).href, bin)).toBe(true);
  });

  it("prints doctor JSON", async () => {
    const root = await tempProject();
    process.chdir(root);
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, "dev.db", "data");
    const output = await captureStdout(async () => {
      await createProgram().parseAsync(["node", "dbsnap", "--json", "doctor"]);
    });
    const parsed = JSON.parse(output);
    expect(parsed.version).toBe(DBSNAP_VERSION);
    expect(parsed.runtime.nodeVersion).toBe(process.version);
    expect(parsed.databaseUrl.found).toBe(true);
    expect(parsed.databaseUrl.source).toBe(".env");
    expect(parsed.database.type).toBe("sqlite");
    expect(parsed.sqlite.exists).toBe(true);
    expect(parsed.snapshotsDirStatus.snapshotCount).toBe(0);
  });

  it("runs init dry-run without writing files", async () => {
    const root = await tempProject();
    process.chdir(root);
    const output = await captureStdout(async () => {
      await createProgram().parseAsync(["node", "dbsnap", "--dry-run", "init"]);
    });
    expect(output).toContain("Would create snapshots directory");
    await expect(fs.stat(path.join(root, ".dbsnaps"))).rejects.toThrow();
  });

  it("runs init --yes idempotently", async () => {
    const root = await tempProject();
    process.chdir(root);
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await captureStdout(async () => {
      await createProgram().parseAsync(["node", "dbsnap", "--yes", "init"]);
      await createProgram().parseAsync(["node", "dbsnap", "--yes", "init"]);
    });
    const gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf8");
    expect(gitignore.match(/\.dbsnaps/g)).toHaveLength(1);
    await expect(fs.stat(path.join(root, "dbsnap.config.ts"))).resolves.toBeTruthy();
  });

  it("adds the configured snapshots directory to .gitignore during init", async () => {
    const root = await tempProject();
    process.chdir(root);
    const output = await captureStdout(async () => {
      await createProgram().parseAsync(["node", "dbsnap", "--yes", "--snapshots-dir", "tmp/snaps", "init"]);
    });
    const gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf8");
    expect(gitignore).toContain("tmp/snaps");
    expect(gitignore).not.toContain(".dbsnaps");
    expect(output).toContain("Added tmp/snaps to .gitignore");
  });

  it("keeps root .gitignore safe for snapshots and env examples", async () => {
    const gitignore = await fs.readFile(new URL("../../../.gitignore", import.meta.url), "utf8");
    expect(gitignore).toContain("**/.dbsnaps/");
    expect(gitignore).toContain("dbsnaps/");
    expect(gitignore).toContain("*.pgcustom");
    expect(gitignore).toContain("*.sqlite");
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^\.env\.\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
    expect(gitignore).toMatch(/^!\.env\.test\.example$/m);
  });

  it("keeps init --json non-interactive and valid JSON", async () => {
    const root = await tempProject();
    process.chdir(root);
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    const output = await captureStdout(async () => {
      await createProgram().parseAsync(["node", "dbsnap", "--json", "init"]);
    });
    const parsed = JSON.parse(output);
    expect(parsed.actions.join("\n")).not.toContain("Create dbsnap.config.ts?");
    await expect(fs.stat(path.join(root, "dbsnap.config.ts"))).rejects.toThrow();
    await expect(fs.stat(path.join(root, ".dbsnaps"))).resolves.toBeTruthy();
  });

  it("requires --yes for JSON restore because restore is destructive", async () => {
    const root = await tempProject();
    process.chdir(root);
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await writeMetadata(path.join(root, ".dbsnaps", "local"), {
      name: "local",
      databaseType: "sqlite",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 1,
      source: "dev.db",
      dbsnapVersion: DBSNAP_VERSION
    });
    await write(root, ".dbsnaps/local/database.sqlite", "data");
    await expect(createProgram().parseAsync(["node", "dbsnap", "--json", "restore", "local"])).rejects.toThrow(
      /without --yes/
    );
  });

  it("prints valid JSON errors from the real CLI entrypoint in --json mode", async () => {
    const root = await tempProject();
    process.chdir(root);

    const output = await captureOutput(async () => {
      await main(["node", "dbsnap", "--json", "restore"]);
    });

    expect(output.stderr).toBe("");
    const parsed = JSON.parse(output.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("SNAPSHOT_NAME_REQUIRED");
    expect(process.exitCode).toBe(1);
  });

  it("does not prompt forever in non-interactive destructive commands", async () => {
    const root = await tempProject();
    process.chdir(root);
    await write(root, ".dbsnaps/local/metadata.json", "{}");

    await withStdinTty(false, async () => {
      await expect(createProgram().parseAsync(["node", "dbsnap", "delete", "local"])).rejects.toThrow(
        /non-interactive/
      );
    });
  });

  it("blocks different-target restore in non-interactive JSON mode", async () => {
    const root = await tempProject();
    process.chdir(root);
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, "dev.db", "current");
    await writeMetadata(path.join(root, ".dbsnaps", "other"), {
      name: "other",
      databaseType: "sqlite",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 4,
      source: "other.db",
      dbsnapVersion: DBSNAP_VERSION
    });
    await write(root, ".dbsnaps/other/database.sqlite", "data");
    await expect(
      createProgram().parseAsync(["node", "dbsnap", "--json", "--yes", "restore", "other"])
    ).rejects.toThrow(/different database target/);
  });

  it("requires --yes for JSON delete because delete is destructive", async () => {
    const root = await tempProject();
    process.chdir(root);
    await write(root, ".dbsnaps/local/metadata.json", "{}");
    await expect(createProgram().parseAsync(["node", "dbsnap", "--json", "delete", "local"])).rejects.toThrow(
      /without --yes/
    );
  });

  it("lists and redacts snapshot info without DATABASE_URL", async () => {
    const root = await tempProject();
    process.chdir(root);
    await writeMetadata(path.join(root, ".dbsnaps", "leaky"), {
      name: "leaky",
      databaseType: "postgres",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 1,
      source: "postgres://user:secret@localhost/app?token=abc",
      sourceHash: "abc",
      dbsnapVersion: DBSNAP_VERSION
    });
    const output = await captureStdout(async () => {
      await createProgram().parseAsync(["node", "dbsnap", "--json", "info", "leaky"]);
    });
    expect(JSON.parse(output).metadata.source).toContain("***");
    expect(output).not.toContain("secret");
    expect(output).not.toContain("token=abc");
  });

  it("prints verify JSON for snapshot artifact checks", async () => {
    const root = await tempProject();
    process.chdir(root);
    await writeMetadata(path.join(root, ".dbsnaps", "local"), {
      name: "local",
      databaseType: "sqlite",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 4,
      source: "dev.db",
      dbsnapVersion: DBSNAP_VERSION
    });
    await write(root, ".dbsnaps/local/database.sqlite", "data");
    const output = await captureStdout(async () => {
      await createProgram().parseAsync(["node", "dbsnap", "--json", "verify", "local"]);
    });
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(
      parsed.checks.some((check: { name: string; status: string }) => check.name === "metadata" && check.status === "pass")
    ).toBe(true);
  });

  it("sets exit code 1 for failed verify JSON output", async () => {
    const root = await tempProject();
    process.chdir(root);
    await writeMetadata(path.join(root, ".dbsnaps", "bad-size"), {
      name: "bad-size",
      databaseType: "sqlite",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 10,
      source: "dev.db",
      dbsnapVersion: DBSNAP_VERSION
    });
    await write(root, ".dbsnaps/bad-size/database.sqlite", "data");
    const output = await captureStdout(async () => {
      await createProgram().parseAsync(["node", "dbsnap", "--json", "verify", "bad-size"]);
    });
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it("fails clearly for missing snapshots during verify", async () => {
    const root = await tempProject();
    process.chdir(root);
    await expect(createProgram().parseAsync(["node", "dbsnap", "verify", "missing"])).rejects.toThrow(
      /was not found/
    );
  });

  it("prints prune JSON and honors dry-run from the CLI", async () => {
    const root = await tempProject();
    process.chdir(root);
    await writeMetadata(path.join(root, ".dbsnaps", "old"), {
      name: "old",
      databaseType: "sqlite",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 1,
      source: "dev.db",
      dbsnapVersion: DBSNAP_VERSION
    });
    const output = await captureStdout(async () => {
      await createProgram().parseAsync(["node", "dbsnap", "--json", "--dry-run", "prune", "--keep-last", "0"]);
    });
    const parsed = JSON.parse(output);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.pruned.map((snapshot: { name: string }) => snapshot.name)).toEqual(["old"]);
    await expect(fs.stat(path.join(root, ".dbsnaps", "old"))).resolves.toBeTruthy();
  });

  it("rejects invalid prune options from the CLI", async () => {
    const root = await tempProject();
    process.chdir(root);

    await expect(createProgram().parseAsync(["node", "dbsnap", "prune", "--keep-last", "-1"])).rejects.toThrow(
      /non-negative integer/
    );
    await expect(createProgram().parseAsync(["node", "dbsnap", "prune", "--older-than", "abc"])).rejects.toThrow(
      /duration/
    );
    await expect(createProgram().parseAsync(["node", "dbsnap", "prune", "--older-than", "0d"])).rejects.toThrow(
      /greater than zero/
    );
  });

  it("enforces safety for restore through the CLI command path", async () => {
    const root = await tempProject();
    process.chdir(root);
    await write(root, ".env", "DATABASE_URL=postgres://user:secret@db.example.com/app\n");
    await writeMetadata(path.join(root, ".dbsnaps", "pg"), {
      name: "pg",
      databaseType: "postgres",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 1,
      source: "db.example.com/app",
      sourceHash: "abc",
      dbsnapVersion: DBSNAP_VERSION
    });
    await expect(createProgram().parseAsync(["node", "dbsnap", "--dry-run", "restore", "pg"])).rejects.toThrow(
      /Refusing to restore/
    );
  });
});
