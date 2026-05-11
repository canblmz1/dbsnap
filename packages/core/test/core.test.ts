import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { requireSuccessfulSpawn } from "../src/utils/spawn.js";
import {
  assertLocalDatabase,
  assertAllowedCommand,
  assertSafeArgs,
  buildDockerPgDumpArgs,
  buildDockerPgRestoreArgs,
  buildPgDumpArgs,
  buildPgRestoreArgs,
  deleteSnapshot,
  detectDatabaseUrl,
  detectProject,
  evaluateSafety,
  getDoctorReport,
  getSnapshotInfo,
  listSnapshots,
  loadDbsnapConfig,
  loadEnv,
  parseDatabaseUrl,
  parseDockerPorts,
  parseDockerPs,
  pruneSnapshots,
  redactDatabaseUrl,
  redactSecrets,
  renameSnapshot,
  restoreSnapshot,
  runSpawn,
  saveSnapshot,
  SafetyError,
  SnapshotError,
  validateSnapshotName,
  verifySnapshot,
  writeMetadata,
  DBSNAP_VERSION
} from "../src/index.js";

async function tempProject(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "dbsnap-test-"));
}

async function write(projectRoot: string, relativePath: string, content: string): Promise<void> {
  const target = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

async function runNodeScript(scriptPath: string, env: NodeJS.ProcessEnv): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: path.dirname(scriptPath),
      env,
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode: exitCode ?? 1, stdout, stderr });
    });
  });
}

describe("core exports", () => {
  it("exports the public API", () => {
    expect(saveSnapshot).toBeTypeOf("function");
    expect(restoreSnapshot).toBeTypeOf("function");
    expect(listSnapshots).toBeTypeOf("function");
    expect(deleteSnapshot).toBeTypeOf("function");
    expect(getSnapshotInfo).toBeTypeOf("function");
    expect(loadDbsnapConfig).toBeTypeOf("function");
    expect(pruneSnapshots).toBeTypeOf("function");
  });

  it("keeps package versions aligned with metadata version", async () => {
    const rootPackage = JSON.parse(await fs.readFile(new URL("../../../package.json", import.meta.url), "utf8"));
    const corePackage = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
    const cliPackage = JSON.parse(await fs.readFile(new URL("../../cli/package.json", import.meta.url), "utf8"));

    expect(DBSNAP_VERSION).toBe(rootPackage.version);
    expect(DBSNAP_VERSION).toBe(corePackage.version);
    expect(DBSNAP_VERSION).toBe(cliPackage.version);
    expect(cliPackage.dependencies["@canblmz1/dbsnap-core"]).toBe(corePackage.version);
  });

  it("keeps npm package metadata focused on local database checkpoints", async () => {
    const cliPackage = JSON.parse(await fs.readFile(new URL("../../cli/package.json", import.meta.url), "utf8"));
    expect(cliPackage.description).toContain("Fast local database checkpoints");
    for (const keyword of [
      "database",
      "snapshot",
      "checkpoint",
      "postgresql",
      "sqlite",
      "prisma",
      "drizzle",
      "playwright",
      "vitest",
      "testing",
      "e2e",
      "local-development",
      "developer-tools",
      "cli"
    ]) {
      expect(cliPackage.keywords).toContain(keyword);
    }
  });
});

describe("env and config loading", () => {
  it(".env.local overrides .env inside loaded file values", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\nOTHER=base\n");
    await write(root, ".env.local", "DATABASE_URL=file:./local.db\n");
    const env = await loadEnv({ projectRoot: root, processEnv: {} });
    expect(env.fileValues.DATABASE_URL).toBe("file:./local.db");
    expect(env.fileValues.OTHER).toBe("base");
  });

  it("config databaseUrl wins over process and env values", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./env.db\n");
    await write(
      root,
      "dbsnap.config.ts",
      'export default { databaseUrl: "file:./config.db", snapshotsDir: "snaps" };\n'
    );
    const loaded = await loadDbsnapConfig({
      projectRoot: root,
      processEnv: { DATABASE_URL: "file:./process.db" }
    });
    expect(loaded.databaseUrl).toBe("file:./config.db");
    expect(loaded.snapshotsDir).toBe(path.join(root, "snaps"));
  });

  it("throws a friendly error when DATABASE_URL is missing", () => {
    expect(() => detectDatabaseUrl({ processEnv: {}, fileEnv: {} })).toThrow(/Could not find DATABASE_URL/);
  });
});

