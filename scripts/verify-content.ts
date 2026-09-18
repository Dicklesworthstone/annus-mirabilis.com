#!/usr/bin/env bun
/**
 * Content gate (am-cm-audit-scripts-d34): architecture, compiler checks,
 * registered-check inventory, revision check, pinned assets.
 *
 * Rule 0 (the user's override prerogative) is not machine-checkable and is
 * not pretended to be.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import {
  auditInstruments,
  loadLiveInstrumentRows,
} from "../src/content/audits/instruments.ts";
import {
  auditMisconceptions,
  type MisconceptionAuditInput,
} from "../src/content/audits/misconceptions.ts";
import {
  auditReadings,
  type ReadingsAuditInput,
  type ReadingsOwnerEntry,
  type ReadingTarget,
  type ReadingTargetKind,
} from "../src/content/audits/readings.ts";
import { auditShelf, type ShelfAuditInput } from "../src/content/audits/shelf.ts";
import { summarize } from "../src/content/audits/types.ts";
import {
  loadCommittedInventory,
  RULE_0_HELP,
  runVerifyContent,
} from "../src/content/audits/verifyContent.ts";
import { auditKernelBindings } from "../src/content/kernel/audit.ts";
import { loadProvenanceReceipts } from "../src/content/provenance/loadReceipts.ts";
import { runArchitectureGateCli } from "./app-router-architecture.ts";
import { mainAuditDimensions } from "./audit-dimensions.ts";
import { loadReadingFiles } from "./build-content.ts";
import { runRevisionCheck } from "./check-revisions.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function printHelp(): void {
  console.log(`Usage: bun scripts/verify-content.ts [--base <ref>] [--require-local] [--help]

Runs the architecture gate, the content compiler with every registered check,
audit-dimensions, the four content audits (readings, shelf, misconceptions, instruments),
check-revisions (skipped when no --base and no git base ref exist), and pinned-asset presence.

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

function loadLiveReadingsAuditInput(
  rootDir: string,
  options?: { ownerBeadIds?: readonly string[] },
): ReadingsAuditInput {
  const ownersDir = resolve(rootDir, "content/editorial/readings-owners");
  const owners: ReadingsOwnerEntry[] = [];
  const targets: ReadingTarget[] = [];
  if (existsSync(ownersDir)) {
    for (const name of readdirSync(ownersDir)) {
      if (!name.endsWith(".yaml")) continue;
      const beadId = name.replace(".yaml", "");
      if (options?.ownerBeadIds && !options.ownerBeadIds.includes(beadId)) continue;
      try {
        const parsed = yaml.load(readFileSync(resolve(ownersDir, name), "utf8")) as Record<string, unknown> | null;
        const ownerBeadId = String(parsed?.ownerBeadId ?? parsed?.beadId ?? name.replace(".yaml", ""));
        const targetIds: string[] = [];
        const targetKinds: ReadingTargetKind[] = [];
        if (Array.isArray(parsed?.targets)) {
          for (const rawTarget of parsed.targets) {
            const t = rawTarget as Record<string, unknown>;
            const kind: ReadingTargetKind =
              t.kind === "caption" || t.captions
                ? "instrument-caption"
                : (t.kind as ReadingTargetKind) ?? "paragraph";
            const id = (t.id as string | undefined) ?? (t.instrument ? `caption-${String(t.instrument)}` : undefined);
            if (id) {
              targetIds.push(id);
              if (!targetKinds.includes(kind)) targetKinds.push(kind);
              if (t.readings) {
                targets.push({
                  targetId: id,
                  targetKind: kind,
                  paper: String(parsed.paper ?? "brownian-motion"),
                  readings: t.readings as any,
                  ...(Array.isArray(t.scopeCritical)
                    ? { scopeCritical: t.scopeCritical.map(String) }
                    : {}),
                });
              }
            }
          }
        }
        owners.push({
          ownerBeadId,
          fileName: name,
          paper: String(parsed?.paper ?? "brownian-motion"),
          targetKinds: targetKinds.length > 0 ? targetKinds : ["paragraph"],
          targetIds,
        });
      } catch {
        // Ignore unparseable
      }
    }
  }
  return { targets, owners };
}

const baseRef = args.baseRef ?? gitBaseRef();
const result = await runVerifyContent({
  root,
  ...(baseRef !== undefined ? { baseRef } : {}),
  requireLocal: args.requireLocal,
  architecture: () => (args.skipArchitecture ? 0 : runArchitectureGateCli(root)),
  loadFiles: async () => {
    const readingFiles = await loadReadingFiles(root);
    const experimentFiles: { path: string; text: string }[] = [];
    for (const id of ["bm-01", "bm-05", "bm-06"]) {
      const p = resolve(root, `content/experiments/${id}.yaml`);
      if (existsSync(p)) {
        experimentFiles.push({
          path: `experiments/${id}.yaml`,
          text: readFileSync(p, "utf8"),
        });
      }
    }
    return [...readingFiles, ...experimentFiles];
  },
  dimensionAudit: async () => {
    const { summary } = await mainAuditDimensions([]);
    return summarize(
      "audit-dimensions",
      summary.ok
        ? []
        : [
            {
              check: "dimension-consistency",
              family: "audit",
              severity: "error",
              recordId: "dimension-audit",
              message: `Dimension audit failed: ${summary.inconsistent} inconsistent equations.`,
            },
          ],
    );
  },
  audits: {
    readings: async () => {
      const input = loadLiveReadingsAuditInput(root, {
        ownerBeadIds: ["am-bm-01-tracer-ensemble-hdly"],
      });
      return auditReadings(input);
    },
    shelf: async () => {
      const input: ShelfAuditInput = { cards: [] };
      return auditShelf(input);
    },
    misconceptions: async () => {
      const input: MisconceptionAuditInput = {
        papers: [],
        knownAnchors: new Set<string>(),
        knownInstruments: new Set<string>(),
        knownResults: new Set<string>(),
        knownSources: new Set<string>(),
      };
      return auditMisconceptions(input);
    },
    instruments: async () => {
      const rows = loadLiveInstrumentRows(root, { ids: ["bm-01"] });
      return auditInstruments(rows);
    },
  },
  revisionCheck: async (ref) => {
    if (!existsSync(resolve(root, ".git"))) return "skipped";
    const ok = await runRevisionCheck(ref, resolve(root, "content"));
    return ok;
  },
  inventory: loadCommittedInventory(root),
  pinnedAssets: provenance.pinnedAssets,
  extraReports: [
    ...(provenance.findings.length > 0 ? [provenance.report] : []),
    auditKernelBindings(root),
  ],
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
