#!/usr/bin/env bun
/**
 * Content gate (am-cm-audit-scripts-d34): architecture, compiler checks,
 * registered-check inventory, revision check, pinned assets.
 *
 * Rule 0 (the user's override prerogative) is not machine-checkable and is
 * not pretended to be.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCommittedInventory,
  RULE_0_HELP,
  runVerifyContent,
} from "../src/content/audits/verifyContent.ts";
import { loadProvenanceReceipts } from "../src/content/provenance/loadReceipts.ts";
import { runArchitectureGateCli } from "./app-router-architecture.ts";
import { loadReadingFiles } from "./build-content.ts";
import { runRevisionCheck } from "./check-revisions.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function printHelp(): void {
  console.log(`Usage: bun scripts/verify-content.ts [--base <ref>] [--require-local] [--help]

Runs the architecture gate, the content compiler with every registered check,
the committed check inventory, check-revisions (skipped when no --base and no
git base ref exist), and pinned-asset presence.

${RULE_0_HELP}

The standalone voice-lint quality-gate step is folded into this command as
the registered check family "voice".
`);
}

function parseArgs(argv: string[]): {
  help: boolean;
  baseRef?: string;
  requireLocal: boolean;
  skipArchitecture: boolean;
} {
  let help = false;
  let baseRef: string | undefined;
  let requireLocal = false;
  let skipArchitecture = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--require-local") requireLocal = true;
    else if (arg === "--skip-architecture") skipArchitecture = true;
    else if (arg === "--base" && argv[i + 1]) {
      baseRef = argv[i + 1];
      i += 1;
    }
  }
  return {
    help,
    requireLocal,
    skipArchitecture,
    ...(baseRef !== undefined ? { baseRef } : {}),
  };
}

function gitBaseRef(): string | undefined {
  try {
    const ref = execFileSync("git", ["rev-parse", "--verify", "origin/main"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return ref.length > 0 ? "origin/main" : undefined;
  } catch {
    return undefined;
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const provenanceDir = resolve(root, "docs/provenance");
const configDir = existsSync(resolve(root, "scripts/sources/facsimile-sources"))
  ? resolve(root, "scripts/sources/facsimile-sources")
  : undefined;
const provenance = loadProvenanceReceipts({
  provenanceDir,
  configDir,
  rootDir: root,
  requireLocal: args.requireLocal,
});

const baseRef = args.baseRef ?? gitBaseRef();
const result = await runVerifyContent({
  root,
  ...(baseRef !== undefined ? { baseRef } : {}),
  requireLocal: args.requireLocal,
  architecture: () => (args.skipArchitecture ? 0 : runArchitectureGateCli(root)),
  loadFiles: () => loadReadingFiles(root),
  revisionCheck: async (ref) => {
    if (!existsSync(resolve(root, ".git"))) return "skipped";
    const ok = await runRevisionCheck(ref, resolve(root, "content"));
    return ok;
  },
  inventory: loadCommittedInventory(root),
  pinnedAssets: provenance.pinnedAssets,
  extraReports: provenance.findings.length > 0 ? [provenance.report] : [],
});

for (const line of result.flags) console.log(`FLAG ${line}`);
for (const line of result.skipped) console.log(line);
for (const line of result.errors) console.error(line);
if (result.ok) {
  console.log(
    JSON.stringify({
      ok: true,
      flags: result.flags.length,
      skipped: result.skipped,
    }),
  );
}
process.exit(result.exitCode);
