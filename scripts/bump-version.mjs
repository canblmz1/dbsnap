#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: node scripts/bump-version.mjs <version> [--dry-run]");
  console.error("Example: node scripts/bump-version.mjs 0.9.0-beta.8");
  process.exit(1);
}

const files = {
  rootPackage: path.join(root, "package.json"),
  corePackage: path.join(root, "packages", "core", "package.json"),
  cliPackage: path.join(root, "packages", "cli", "package.json"),
  metadata: path.join(root, "packages", "core", "src", "snapshots", "metadata.ts"),
  changelog: path.join(root, "CHANGELOG.md")
};

const rootPackage = readJson(files.rootPackage);
const corePackage = readJson(files.corePackage);
const cliPackage = readJson(files.cliPackage);

rootPackage.version = version;
corePackage.version = version;
cliPackage.version = version;
cliPackage.dependencies["@canblmz1/dbsnap-core"] = version;

const currentMetadata = fs.readFileSync(files.metadata, "utf8");
if (!/export const DBSNAP_VERSION = "[^"]+";/.test(currentMetadata)) {
  console.error("Could not find DBSNAP_VERSION in metadata.ts.");
  process.exit(1);
}
const metadata = currentMetadata.replace(
  /export const DBSNAP_VERSION = "[^"]+";/,
  `export const DBSNAP_VERSION = "${version}";`
);

const changelog = nextChangelog(fs.readFileSync(files.changelog, "utf8"), version, process.env.RELEASE_NOTES);

if (dryRun) {
  console.log(`Would bump dbsnap packages to ${version}.`);
  process.exit(0);
}

writeJson(files.rootPackage, rootPackage);
writeJson(files.corePackage, corePackage);
writeJson(files.cliPackage, cliPackage);
fs.writeFileSync(files.metadata, metadata, "utf8");
fs.writeFileSync(files.changelog, changelog, "utf8");
console.log(`Bumped dbsnap packages to ${version}.`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function nextChangelog(current, nextVersion, releaseNotes) {
  if (current.includes(`## ${nextVersion}`)) return current;
  const body = releaseNotes?.trim() || "- Maintenance release.";
  return current.replace(/^# Changelog\s*/u, `# Changelog\n\n## ${nextVersion}\n\n${body}\n\n`);
}