describe("database URL parsing and redaction", () => {
  it("parses PostgreSQL URLs", () => {
    const parsed = parseDatabaseUrl("postgresql://user:secret@localhost:5432/app_dev?sslmode=disable");
    expect(parsed.type).toBe("postgres");
    if (parsed.type === "postgres") {
      expect(parsed.host).toBe("localhost");
      expect(parsed.port).toBe(5432);
      expect(parsed.databaseName).toBe("app_dev");
      expect(parsed.password).toBe("secret");
    }
  });

  it("parses SQLite URL variants", () => {
    expect(parseDatabaseUrl("file:./dev.db").type).toBe("sqlite");
    expect(parseDatabaseUrl("sqlite:./dev.db").type).toBe("sqlite");
    expect(parseDatabaseUrl("sqlite://./dev.db").type).toBe("sqlite");
  });

  it("rejects unsupported URLs", () => {
    expect(() => parseDatabaseUrl("mysql://localhost/db")).toThrow(/Unsupported DATABASE_URL/);
  });

  it("redacts passwords and tokens", () => {
    const redacted = redactDatabaseUrl("postgres://user:secret@localhost/app?token=abc&password=def");
    expect(redacted).toContain("***:***@localhost");
    expect(redacted).not.toContain("user");
    expect(redacted).not.toContain("secret");
    expect(redacted).not.toContain("abc");
    expect(redacted).not.toContain("def");
    expect(redactSecrets("PGPASSWORD=hunter2 token=abc")).not.toContain("hunter2");
    expect(redactSecrets('{"password":"hunter2","token":"abc"}')).not.toContain("hunter2");
  });

  it("redacts encoded PostgreSQL credentials and secret query parameters", () => {
    const redacted = redactDatabaseUrl(
      "postgresql://encoded%40user:p%40ss%2Fword@localhost:5432/app_dev?sslmode=disable&api_key=abc123"
    );

    expect(redacted).toContain("***:***@localhost");
    expect(redacted).toContain("sslmode=disable");
    expect(redacted).not.toContain("encoded");
    expect(redacted).not.toContain("p%40ss");
    expect(redacted).not.toContain("abc123");
  });
});

describe("project detection", () => {
  it("detects Prisma, Drizzle, and package scripts", async () => {
    const root = await tempProject();
    await write(root, "prisma/schema.prisma", "datasource db { provider = \"sqlite\" url = env(\"DATABASE_URL\") }\n");
    await write(root, "drizzle.config.ts", "export default {};\n");
    await write(root, "package.json", JSON.stringify({ scripts: { seed: "node seed.js" } }));
    const detected = await detectProject({ projectRoot: root });
    expect(detected.prisma.detected).toBe(true);
    expect(detected.drizzle.detected).toBe(true);
    expect(detected.packageJson.scripts.seed).toBe("node seed.js");
  });
});

describe("snapshot name validation", () => {
  it("allows common names", () => {
    expect(validateSnapshotName("checkout-ready_1.0")).toBe("checkout-ready_1.0");
  });

  it("blocks slashes and traversal", () => {
    expect(() => validateSnapshotName("../prod")).toThrow(SnapshotError);
    expect(() => validateSnapshotName("a/b")).toThrow(SnapshotError);
    expect(() => validateSnapshotName("")).toThrow(SnapshotError);
  });
});

