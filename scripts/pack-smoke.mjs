import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const coreDir = path.join(root, "packages", "core");
const cliDir = path.join(root, "packages", "cli");
const node = { command: process.execPath, prefixArgs: [] };
const npm = resolveNodeTool("npm-cli.js", "npm");
const npx = resolveNodeTool("npx-cli.js", "npx");
const pnpm = resolvePnpmTool();
const cliPackage = JSON.parse(fs.readFileSync(path.join(cliDir, "package.json"), "utf8"));

function resolveNodeTool(cliFile, fallbackCommand) {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, "node_modules", "npm", "bin", cliFile),
    path.resolve(nodeDir, "..", "lib", "node_modules", "npm", "bin", cliFile)
  ];
  const cliPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (cliPath) return { command: process.execPath, prefixArgs: [cliPath] };
  return { command: fallbackCommand, prefixArgs: [] };
}

function resolvePnpmTool() {
  if (process.env.npm_execpath && /pnpm/i.test(process.env.npm_execpath)) {
    return { command: process.execPath, prefixArgs: [process.env.npm_execpath] };
  }
  return { command: "pnpm", prefixArgs: [] };
}

function run(tool, args, options = {}) {
  const fullArgs = [...tool.prefixArgs, ...args];
  const result = spawnSync(tool.command, fullArgs, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: false
  });
  if (result.status !== 0) {
    const stdout = result.stdout?.trim() ?? "";
    const stderr = result.stderr?.trim() ?? "";
    const cause = result.error ? `\n${result.error.message}` : "";
    throw new Error(
      [
        `Command failed: ${tool.command} ${fullArgs.join(" ")}${cause}`,
        stdout,
        stderr
      ].filter(Boolean).join("\n")
    );
  }
  return result.stdout;
}

function pack(packageDir) {
  const stdout = run(npm, ["pack", "--json"], { cwd: packageDir });
  const [packed] = JSON.parse(stdout);
  if (!packed?.filename || !Array.isArray(packed.files)) {
    throw new Error(`Could not parse npm pack output for ${packageDir}.`);
  }
  return {
    tarball: path.join(packageDir, packed.filename),
    files: packed.files.map((file) => file.path)
  };
}

function assertContains(files, expected, packageName) {
  for (const file of expected) {
    if (!files.includes(file)) {
      throw new Error(`${packageName} tarball is missing ${file}.`);
    }
  }
}

function assertNoLocalArtifacts(files, packageName) {
  const forbidden = [/^\.env/, /^\.dbsnaps\//, /\.sqlite3?$/, /\.db$/, /\.pgcustom$/, /\.dump$/, /\.log$/];
  for (const file of files) {
    if (forbidden.some((pattern) => pattern.test(file))) {
      throw new Error(`${packageName} tarball unexpectedly includes local artifact ${file}.`);
    }
  }
}

function assertShebang() {
  const bin = fs.readFileSync(path.join(cliDir, "dist", "index.js"), "utf8");
  if (!bin.startsWith("#!/usr/bin/env node")) {
    throw new Error("CLI dist/index.js is missing the node shebang.");
  }
}

const packedCore = pack(coreDir);
const packedCli = pack(cliDir);

assertContains(packedCore.files, ["dist/index.js", "dist/index.cjs", "dist/index.d.ts", "README.md", "LICENSE", "package.json"], "@canblmz1/dbsnap-core");
assertContains(packedCli.files, ["dist/index.js", "dist/api.js", "dist/api.cjs", "dist/api.d.ts", "README.md", "LICENSE", "package.json"], "@canblmz1/dbsnap");
assertNoLocalArtifacts(packedCore.files, "@canblmz1/dbsnap-core");
assertNoLocalArtifacts(packedCli.files, "@canblmz1/dbsnap");
assertShebang();

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "dbsnap-pack-smoke-"));
run(npm, ["init", "-y"], { cwd: temp });
run(npm, ["install", "--save-dev", packedCore.tarball, packedCli.tarball], { cwd: temp });
run(
  node,
  [
    "--input-type=module",
    "-e",
    "import { saveSnapshot, restoreSnapshot, listSnapshots, deleteSnapshot, getSnapshotInfo, loadDbsnapConfig, verifySnapshot, pruneSnapshots } from '@canblmz1/dbsnap'; for (const fn of [saveSnapshot, restoreSnapshot, listSnapshots, deleteSnapshot, getSnapshotInfo, loadDbsnapConfig, verifySnapshot, pruneSnapshots]) { if (typeof fn !== 'function') throw new Error('missing export'); }"
  ],
  { cwd: temp }
);

