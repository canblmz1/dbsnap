import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import {
  assertLocalDatabase,
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
  redactDatabaseUrl,
  redactSecrets,
  renameSnapshot,
  restoreSnapshot,
  saveSnapshot,
  SafetyError,
  SnapshotError,
  validateSnapshotName,
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

describe("core exports", () => {
  it("exports the public API", () => {
    expect(saveSnapshot).toBeTypeOf("function");
    expect(restoreSnapshot).toBeTypeOf("function");
    expect(listSnapshots).toBeTypeOf("function");
    expect(deleteSnapshot).toBeTypeOf("function");
    expect(getSnapshotInfo).toBeTypeOf("function");
    expect(loadDbsnapConfig).toBeTypeOf("function");
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
    expect(redacted).toContain("user:***@localhost");
    expect(redacted).not.toContain("secret");
    expect(redacted).not.toContain("abc");
    expect(redacted).not.toContain("def");
    expect(redactSecrets("PGPASSWORD=hunter2 token=abc")).not.toContain("hunter2");
    expect(redactSecrets('{"password":"hunter2","token":"abc"}')).not.toContain("hunter2");
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

  it("honors custom snapshots directory and dry-run", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, "dev.db", "data");
    const result = await saveSnapshot("dry", { projectRoot: root, snapshotsDir: "custom-snaps", dryRun: true });
    expect(result.dryRun).toBe(true);
    await expect(fs.stat(path.join(root, "custom-snaps"))).rejects.toThrow();
  });

  it("throws friendly errors for missing SQLite files", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./missing.db\n");
    await expect(saveSnapshot("missing", { projectRoot: root })).rejects.toThrow(/SQLite database file was not found/);
  });

  it("throws for corrupted metadata", async () => {
    const root = await tempProject();
    await write(root, ".env", "DATABASE_URL=file:./dev.db\n");
    await write(root, ".dbsnaps/bad/metadata.json", "{nope");
    await expect(listSnapshots({ projectRoot: root })).rejects.toThrow(/metadata/);
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

  it("rejects shell metacharacters in spawn args", () => {
    expect(() => assertSafeArgs(["safe", "value; rm -rf /"])).toThrow(/shell metacharacters/);
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
    expect(JSON.stringify(forced)).not.toContain("postgres://user:secret");
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
});