describe("SQLite snapshot lifecycle", () => {
  it("saves, lists, shows info, renames, restores, and deletes snapshots", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, "dev.db", "users=10");

    const saved = await saveSnapshot("ten-users", { projectRoot: root, now: () => new Date("2026-01-01T00:00:00.000Z") });
    expect(saved.metadata?.databaseType).toBe("sqlite");
    expect(saved.metadata?.dbsnapVersion).toBe(DBSNAP_VERSION);

    const listed = await listSnapshots({ projectRoot: root });
    expect(listed.snapshots.map((snapshot) => snapshot.name)).toEqual(["ten-users"]);

    const info = await getSnapshotInfo("ten-users", { projectRoot: root });
    expect(info.metadata.sizeBytes).toBeGreaterThan(0);

    await renameSnapshot("ten-users", "checkout-ready", { projectRoot: root });
    await write(root, "dev.db", "users=0");
    await restoreSnapshot("checkout-ready", { projectRoot: root, yes: true });
    await expect(fs.readFile(path.join(root, "dev.db"), "utf8")).resolves.toBe("users=10");

    await deleteSnapshot("checkout-ready", { projectRoot: root });
    const afterDelete = await listSnapshots({ projectRoot: root });
    expect(afterDelete.snapshots).toHaveLength(0);
  });

  it("verifies snapshot metadata and artifacts", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, "dev.db", "users=10");
    await saveSnapshot("verify-me", { projectRoot: root });

    const result = await verifySnapshot("verify-me", { projectRoot: root });
    expect(result.ok).toBe(true);
    expect(result.checks.find((check) => check.name === "metadata")?.status).toBe("pass");

    await write(root, ".dbsnaps/verify-me/database.sqlite", "changed-size");
    const failed = await verifySnapshot("verify-me", { projectRoot: root });
    expect(failed.ok).toBe(false);
    expect(failed.checks.find((check) => check.name === "size")?.status).toBe("fail");
  });

  it("reports missing metadata, missing artifacts, and current type mismatches during verify", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, ".dbsnaps/no-metadata/database.sqlite", "data");
    const missingMetadata = await verifySnapshot("no-metadata", { projectRoot: root });
    expect(missingMetadata.ok).toBe(false);
    expect(missingMetadata.checks.find((check) => check.name === "metadata")?.status).toBe("fail");

    await writeMetadata(path.join(root, ".dbsnaps", "no-artifact"), {
      name: "no-artifact",
      databaseType: "sqlite",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 4,
      source: "dev.db",
      dbsnapVersion: DBSNAP_VERSION
    });
    const missingArtifact = await verifySnapshot("no-artifact", { projectRoot: root });
    expect(missingArtifact.ok).toBe(false);
    expect(missingArtifact.checks.find((check) => check.name === "artifact:database.sqlite")?.status).toBe("fail");

    await write(root, ".env", "DATABASE_URL=postgres://localhost:5432/app_dev\n");
    await write(root, ".dbsnaps/no-artifact/database.sqlite", "data");
    const typeMismatch = await verifySnapshot("no-artifact", { projectRoot: root });
    expect(typeMismatch.ok).toBe(false);
    expect(typeMismatch.checks.find((check) => check.name === "database-type")?.status).toBe("fail");
  });

  it("saves and restores SQLite WAL sidecar files", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, "dev.db", "main");
    await write(root, "dev.db-wal", "wal");
    await write(root, "dev.db-shm", "shm");

    const saved = await saveSnapshot("wal-state", { projectRoot: root });
    expect(saved.metadata?.sizeBytes).toBe("mainwalshm".length);
    await expect(fs.readFile(path.join(root, ".dbsnaps", "wal-state", "database.sqlite-wal"), "utf8")).resolves.toBe("wal");
    await expect(fs.readFile(path.join(root, ".dbsnaps", "wal-state", "database.sqlite-shm"), "utf8")).resolves.toBe("shm");

    await write(root, "dev.db", "mutated-main");
    await write(root, "dev.db-wal", "mutated-wal");
    await write(root, "dev.db-shm", "mutated-shm");

    await restoreSnapshot("wal-state", { projectRoot: root, yes: true });
    await expect(fs.readFile(path.join(root, "dev.db"), "utf8")).resolves.toBe("main");
    await expect(fs.readFile(path.join(root, "dev.db-wal"), "utf8")).resolves.toBe("wal");
    await expect(fs.readFile(path.join(root, "dev.db-shm"), "utf8")).resolves.toBe("shm");
  });

  it("removes stale SQLite WAL sidecars when the snapshot does not include them", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, "dev.db", "main");

    await saveSnapshot("plain", { projectRoot: root });
    await write(root, "dev.db-wal", "stale-wal");
    await write(root, "dev.db-shm", "stale-shm");

    await restoreSnapshot("plain", { projectRoot: root, yes: true });
    await expect(fs.stat(path.join(root, "dev.db-wal"))).rejects.toThrow();
    await expect(fs.stat(path.join(root, "dev.db-shm"))).rejects.toThrow();
  });

  it("lists, infos, deletes, and renames snapshots without DATABASE_URL", async () => {
    const root = await tempProject();
    await writeMetadata(path.join(root, ".dbsnaps", "orphan"), {
      name: "orphan",
      databaseType: "sqlite",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 1,
      source: "dev.db",
      sourceHash: "abc",
      dbsnapVersion: DBSNAP_VERSION
    });
    expect((await listSnapshots({ projectRoot: root })).snapshots.map((snapshot) => snapshot.name)).toEqual(["orphan"]);
    expect((await getSnapshotInfo("orphan", { projectRoot: root })).name).toBe("orphan");
    await renameSnapshot("orphan", "renamed", { projectRoot: root });
    await deleteSnapshot("renamed", { projectRoot: root });
    expect((await listSnapshots({ projectRoot: root })).snapshots).toHaveLength(0);
  });

  it("prunes snapshots by keep-last and older-than without touching kept snapshots", async () => {
    const root = await tempProject();
    for (const [name, createdAt] of [
      ["newest", "2026-01-09T00:00:00.000Z"],
      ["middle", "2026-01-05T00:00:00.000Z"],
      ["old", "2025-12-25T00:00:00.000Z"]
    ] as const) {
      await writeMetadata(path.join(root, ".dbsnaps", name), {
        name,
        databaseType: "sqlite",
        createdAt,
        sizeBytes: 1,
        source: "dev.db",
        dbsnapVersion: DBSNAP_VERSION
      });
    }

    const dryRun = await pruneSnapshots({
      projectRoot: root,
      keepLast: 1,
      olderThan: "7d",
      dryRun: true,
      now: () => new Date("2026-01-10T00:00:00.000Z")
    });
    expect(dryRun.pruned.map((snapshot) => snapshot.name)).toEqual(["old"]);
    await expect(fs.stat(path.join(root, ".dbsnaps", "old"))).resolves.toBeTruthy();

    const result = await pruneSnapshots({
      projectRoot: root,
      keepLast: 1,
      olderThan: "7d",
      now: () => new Date("2026-01-10T00:00:00.000Z")
    });
    expect(result.pruned.map((snapshot) => snapshot.name)).toEqual(["old"]);
    await expect(fs.stat(path.join(root, ".dbsnaps", "old"))).rejects.toThrow();
    await expect(fs.stat(path.join(root, ".dbsnaps", "newest"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, ".dbsnaps", "middle"))).resolves.toBeTruthy();
  });

  it("rejects invalid prune retention criteria", async () => {
    const root = await tempProject();

    await expect(pruneSnapshots({ projectRoot: root, keepLast: -1 })).rejects.toThrow(/non-negative integer/);
    await expect(pruneSnapshots({ projectRoot: root, olderThan: "abc" })).rejects.toThrow(/duration/);
    await expect(pruneSnapshots({ projectRoot: root, olderThan: "0d" })).rejects.toThrow(/greater than zero/);
    await expect(pruneSnapshots({ projectRoot: root })).rejects.toThrow(/at least one prune criterion/);
  });

  it("honors custom snapshots directory and dry-run", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, "dev.db", "data");
    const result = await saveSnapshot("dry", { projectRoot: root, snapshotsDir: "custom-snaps", dryRun: true });
    expect(result.dryRun).toBe(true);
    await expect(fs.stat(path.join(root, "custom-snaps"))).rejects.toThrow();
  });

  it("lets save dry-run preview the action before a SQLite file exists", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    const result = await saveSnapshot("dry-missing", { projectRoot: root, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.message).toContain('Would save snapshot "dry-missing"');
    await expect(fs.stat(path.join(root, ".dbsnaps", "dry-missing"))).rejects.toThrow();
  });

  it("throws friendly errors for missing SQLite files", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./missing.db\n");
    await expect(saveSnapshot("missing", { projectRoot: root })).rejects.toThrow(/SQLite database file was not found/);
  });

  it("blocks save against remote or production-like databases by default", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=postgres://user:secret@db.example.com/app\n");

    await expect(saveSnapshot("remote", { projectRoot: root, dryRun: true })).rejects.toThrow(
      /does not look local/
    );
    await expect(saveSnapshot("remote", { projectRoot: root, dryRun: true, force: true })).resolves.toMatchObject({
      dryRun: true
    });
  });

  it("throws for corrupted metadata", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, ".dbsnaps/bad/metadata.json", "{nope");
    await expect(listSnapshots({ projectRoot: root })).rejects.toThrow(/metadata/);
  });

  it("blocks restore to a different SQLite target unless explicitly allowed", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, "dev.db", "saved");
    await saveSnapshot("local", { projectRoot: root });

    await write(root, ".env", "DATABASE_URL=file:./other.db\n");
    await write(root, "other.db", "other");
    const dryRun = await restoreSnapshot("local", { projectRoot: root, dryRun: true });
    expect(dryRun.target?.matches).toBe(false);
    await expect(restoreSnapshot("local", { projectRoot: root, yes: true })).rejects.toThrow(/different database target/);

    await restoreSnapshot("local", { projectRoot: root, yes: true, allowDifferentTarget: true });
    await expect(fs.readFile(path.join(root, "other.db"), "utf8")).resolves.toBe("saved");
  });

  it("requires different-target permission even when force bypasses remote safety", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=postgres://localhost/other_dev\n");
    await writeMetadata(path.join(root, ".dbsnaps", "pg"), {
      name: "pg",
      databaseType: "postgres",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 4,
      source: "localhost:5432/app_dev",
      dbsnapVersion: DBSNAP_VERSION
    });
    await write(root, ".dbsnaps/pg/dump.pgcustom", "dump");
    await expect(restoreSnapshot("pg", { projectRoot: root, force: true, yes: true })).rejects.toThrow(
      /different database target/
    );
  });

  it("checks PostgreSQL restore target identity by host, port, and database name", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=postgres://localhost:5432/app_dev\n");
    await writeMetadata(path.join(root, ".dbsnaps", "pg"), {
      name: "pg",
      databaseType: "postgres",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 4,
      source: "localhost:5432/app_dev",
      dbsnapVersion: DBSNAP_VERSION
    });
    await write(root, ".dbsnaps/pg/dump.pgcustom", "dump");

    const sameTarget = await restoreSnapshot("pg", { projectRoot: root, dryRun: true });
    expect(sameTarget.target?.matches).toBe(true);

    await write(root, ".env", "DATABASE_URL=postgres://localhost:5432/other_dev\n");
    await expect(restoreSnapshot("pg", { projectRoot: root, yes: true })).rejects.toThrow(/different database target/);

    await write(root, ".env", "DATABASE_URL=postgres://localhost:5433/app_dev\n");
    await expect(restoreSnapshot("pg", { projectRoot: root, yes: true })).rejects.toThrow(/different database target/);

    const dryRunMismatch = await restoreSnapshot("pg", { projectRoot: root, dryRun: true });
    expect(dryRunMismatch.target?.matches).toBe(false);
    expect(dryRunMismatch.target?.currentSource).toBe("localhost:5433/app_dev");
  });
});

