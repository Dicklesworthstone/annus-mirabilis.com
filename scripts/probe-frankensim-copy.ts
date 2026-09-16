#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * Archive every sibling the FrankenSim path-dep closure reaches into a probe
 * copy. The 2026-09-15 probe omitted frankensqlite and invalidated five results.
 *
 * Never writes into live sibling checkouts. Never retries a failed probe.
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASUPERSYNC_PIN,
  checkProbeCopy,
  discoverPathDeps,
  FRANKENSIM_PIN,
  requiredSiblingNames,
} from "../src/testing/probeCopy.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = resolve(REPO, "..");

const PINNED_REVISIONS: Record<string, string> = {
  frankensim: FRANKENSIM_PIN,
  asupersync: ASUPERSYNC_PIN,
};

function usage(): never {
  process.stderr.write(
    "usage: probe-frankensim-copy.ts check <build-root>\n" +
      "       probe-frankensim-copy.ts archive-missing <build-root>\n",
  );
  process.exit(2);
}

function gitHead(repo: string): string {
  const result = spawnSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git rev-parse failed in ${repo}: ${result.stderr}`);
  return result.stdout.trim();
}

function archiveSibling(name: string, dest: string): { revision: string; files: number } {
  const live = join(PROJECTS, name);
  if (!existsSync(join(live, ".git")) && !existsSync(join(live, "Cargo.toml"))) {
    throw new Error(`live sibling missing: ${live}`);
  }
  const revision = PINNED_REVISIONS[name] ?? gitHead(live);
  mkdirSync(dest, { recursive: true });
  const archive = spawnSync("git", ["-C", live, "archive", "--format=tar", revision], {
    encoding: "buffer",
    maxBuffer: 1024 * 1024 * 512,
  });
  if (archive.status !== 0) {
    throw new Error(`git archive ${name} ${revision} failed: ${archive.stderr?.toString() ?? ""}`);
  }
  const tar = spawnSync("tar", ["-C", dest, "-xf", "-"], {
    input: archive.stdout,
    encoding: "buffer",
  });
  if (tar.status !== 0)
    throw new Error(`tar extract ${name} failed: ${tar.stderr?.toString() ?? ""}`);
  const count = spawnSync("git", ["-C", live, "ls-tree", "-r", "--name-only", revision], {
    encoding: "utf8",
  });
  const files = count.stdout.split("\n").filter((line) => line.length > 0).length;
  return { revision, files };
}

function recordRevision(buildRoot: string, name: string, revision: string): void {
  writeFileSync(
    join(buildRoot, `${name.toUpperCase().replace(/-/g, "_")}_REVISION`),
    `${revision}\n`,
  );
  const identity = join(buildRoot, "IDENTITY.txt");
  appendFileSync(identity, `${name}Revision=${revision}\n`);
}

function main(argv: string[]): number {
  const command = argv[0];
  const buildRootArg = argv[1];
  if (command === undefined || buildRootArg === undefined) usage();
  const buildRoot = resolve(buildRootArg);
  const frankensim = join(buildRoot, "frankensim");
  if (!existsSync(join(frankensim, "Cargo.toml"))) {
    process.stderr.write(`frankensim copy missing at ${frankensim}\n`);
    return 1;
  }
  const deps = discoverPathDeps(frankensim);
  const required = requiredSiblingNames(deps);
  if (command === "check") {
    const result = checkProbeCopy(buildRoot, deps);
    process.stdout.write(`${JSON.stringify({ required, ...result }, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  if (command === "archive-missing") {
    const before = checkProbeCopy(buildRoot, deps);
    const toArchive = [...new Set([...before.missingRequired, ...before.missingUndocumented])];
    const archived: Array<{ name: string; revision: string; files: number }> = [];
    for (const name of toArchive) {
      const dest = join(buildRoot, name);
      process.stderr.write(`archiving ${name} -> ${dest}\n`);
      const info = archiveSibling(name, dest);
      recordRevision(buildRoot, name, info.revision);
      archived.push({ name, ...info });
    }
    const after = checkProbeCopy(buildRoot, deps);
    process.stdout.write(
      `${JSON.stringify({ required, documentedExclusions: [], archived, before, after }, null, 2)}\n`,
    );
    return after.ok ? 0 : 1;
  }
  usage();
}

process.exit(main(process.argv.slice(2)));
