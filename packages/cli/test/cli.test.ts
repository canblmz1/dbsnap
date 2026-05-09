import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DBSNAP_VERSION, writeMetadata } from "@canblmz1/dbsnap-core";
import { createProgram } from "../src/index.js";

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

beforeEach(() => {
  originalCwd = process.cwd();
  originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
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
    expect(output).toContain("Time travel for your local development database");
    expect(output).toContain("save");
    expect(output).toContain("restore");
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

  it("prints doctor JSON", async () => {
    const root = await tempProject();
    process.chdir(root);
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    const output = await captureStdout(async () => {
      await createProgram().parseAsync(["node", "dbsnap", "--json", "doctor"]);
    });
    const parsed = JSON.parse(output);
    expect(parsed.databaseUrl.found).toBe(true);
    expect(parsed.database.type).toBe("sqlite");
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
      sourceHash: "abc",
      dbsnapVersion: DBSNAP_VERSION
    });
    await write(root, ".dbsnaps/local/database.sqlite", "data");
    await expect(createProgram().parseAsync(["node", "dbsnap", "--json", "restore", "local"])).rejects.toThrow(
      /without --yes/
    );
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