describe("PostgreSQL command builders", () => {
  it("builds pg_dump and pg_restore args without shell strings", () => {
    const parsed = parseDatabaseUrl("postgres://user:secret@localhost:5433/app_dev");
    expect(parsed.type).toBe("postgres");
    if (parsed.type !== "postgres") return;
    expect(buildPgDumpArgs(parsed, "/tmp/dump.pgcustom")).toEqual([
      "--format=custom",
      "--no-owner",
      "--file",
      "/tmp/dump.pgcustom",
      "--host",
      "localhost",
      "--port",
      "5433",
      "--username",
      "user",
      "--dbname",
      "app_dev"
    ]);
    expect(buildPgRestoreArgs(parsed, "/tmp/dump.pgcustom")).toContain("--clean");
    expect(buildPgRestoreArgs(parsed, "/tmp/dump.pgcustom")).toContain("--if-exists");
    expect(buildPgRestoreArgs(parsed, "/tmp/dump.pgcustom")).toContain("--no-owner");
  });

  it("allows shell metacharacters as literal args with shell:false but rejects NUL bytes", () => {
    expect(() => assertSafeArgs(["C:\\tmp\\name with spaces & symbols"])).not.toThrow();
    expect(() => assertSafeArgs(["bad\0arg"])).toThrow(/NUL byte/);
  });

  it("rejects unsupported commands by default", () => {
    expect(() => assertAllowedCommand("sh")).toThrow(/unsupported command/);
  });
});

