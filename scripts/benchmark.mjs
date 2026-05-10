#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const riskyNamePattern = /(^|[_\-.\/\\])(prod|production|staging|live)([_\-.\/\\]|$)/i;
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const riskyHostPatterns = [
  /rds\.amazonaws\.com$/i,
  /supabase\.co$/i,
  /neon\.tech$/i,
  /planetscale/i,
  /railway\.app$/i,
  /render\.com$/i,
  /fly\.dev$/i
];

const args = process.argv.slice(2);
const help = args.includes("--help") || args.includes("-h");
const keepSnapshot = args.includes("--keep-snapshot");
const snapshotArgIndex = args.indexOf("--snapshot");
const snapshotName =
  snapshotArgIndex >= 0 && args[snapshotArgIndex + 1]
    ? args[snapshotArgIndex + 1]
    : `benchmark-${new Date().toISOString().replace(/[:.]/g, "-")}`;

if (help) {
  usage();
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  usage();
  console.error("DATABASE_URL is required for benchmarks.");
  process.exit(1);
}

const safetyError = unsafeReason(databaseUrl, process.env.NODE_ENV);
if (safetyError) {
  console.error(`Refusing to benchmark unsafe target: ${safetyError}`);
  console.error(`DATABASE_URL: ${redactDatabaseUrl(databaseUrl)}`);
  process.exit(1);
}

const cli = resolveCli();

console.log("dbsnap benchmark");
console.log(`OS: ${os.type()} ${os.release()} ${os.arch()}`);
console.log(`Node: ${process.version}`);
console.log(`CLI: ${cli.label}`);
console.log(`DATABASE_URL: ${redactDatabaseUrl(databaseUrl)}`);
console.log(`Snapshot: ${snapshotName}`);

await timed("doctor", ["doctor", "--json"]);
await timed("save", ["save", snapshotName]);
await timed("restore", ["restore", snapshotName, "--yes"]);

if (!keepSnapshot) {
  await runCli(["delete", snapshotName, "--yes"]);
}

console.log("Benchmark complete.");

function usage() {
  console.log(`Usage:
  DATABASE_URL=file:./dev.db node scripts/benchmark.mjs

Options:
  --snapshot <name>   Snapshot name to use
  --keep-snapshot    Keep the benchmark snapshot instead of deleting it
  --help             Show this help
`);
}

function resolveCli() {
  const localCli = path.join(repoRoot, "packages", "cli", "dist", "index.js");
  if (fs.existsSync(localCli)) {
    return {
      command: process.execPath,
      argsPrefix: [localCli],
      label: localCli
    };
  }
  return {
    command: process.platform === "win32" ? "dbsnap.cmd" : "dbsnap",
    argsPrefix: [],
    label: "dbsnap from PATH"
  };
}

async function timed(label, cliArgs) {
  const start = performance.now();
  await runCli(cliArgs);
  const elapsedMs = performance.now() - start;
  console.log(`${label}: ${elapsedMs.toFixed(1)}ms`);
}

async function runCli(cliArgs) {
  await new Promise((resolve, reject) => {
    const child = spawn(cli.command, [...cli.argsPrefix, ...cliArgs], {
      cwd: repoRoot,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`dbsnap ${cliArgs.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

function unsafeReason(input, nodeEnv) {
  if (nodeEnv?.toLowerCase() === "production") return "NODE_ENV=production is set.";
  const trimmed = input.trim();
  if (/^postgres(?:ql)?:\/\//i.test(trimmed)) {
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return "DATABASE_URL is not a valid PostgreSQL URL.";
    }
    const host = parsed.hostname;
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!localHosts.has(host)) return `host "${host}" is not local.`;
    if (riskyHostPatterns.some((pattern) => pattern.test(host))) return `host "${host}" looks hosted.`;
    if (riskyNamePattern.test(databaseName)) return `database name "${databaseName}" looks production-like.`;
    return undefined;
  }
  if (/^(file:|sqlite:)/i.test(trimmed)) {
    const sqlitePath = trimmed.replace(/^(file:|sqlite:\/\/|sqlite:)/i, "");
    if (riskyNamePattern.test(sqlitePath)) return `SQLite path "${sqlitePath}" looks production-like.`;
    return undefined;
  }
  return "DATABASE_URL must use postgres://, postgresql://, file:, sqlite:, or sqlite://.";
}

function redactDatabaseUrl(input) {
  try {
    const parsed = new URL(input);
    if (parsed.password) parsed.password = "***";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/password|pass|pwd|token|secret|key|auth/i.test(key)) parsed.searchParams.set(key, "***");
    }
    return parsed.toString();
  } catch {
    return input.replace(/(:\/\/[^:\s]+:)[^@\s]+@/g, "$1***@").replace(/(password|token|secret|api_key)=([^&\s]+)/gi, "$1=***");
  }
}
