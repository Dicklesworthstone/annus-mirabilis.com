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
import { auditInstruments, loadLiveInstrumentRows } from "../src/content/audits/instruments.ts";
import {
  auditMisconceptions,
  type MisconceptionAuditInput,
} from "../src/content/audits/misconceptions.ts";
import {
  auditReadings,
  type ReadingSet,
  type ReadingsAuditInput,
  type ReadingsOwnerEntry,
  type ReadingTarget,
  type ReadingTargetKind,
} from "../src/content/audits/readings.ts";
import { auditShelf, type ShelfAuditInput } from "../src/content/audits/shelf.ts";
import { type AuditFinding, type AuditReport, summarize } from "../src/content/audits/types.ts";
import {
  loadCommittedInventory,
  RULE_0_HELP,
  runVerifyContent,
} from "../src/content/audits/verifyContent.ts";
import { auditKernelBindings } from "../src/content/kernel/audit.ts";
import { loadProvenanceReceipts } from "../src/content/provenance/loadReceipts.ts";
import { TestLogger } from "../src/testing/log/logger.ts";
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

/**
 * am-unwired-audits-uwot. The readings and instruments audits used to run over ONE item each:
 * one owner file of 24, one manifest of 38. Nothing recorded that restriction as intentional and
 * nothing failed when the population grew, so a new unaudited owner or instrument was invisible.
 *
 * They now run over the whole population. Items that cannot pass yet are recorded here with a
 * reason, and an entry EXPIRES: if a listed item stops producing findings, the audit raises a
 * stale-audit-exemption error naming it, so the entry has to be deleted rather than left behind.
 * Same shape as EXPECTED_UNREACHABLE in src/testing/scriptReachability.test.ts.
 */
const READINGS_OWNERS_NOT_YET_AUDITABLE: ReadonlyMap<string, string> = new Map([]);

const INSTRUMENTS_NOT_YET_AUDITABLE: ReadonlyMap<string, string> = new Map([
  [
    "avogadro-lab",
    "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reports 5 findings against it. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
  ],
  [
    "light-thread",
    "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reports 5 findings against it. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
  ],
  [
    "lq-09",
    "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reports 3 findings against it. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
  ],
  [
    "me-01",
    "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reports 2 findings against it. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
  ],
  [
    "me-03",
    "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reports 1 finding against it. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
  ],
  [
    "shelf-fizeau",
    "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reports 5 findings against it. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
  ],
  [
    "shelf-maxwell-galilean",
    "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reports 5 findings against it. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
  ],
  [
    "shelf-michelson-morley",
    "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reports 5 findings against it. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
  ],
  [
    "sr-01",
    "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reports 2 findings against it. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
  ],
  [
    "sr-04",
    "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reports 3 findings against it. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
  ],
]);

/**
 * Downgrade findings against recorded items to flags, and raise an error for any recorded item
 * that no longer has findings. The second half is the part that matters: without it the map is a
 * suppression list that silently outlives its reason.
 */
function applyAuditExemptions(
  auditName: string,
  report: AuditReport,
  exemptions: ReadonlyMap<string, string>,
  keyOf: (finding: AuditFinding) => string | undefined,
  /** Records the audit's input held. Reported so "0 errors" cannot be read as "all of them". */
  populationTotal: number,
): AuditReport {
  const covered = new Set<string>();
  const out: AuditFinding[] = [];
  for (const finding of report.findings) {
    const key = keyOf(finding);
    const reason = key === undefined ? undefined : exemptions.get(key);
    if (key !== undefined && reason !== undefined) {
      covered.add(key);
      out.push({
        ...finding,
        severity: "flag",
        message: `${finding.message} [recorded as not yet auditable: ${reason}]`,
      });
    } else {
      out.push(finding);
    }
  }
  for (const [key, reason] of exemptions) {
    if (covered.has(key)) continue;
    out.push({
      check: "stale-audit-exemption",
      family: "audit",
      severity: "error",
      recordId: key,
      message: `${key} is recorded as not yet auditable, but the ${auditName} audit now reports nothing against it. Delete its entry and this reason: ${reason}`,
    });
  }
  return summarize(auditName, out, {
    total: populationTotal,
    judged: Math.max(0, populationTotal - exemptions.size),
    notYetAuditable: exemptions.size,
  });
}

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
        const parsed = yaml.load(readFileSync(resolve(ownersDir, name), "utf8")) as Record<
          string,
          unknown
        > | null;
        const ownerBeadId = String(
          parsed?.ownerBeadId ?? parsed?.beadId ?? name.replace(".yaml", ""),
        );
        const targetIds: string[] = [];
        const targetKinds: ReadingTargetKind[] = [];
        if (Array.isArray(parsed?.targets)) {
          for (const rawTarget of parsed.targets) {
            const t = rawTarget as Record<string, unknown>;
            const kind: ReadingTargetKind =
              t.kind === "caption" || t.captions
                ? "instrument-caption"
                : ((t.kind as ReadingTargetKind) ?? "paragraph");
            const id =
              (t.id as string | undefined) ??
              (t.instrument ? `caption-${String(t.instrument)}` : undefined);
            if (id) {
              targetIds.push(id);
              if (!targetKinds.includes(kind)) targetKinds.push(kind);
              if (t.readings) {
                targets.push({
                  targetId: id,
                  targetKind: kind,
                  paper: String(parsed.paper ?? "brownian-motion"),
                  readings: t.readings as ReadingSet,
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
      const input = loadLiveReadingsAuditInput(root);
      return applyAuditExemptions(
        "readings",
        auditReadings(input),
        READINGS_OWNERS_NOT_YET_AUDITABLE,
        (finding) => finding.ownerBeadId,
        input.owners.length,
      );
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
      const rows = loadLiveInstrumentRows(root);
      return applyAuditExemptions(
        "instruments",
        auditInstruments(rows),
        INSTRUMENTS_NOT_YET_AUDITABLE,
        (finding) => finding.recordId,
        rows.length,
      );
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

// Denominators first. An audit reporting "0 errors" says nothing about how many records it looked
// at, and both the readings and instrument audits carry a not-yet-auditable list whose entries have
// their failures downgraded to flags. These lines say how much of each subject was judged against
// the full rule, in the same form the licence inventory uses for "72 of 79".
for (const line of result.populations) console.log(line);
for (const line of result.flags) console.log(`FLAG ${line}`);
for (const line of result.skipped) console.log(line);
for (const line of result.errors) console.error(line);

// Structured log (am-uxh9). This gate decides whether content may publish and
// used to leave no artifact at all: its refusals existed only as stdout, so a
// run could not be audited after the fact and yesterday's failures were
// unrecoverable. One row per error, flag and skip, plus a summary row, so the
// record names WHICH check refused rather than only how many did.
const logger = new TestLogger("verify-content");
for (const line of result.errors) {
  logger.log({ testId: "verify-content-error", outcome: "failed", message: line });
}
for (const line of result.flags) {
  logger.log({ testId: "verify-content-flag", outcome: "passed", message: `FLAG ${line}` });
}
for (const line of result.skipped) {
  logger.log({ testId: "verify-content-skipped", outcome: "skipped", message: line });
}
for (const line of result.populations) {
  logger.log({ testId: "verify-content-population", outcome: "passed", message: line });
}
logger.log({
  testId: "verify-content-summary",
  outcome: result.ok ? "passed" : "failed",
  message:
    `verify-content ${result.ok ? "passed" : "failed"}: ` +
    `${result.errors.length} error(s), ${result.flags.length} flag(s), ${result.skipped.length} skipped.`,
});
await logger.flush();
console.log(`Structured log: ${logger.filePath}`);

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