describe("spawn helper", () => {
  it("waits for output stream finish before resolving", async () => {
    let finished = false;
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        setTimeout(callback, 20);
      }
    });
    output.on("finish", () => {
      finished = true;
    });
    await runSpawn(process.execPath, ["-e", "process.stdout.write('ok')"], {
      output,
      allowedCommands: ["node"]
    });
    expect(finished).toBe(true);
  });

  it("propagates output stream errors", async () => {
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback(new Error("output failed"));
      }
    });
    await expect(
      runSpawn(process.execPath, ["-e", "process.stdout.write('ok')"], { output, allowedCommands: ["node"] })
    ).rejects.toThrow(/output failed/);
  });

  it("propagates input stream errors", async () => {
    const input = new Readable({
      read() {
        this.destroy(new Error("input failed"));
      }
    });
    await expect(
      runSpawn(process.execPath, ["-e", "process.stdin.resume()"], { input, allowedCommands: ["node"] })
    ).rejects.toThrow(/input failed/);
  });

  it("passes spaces and ampersands as literal arguments", async () => {
    const value = "path with spaces & symbols";
    const result = await runSpawn(process.execPath, ["-e", "process.stdout.write(process.argv[1])", value], {
      allowedCommands: ["node"]
    });
    expect(result.stdout).toBe(value);
  });

  it("reports timeout after terminating the child process", async () => {
    const result = await runSpawn(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], {
      timeoutMs: 20,
      allowedCommands: ["node"]
    });
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  it("turns timed out successful-spawn requirements into a clear error", async () => {
    await expect(
      requireSuccessfulSpawn(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], {
        timeoutMs: 20,
        allowedCommands: ["node"]
      })
    ).rejects.toThrow(/timed out after 20ms/);
  });
});

