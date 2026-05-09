import type { ParsedPostgresDatabaseUrl } from "../config/parse-database-url.js";
import { DockerError } from "../utils/errors.js";
import { runSpawn } from "../utils/spawn.js";

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  ports: string;
}

export interface DockerPortMapping {
  hostIp?: string;
  hostPort: number;
  containerPort: number;
  protocol: string;
}

export function parseDockerPs(output: string): DockerContainer[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id = "", name = "", image = "", ports = ""] = line.split("\t");
      return { id, name, image, ports };
    });
}

export function parseDockerPorts(ports: string): DockerPortMapping[] {
  const mappings: DockerPortMapping[] = [];
  for (const rawPart of ports.split(",")) {
    const part = rawPart.trim();
    const match = /(?:(?<hostIp>\[?[\d.:a-fA-F]+\]?):)?(?<hostPort>\d+)->(?<containerPort>\d+)\/(?<protocol>\w+)/.exec(part);
    if (!match?.groups) continue;
    mappings.push({
      hostIp: match.groups.hostIp,
      hostPort: Number(match.groups.hostPort),
      containerPort: Number(match.groups.containerPort),
      protocol: match.groups.protocol
    });
  }
  return mappings;
}

export function findMatchingPostgresContainers(
  containers: DockerContainer[],
  database: ParsedPostgresDatabaseUrl
): DockerContainer[] {
  const port = database.port ?? 5432;
  return containers
    .filter((container) => /postgres/i.test(container.image) || /postgres/i.test(container.name))
    .filter((container) => parseDockerPorts(container.ports).some((mapping) => mapping.hostPort === port));
}

export async function listDockerContainers(): Promise<DockerContainer[]> {
  const result = await runSpawn("docker", ["ps", "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}"], {
    timeoutMs: 8000
  });
  if (result.exitCode !== 0) {
    throw new DockerError(`Could not list Docker containers: ${result.stderr || result.stdout}`, {
      code: "DOCKER_PS_FAILED"
    });
  }
  return parseDockerPs(result.stdout);
}

export async function detectPostgresContainer(database: ParsedPostgresDatabaseUrl): Promise<DockerContainer | undefined> {
  const matches = findMatchingPostgresContainers(await listDockerContainers(), database);
  if (matches.length > 1) {
    throw new DockerError(
      `Multiple PostgreSQL Docker containers expose port ${database.port ?? 5432}. Use --no-docker or stop one container.`,
      {
        code: "MULTIPLE_DOCKER_CONTAINERS",
        details: { matches: matches.map((container) => ({ id: container.id, name: container.name, ports: container.ports })) }
      }
    );
  }
  return matches[0];
}
