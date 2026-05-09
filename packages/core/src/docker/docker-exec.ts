import type { ParsedPostgresDatabaseUrl } from "../config/parse-database-url.js";
import type { DockerContainer } from "./detect-postgres-container.js";

export function buildDockerPgDumpArgs(container: DockerContainer, database: ParsedPostgresDatabaseUrl): string[] {
  const args = ["exec", "-i"];
  if (database.password) args.push("--env", "PGPASSWORD");
  args.push(container.id, "pg_dump", "--format=custom", "--no-owner");
  if (database.username) args.push("--username", database.username);
  args.push("--dbname", database.databaseName);
  return args;
}

export function buildDockerPgRestoreArgs(container: DockerContainer, database: ParsedPostgresDatabaseUrl): string[] {
  const args = ["exec", "-i"];
  if (database.password) args.push("--env", "PGPASSWORD");
  args.push(container.id, "pg_restore", "--clean", "--if-exists", "--no-owner");
  if (database.username) args.push("--username", database.username);
  args.push("--dbname", database.databaseName);
  return args;
}