describe("safety guard", () => {
  it("allows localhost, 127.0.0.1, ::1, and normal SQLite paths", () => {
    for (const url of ["postgres://localhost/dev", "postgres://127.0.0.1/dev", "postgres://[::1]/dev", "file:./dev.db"]) {
      const parsed = parseDatabaseUrl(url);
      expect(evaluateSafety(parsed, { resolvedSqlitePath: "./dev.db" }).allowedByDefault).toBe(true);
    }
  });

  it("blocks remote hosts and risky names by default", () => {
    const remote = parseDatabaseUrl("postgres://user:secret@db.example.com/app");
    expect(() => assertLocalDatabase(remote, { operation: "restore", snapshotName: "x" })).toThrow(SafetyError);

    const risky = parseDatabaseUrl("postgres://localhost/production");
    expect(() => assertLocalDatabase(risky, { operation: "restore", snapshotName: "x" })).toThrow(/production-like/);

    const sqlite = parseDatabaseUrl("file:./production.db");
    expect(() =>
      assertLocalDatabase(sqlite, { operation: "restore", snapshotName: "x", resolvedSqlitePath: "production.db" })
    ).toThrow(SafetyError);
  });

  it("blocks NODE_ENV=production unless explicitly forced", async () => {
    const parsed = parseDatabaseUrl("file:./dev.db");
    const safety = evaluateSafety(parsed, { resolvedSqlitePath: "dev.db", nodeEnv: "production" });
    expect(safety.allowedByDefault).toBe(false);
    expect(safety.reasons).toContain("NODE_ENV=production is set.");
    expect(() =>
      assertLocalDatabase(parsed, { operation: "save", resolvedSqlitePath: "dev.db", nodeEnv: "production" })
    ).toThrow(SafetyError);

    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\nNODE_ENV=production\n");
    await write(root, "dev.db", "users=10");
    await expect(saveSnapshot("blocked", { projectRoot: root, processEnv: {} })).rejects.toThrow(SafetyError);
    await expect(saveSnapshot("forced", { projectRoot: root, processEnv: {}, force: true })).resolves.toMatchObject({
      name: "forced"
    });
  });

  it("allows force and preserves dry-run safety behavior in Node API", async () => {
    const root = await tempProject();
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
    await write(root, ".dbsnaps/pg/dump.pgcustom", "dump");
    await expect(restoreSnapshot("pg", { projectRoot: root, dryRun: true })).rejects.toThrow(SafetyError);
    const forced = await restoreSnapshot("pg", { projectRoot: root, dryRun: true, force: true });
    expect(forced.dryRun).toBe(true);
    expect(JSON.stringify(forced)).not.toContain("secret");
    expect(JSON.stringify(forced)).not.toContain("user");
    expect(JSON.stringify(forced)).not.toContain("postgres://user:secret");
  });
});

