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
  loadLiveMisconceptionInput,
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
import { SLICE_KERNEL_CATALOG } from "../src/content/kernel/catalog.ts";
import { loadProvenanceReceipts } from "../src/content/provenance/loadReceipts.ts";
import { TestLogger } from "../src/testing/log/logger.ts";
import { runArchitectureGateCli } from "./app-router-architecture.ts";
import { mainAuditDimensions } from "./audit-dimensions.ts";
import { loadReadingFiles } from "./build-content.ts";
import { runRevisionCheck } from "./check-revisions.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function printHelp(): void {
  console.log(`Usage: bun scripts/verify-content.ts [--base <ref>] [--require-local] [--all-instruments] [--help]

Runs the architecture gate, the content compiler with every registered check,
audit-dimensions, the four content audits (readings, shelf, misconceptions, instruments),
check-revisions (skipped when no --base and no git base ref exist), and pinned-asset presence.

${RULE_0_HELP}

The standalone voice-lint quality-gate step is folded into this command as
the registered check family "voice".

--all-instruments compiles every manifest under content/experiments instead of the
three the compiler's checks see by default, which is what the live-term half of the
kernel-binding check runs over. It reports 68 errors on 2026-09-28 and is therefore
not the default; the count it has to reach is zero (am-1nnj).
`);
}

function parseArgs(argv: string[]): {
  help: boolean;
  baseRef?: string;
  requireLocal: boolean;
  skipArchitecture: boolean;
  allInstruments: boolean;
} {
  let help = false;
  let baseRef: string | undefined;
  let requireLocal = false;
  let skipArchitecture = false;
  let allInstruments = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--require-local") requireLocal = true;
    else if (arg === "--skip-architecture") skipArchitecture = true;
    else if (arg === "--all-instruments") allInstruments = true;
    else if (arg === "--base" && argv[i + 1]) {
      baseRef = argv[i + 1];
      i += 1;
    }
  }
  return {
    help,
    requireLocal,
    skipArchitecture,
    allInstruments,
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

/**
 * How many identifier bindings each source carries, and how many both carry (am-1nnj, dispatch 358).
 *
 * This is a REPORT, not a gate. It exists because a binding is written twice, in a manifest's
 * `owner.identifierBindings` and in SLICE_KERNEL_CATALOG, and the second is the one verify.ts turns
 * into src/generated/kernel-listings.json and therefore the one that colours a symbol for a reader.
 * The two drift, in both directions, and a single total would hide that.
 */
function bindingSourceSplit(files: readonly { path: string; text: string }[]): {
  manifestOnly: number;
  both: number;
  catalogueOnly: number;
} {
  const key = (instrumentId: string, b: { kernelFunction: string; quantityId: string }) =>
    `${instrumentId}|${b.kernelFunction}|${b.quantityId}`;
  const manifest = new Set<string>();
  for (const file of files) {
    const doc = yaml.load(file.text) as {
      id?: string;
      owner?: { identifierBindings?: readonly { kernelFunction: string; quantityId: string }[] };
    };
    const id = doc?.id ?? file.path.replace(/^experiments\/|\.yaml$/g, "");
    for (const b of doc?.owner?.identifierBindings ?? []) manifest.add(key(id, b));
  }
  // The catalogue side is scoped to the instruments actually compiled. Comparing three manifests
  // against all thirty-three catalogue entries reported "329 catalogue only", which is true of the
  // catalogue and says nothing about the population this run examined.
  const compiled = new Set(files.map((f) => f.path.replace(/^experiments\/|\.yaml$/g, "")));
  const catalogue = new Set<string>();
  for (const entry of SLICE_KERNEL_CATALOG) {
    if (!compiled.has(entry.instrumentId)) continue;
    for (const b of entry.identifierBindings) catalogue.add(key(entry.instrumentId, b));
  }
  let both = 0;
  for (const k of manifest) if (catalogue.has(k)) both += 1;
  return { manifestOnly: manifest.size - both, both, catalogueOnly: catalogue.size - both };
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
    // WHICH MANIFESTS THE COMPILER'S CHECKS SEE, AND WHY THE DEFAULT IS STILL THREE (am-1nnj).
    //
    // loadReadingFiles skips every .yaml, so it contributes NO experiment manifests and this loop
    // is the whole population of instruments the compiler's checks ever see. bm-01, bm-05 and
    // bm-06 are that population by default, which means runKernelIdentifierCheck's live-term
    // assertion is silent on the other thirty. A 0 from a check that opened three records reads
    // exactly like a 0 from one that opened thirty-three, which is why the count is printed.
    //
    // WHY THE DEFAULT DID NOT FLIP ON 2026-09-28, measured rather than assumed. Three panes bound
    // 119 live terms across the four papers (8cd4d69b, 1b6a5d8c, 740aa1bf) so that the widening
    // could land green. Run with --all-instruments on that tree it does not: 68 errors, of which
    // 40 are live-term-unbound and 28 are two families the narrow population had never reached,
    // dangling-independent-reference and unregistered-trace-scenario. Flipping the default would
    // turn this gate red for every pane, and the standing instruction is that the widening lands
    // only when the count is zero. So the population is reachable with one flag, the census is
    // printed on every run, and the number that has to reach zero is a command anyone can repeat
    // rather than a measurement living in one agent's scratchpad.
    //
    // THE CENSUS BELOW IS REPORTED, NOT ASSERTED. A binding is written in two places, the manifest
    // and SLICE_KERNEL_CATALOG, and the second is what colours a symbol for a reader. The live-term
    // check reads the union of both (src/content/kernel/check.ts), so the split is printed here to
    // keep the drift visible rather than resolved into one total nobody can decompose.
    const onDisk = readdirSync(resolve(root, "content/experiments"))
      .filter((f) => f.endsWith(".yaml"))
      .sort();
    const chosen = args.allInstruments ? onDisk : ["bm-01.yaml", "bm-05.yaml", "bm-06.yaml"];
    for (const file of chosen) {
      const full = resolve(root, "content/experiments", file);
      if (!existsSync(full)) continue;
      experimentFiles.push({ path: `experiments/${file}`, text: readFileSync(full, "utf8") });
    }
    const split = bindingSourceSplit(experimentFiles);
    console.log(
      `[verify-content] ${experimentFiles.length} of ${onDisk.length} experiment manifests ` +
        `compiled, so the live-term check is silent on ${onDisk.length - experimentFiles.length} ` +
        `instruments (am-1nnj; --all-instruments compiles every one)`,
    );
    console.log(
      `[verify-content] identifier bindings by source over those ${experimentFiles.length}: ` +
        `${split.manifestOnly} manifest only, ${split.both} in both, ${split.catalogueOnly} ` +
        `catalogue only; the live-term check reads the union`,
    );
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
      // The ledgers as they are on disk (am-8gbg). This passed `papers: []` and four empty sets
      // until 2026-09-27 while content/misconceptions held 26 records, so every check ran over
      // nothing and reported green. The count is printed beside the verdict because "0 errors" over
      // an empty input and "0 errors" over 26 records read identically.
      const live = loadLiveMisconceptionInput(root);
      console.log(
        `[audit-misconceptions] ${live.entries} ledger records in ${live.input.papers.length} papers; ` +
          `${live.input.knownAnchors.size} anchors, ${live.input.knownResults.size} results and ` +
          `${live.input.knownInstruments.size} instruments to resolve against; ` +
          `${live.unjudgedSources} prose citations not judged (the check resolves ids, the records carry prose).`,
      );
      return auditMisconceptions(live.input);
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
