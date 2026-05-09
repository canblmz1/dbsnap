import { DockerError } from "../utils/errors.js";
import { commandExists, runSpawn } from "../utils/spawn.js";

export interface DockerStatus {
  cliAvailable: boolean;
  daemonAvailable: boolean;
  error?: string;
}

export async function detectDocker(): Promise<DockerStatus> {
  const cliAvailable = await commandExists("docker", ["--version"]);
  if (!cliAvailable) {
    return { cliAvailable: false, daemonAvailable: false, error: "Docker CLI was not found." };
  }

  const info = await runSpawn("docker", ["info", "--format", "{{json .ServerVersion}}"], { timeoutMs: 5000 });
  if (info.exitCode !== 0) {
    return {
      cliAvailable: true,
      daemonAvailable: false,
      error: info.stderr || "Docker daemon is not available."
    };
  }

  return { cliAvailable: true, daemonAvailable: true };
}

export async function assertDockerReady(): Promise<void> {
  const status = await detectDocker();
  if (!status.cliAvailable) {
    throw new DockerError("Docker CLI is not installed or is not on PATH.", { code: "DOCKER_MISSING" });
  }
  if (!status.daemonAvailable) {
    throw new DockerError(`Docker is installed, but the daemon is not available. ${status.error ?? ""}`.trim(), {
      code: "DOCKER_DAEMON_UNAVAILABLE"
    });
  }
}