describe("benchmark script", () => {
  it("refuses unsafe DATABASE_URL values without leaking credentials", async () => {
    const scriptPath = fileURLToPath(new URL("../../../scripts/benchmark.mjs", import.meta.url));
    const result = await runNodeScript(scriptPath, {
      ...process.env,
      DATABASE_URL: "postgres://user:secret@db.example.com/app",
      NODE_ENV: "test"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not local");
    expect(result.stderr).not.toContain("secret");
  });
});

describe("Docker helpers", () => {
  it("parses docker ps output and matches port mappings", () => {
    const containers = parseDockerPs("abc\tpg\tpostgres:16\t0.0.0.0:5433->5432/tcp\n");
    expect(containers[0].name).toBe("pg");
    expect(parseDockerPorts(containers[0].ports)[0]).toMatchObject({ hostPort: 5433, containerPort: 5432 });
    expect(parseDockerPorts("[::]:5434->5432/tcp")[0]).toMatchObject({ hostPort: 5434, containerPort: 5432 });
  });

  it("builds Docker exec commands without password args", () => {
    const parsed = parseDatabaseUrl("postgres://user:secret@localhost:5432/app");
    expect(parsed.type).toBe("postgres");
    if (parsed.type !== "postgres") return;
    const container = { id: "abc", name: "pg", image: "postgres", ports: "0.0.0.0:5432->5432/tcp" };
    const dumpArgs = buildDockerPgDumpArgs(container, parsed);
    const restoreArgs = buildDockerPgRestoreArgs(container, parsed);
    expect(dumpArgs).toContain("--env");
    expect(dumpArgs).toContain("PGPASSWORD");
    expect(dumpArgs.join(" ")).not.toContain("secret");
    expect(restoreArgs.join(" ")).not.toContain("secret");
  });
});

describe("doctor report", () => {
  it("returns JSON-ready status with warnings", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=postgres://user:secret@prod.rds.amazonaws.com/app_prod\n");
    const report = await getDoctorReport({ projectRoot: root, processEnv: {} });
    expect(report.databaseUrl.redacted).not.toContain("secret");
    expect(JSON.stringify(report)).not.toContain("postgres://user:secret");
    expect(report.safety?.allowedByDefault).toBe(false);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it("reports runtime, snapshots, and SQLite diagnostics without leaking secrets", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, "dev.db", "data");
    await writeMetadata(path.join(root, ".dbsnaps", "one"), {
      name: "one",
      databaseType: "sqlite",
      createdAt: "2026-01-01T00:00:00.000Z",
      sizeBytes: 4,
      source: "dev.db",
      dbsnapVersion: DBSNAP_VERSION
    });

    const report = await getDoctorReport({ projectRoot: root, processEnv: {} });

    expect(report.version).toBe(DBSNAP_VERSION);
    expect(report.runtime.nodeVersion).toBe(process.version);
    expect(report.runtime.platform).toBe(process.platform);
    expect(report.databaseUrl.source).toBe(".env");
    expect(report.sqlite?.exists).toBe(true);
    expect(report.sqlite?.parentWritable).toBe(true);
    expect(report.sqlite?.note).toContain("WAL");
    expect(report.snapshotsDirStatus.exists).toBe(true);
    expect(report.snapshotsDirStatus.writable).toBe(true);
    expect(report.snapshotsDirStatus.snapshotCount).toBe(1);
    expect(JSON.stringify(report)).not.toContain("postgres://user:secret");
  });

  it("returns actionable diagnostics when DATABASE_URL is missing", async () => {
    const root = await tempProject();
    const report = await getDoctorReport({ projectRoot: root, processEnv: {} });

    expect(report.databaseUrl.found).toBe(false);
    expect(report.databaseUrl.error).toContain("Could not find DATABASE_URL");
    expect(report.snapshotsDirStatus.exists).toBe(false);
    expect(report.version).toBe(DBSNAP_VERSION);
  });
});