const version = run(npx, ["dbsnap", "--version"], { cwd: temp }).trim();
if (version !== cliPackage.version) {
  throw new Error(`Unexpected dbsnap --version output: ${version}`);
}

const help = run(npx, ["dbsnap", "--help"], { cwd: temp });
if (!help.includes("Time travel for your local development database") || !help.includes("verify") || !help.includes("prune")) {
  throw new Error("dbsnap --help did not include expected help text.");
}

run(npx, ["dbsnap", "init", "--dry-run"], { cwd: temp });

const sqliteEnv = { ...process.env, DATABASE_URL: "file:./dev.db" };
const dryRunSave = run(npx, ["dbsnap", "save", "test", "--dry-run"], { cwd: temp, env: sqliteEnv });
if (!dryRunSave.includes('Would save snapshot "test".')) {
  throw new Error(`dbsnap save --dry-run did not print expected output: ${dryRunSave}`);
}

const emptyList = JSON.parse(run(npx, ["dbsnap", "--json", "list"], { cwd: temp, env: sqliteEnv }));
if (!Array.isArray(emptyList.snapshots)) {
  throw new Error("dbsnap list --json did not return a snapshots array.");
}

const localNpxVersion = run(npx, ["--no-install", "dbsnap", "--version"], { cwd: temp }).trim();
if (localNpxVersion !== cliPackage.version) {
  throw new Error(`Local npx dbsnap reported ${localNpxVersion}.`);
}

const packageJsonPath = path.join(temp, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
packageJson.scripts = { "dbsnap-version": "dbsnap --version" };
fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
const scriptVersion = run(npm, ["run", "dbsnap-version", "--silent"], { cwd: temp }).trim();
if (scriptVersion !== cliPackage.version) {
  throw new Error(`npm script dbsnap reported ${scriptVersion}.`);
}

const pnpmVersion = run(pnpm, ["exec", "dbsnap", "--version"], { cwd: temp }).trim();
if (pnpmVersion !== cliPackage.version) {
  throw new Error(`pnpm exec dbsnap reported ${pnpmVersion}.`);
}

fs.writeFileSync(path.join(temp, "dev.db"), "users=10", "utf8");
run(npx, ["dbsnap", "save", "test"], { cwd: temp, env: sqliteEnv });
fs.writeFileSync(path.join(temp, "dev.db"), "users=0", "utf8");
run(npx, ["dbsnap", "restore", "test", "--yes"], { cwd: temp, env: sqliteEnv });

const restored = fs.readFileSync(path.join(temp, "dev.db"), "utf8");
if (restored !== "users=10") {
  throw new Error(`SQLite restore smoke test failed; got ${JSON.stringify(restored)}.`);
}

const spacedTemp = fs.mkdtempSync(path.join(os.tmpdir(), "dbsnap space path "));
run(npm, ["init", "-y"], { cwd: spacedTemp });
run(npm, ["install", "--save-dev", packedCore.tarball, packedCli.tarball], { cwd: spacedTemp });
const spacedVersion = run(npx, ["dbsnap", "--version"], { cwd: spacedTemp }).trim();
if (spacedVersion !== cliPackage.version) {
  throw new Error(`dbsnap failed from a path with spaces; got ${spacedVersion}.`);
}

console.log(`Pack smoke passed in ${temp}`);
