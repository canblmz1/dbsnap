import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseDatabaseUrl } from "../src/config/parse-database-url.js";
import { DockerError } from "../src/utils/errors.js";

const mocks = vi.hoisted(() => ({
  commandExists: vi.fn(),
  requireSuccessfulSpawn: vi.fn(),
  detectDocker: vi.fn(),
  detectPostgresContainer: vi.fn()
}));

vi.mock("../src/utils/spawn.js", () => ({
  commandExists: mocks.commandExists,
  requireSuccessfulSpawn: mocks.requireSuccessfulSpawn
}));

vi.mock("../src/docker/detect-docker.js", () => ({
  detectDocker: mocks.detectDocker
}));

vi.mock("../src/docker/detect-postgres-container.js", () => ({
  detectPostgresContainer: mocks.detectPostgresContainer
}));

describe("PostgreSQL execution planning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.commandExists.mockResolvedValue(false);
    mocks.detectDocker.mockResolvedValue({ cliAvailable: false, daemonAvailable: false });
    mocks.detectPostgresContainer.mockResolvedValue(undefined);
  });

  it("returns a doctor-style missing pg_dump error when local tools and Docker fallback are unavailable", async () => {
    const { resolvePostgresExecutionPlan } = await import("../src/adapters/postgres.js");
    const database = parseDatabaseUrl("postgres://localhost:5432/app_dev");
    expect(database.type).toBe("postgres");
    if (database.type !== "postgres") return;

    await expect(resolvePostgresExecutionPlan(database, "pg_dump", { noDocker: true })).rejects.toMatchObject({
      code: "PG_DUMP_MISSING"
    });
  });

  it("falls back to a matching Docker container when pg_dump is missing", async () => {
    const { resolvePostgresExecutionPlan } = await import("../src/adapters/postgres.js");
    const database = parseDatabaseUrl("postgres://localhost:5432/app_dev");
    expect(database.type).toBe("postgres");
    if (database.type !== "postgres") return;
    const container = { id: "abc", name: "pg", image: "postgres:16", ports: "0.0.0.0:5432->5432/tcp" };
    mocks.detectDocker.mockResolvedValue({ cliAvailable: true, daemonAvailable: true });
    mocks.detectPostgresContainer.mockResolvedValue(container);

    const plan = await resolvePostgresExecutionPlan(database, "pg_dump");
    expect(plan).toMatchObject({ mode: "docker", container });
  });

  it("surfaces Docker container ambiguity as an explicit error", async () => {
    const { resolvePostgresExecutionPlan } = await import("../src/adapters/postgres.js");
    const database = parseDatabaseUrl("postgres://localhost:5432/app_dev");
    expect(database.type).toBe("postgres");
    if (database.type !== "postgres") return;
    mocks.detectDocker.mockResolvedValue({ cliAvailable: true, daemonAvailable: true });
    mocks.detectPostgresContainer.mockRejectedValue(
      new DockerError("Multiple PostgreSQL Docker containers expose port 5432.", {
        code: "MULTIPLE_DOCKER_CONTAINERS"
      })
    );

    await expect(resolvePostgresExecutionPlan(database, "pg_dump")).rejects.toMatchObject({
      code: "MULTIPLE_DOCKER_CONTAINERS"
    });
  });
});
