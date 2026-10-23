#!/usr/bin/env bun
/**
 * Multi-Dimensional Coverage Report CLI.
 *
 * Usage:
 *   bun scripts/coverage-report.ts [--scenario-evidence <path>] [--review-records <path>]
 *                                  [--root <dir>] [--outDir <dir>] [--json]
 *
 * Spec: AGENTS.md and am-cm-coverage-ledger-0ip, wired to the content tree by am-igdv.
 *
 * FIVE OF THE SEVEN DIMENSIONS ARE READ FROM `content/` ON A BARE RUN (am-igdv). Until 2026-10-23
 * none of them were: `LedgerContext` was handed an empty array and two empty maps, so a bare run --
 * which is how the gate chain invokes this step -- opened no file, printed `VACUOUS`, and refused.
 * The step is `requiredInProfiles: ["preview", "launch"]`, so neither profile could pass, whatever
 * the state of the papers. The engine was never the gap; it had nothing to compute over.
 *
 * The `--demonstration` flag and its three-node fixture are gone, per the deletion condition the
 * fixture itself carried: "when ... wires real loaders for source manifests, argument nodes and
 * instruments, this fixture and the --demonstration flag go away and the dimensions become
 * measured." The fixture described brownian-motion only, in three nodes and three instruments,
 * against a real population of 48 and 33.
 *
 * TWO DIMENSIONS STILL DEPEND ON AN EXPLICIT INPUT and still report `not-run` without it:
 * numerical validation reads `--scenario-evidence`, editorial review reads `--review-records`.
 * Those are evidence a run produces, not records in the tree, and the ledger already reports their
 * absence as `not-run` rather than as a count of zero -- which is the honest form the three unwired
 * dimensions were modelled on in the first place.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatCoverageMarkdown,
  generateCoverageReport,
  generateToolRunId,
  type LedgerContext,
  writeCoverageReportArtifacts,
} from "../src/content/coverage/ledger.ts";
import { loadCoverageFromContent } from "../src/content/coverage/loaders.ts";
import type { CoverageReport } from "../src/content/coverage/types.ts";
import { reportPopulation } from "./gate-census/population.ts";

/** The dimensions that need an explicit evidence file, named so a zero is never read as a count. */
const EVIDENCE_FED_DIMENSIONS = ["Numerical Validation", "Editorial Review"] as const;

function parseArgs(args: string[]): {
  scenarioEvidencePath?: string;
  reviewRecordsPath?: string;
  root: string;
  outDir: string;
  json: boolean;
} {
  let scenarioEvidencePath: string | undefined;
  let reviewRecordsPath: string | undefined;
  let root = process.cwd();
  let outDir = join(process.cwd(), "artifacts", "coverage");
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--scenario-evidence" && i + 1 < args.length) {
      const val = args[++i];
      if (val) scenarioEvidencePath = val;
    } else if (arg === "--review-records" && i + 1 < args.length) {
      const val = args[++i];
      if (val) reviewRecordsPath = val;
    } else if (arg === "--root" && i + 1 < args.length) {
      const val = args[++i];
      if (val) root = resolve(val);
    } else if (arg === "--outDir" && i + 1 < args.length) {
      const val = args[++i];
      if (val) outDir = val;
    } else if (arg === "--json") {
      json = true;
    }
  }

  const result: {
    scenarioEvidencePath?: string;
    reviewRecordsPath?: string;
    root: string;
    outDir: string;
    json: boolean;
  } = { root, outDir, json };
  if (scenarioEvidencePath !== undefined) {
    result.scenarioEvidencePath = scenarioEvidencePath;
  }
  if (reviewRecordsPath !== undefined) {
    result.reviewRecordsPath = reviewRecordsPath;
  }
  return result;
}

/**
 * Did this run measure anything at all (am-9n4g)?
 *
 * `report.inputs` records only files that were opened, each with its sha256, so an empty inputs list
 * is the report saying in its own data that it read nothing. That is the honest detector here, and it
 * is the same field the markdown renders as "Inputs: None".
 *
 * The bead reported this gate emitting "Total source units: 158 / reviewed: 158" beneath
 * "Inputs: None", from a literal in this file. 342d13da moved that fixture behind --demonstration,
 * which cleared the default path and left two things standing: the flag still printed the forbidden
 * pair, and the DEFAULT run measured nothing and exited 0 while being requiredInCi. A required gate
 * that passes having opened no file certifies nothing and reads as conformance. Both halves are now
 * answered by the loaders rather than by a refusal: the default run opens about 900 files.
 */
export function coverageWasMeasured(report: CoverageReport): boolean {
  return report.inputs.length > 0;
}

export async function runCoverageReport(args: string[]): Promise<{
  report: CoverageReport;
  jsonPath: string;
  mdPath: string;
  /** Says which dimensions still await an evidence file, so a caller cannot read a 0 as a count. */
  provenance: string;
  evidenceFedDimensions: readonly string[];
  /** Any content dimension whose population fell below its floor, as readable lines. */
  shortfalls: readonly string[];
}> {
  const { scenarioEvidencePath, reviewRecordsPath, root, outDir, json } = parseArgs(args);

  let scenarioEvidence:
    | { scenarioId: string; status: "passed" | "failed" | "skipped"; failureMessage?: string }[]
    | undefined;
  if (scenarioEvidencePath && existsSync(scenarioEvidencePath)) {
    const content = readFileSync(scenarioEvidencePath, "utf8");
    scenarioEvidence = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  let reviewRecords:
    | {
        paper: string;
        section: string;
        physicsReview?: import("../src/content/coverage/types.ts").EditorialReviewStatus;
        r2Readability?: import("../src/content/coverage/types.ts").EditorialReviewStatus;
        germanSourceReview?: import("../src/content/coverage/types.ts").EditorialReviewStatus;
      }[]
    | undefined;
  if (reviewRecordsPath && existsSync(reviewRecordsPath)) {
    const content = readFileSync(reviewRecordsPath, "utf8");
    reviewRecords = JSON.parse(content);
  }

  const loaded = loadCoverageFromContent(root);

  const context: LedgerContext = {
    argumentNodes: loaded.argumentNodes,
    instruments: loaded.instruments,
    sourceManifests: loaded.sourceManifests,
    translationUnits: loaded.translationUnits,
    knownExperiments: loaded.knownExperiments,
    openedInputs: loaded.opened,
    scenarioEvidence,
    scenarioEvidencePath,
    reviewRecords,
    reviewRecordsPath,
  };

  const toolRunId = generateToolRunId();
  const report = generateCoverageReport(context, toolRunId);
  const { jsonPath, mdPath } = writeCoverageReportArtifacts(report, outDir);

  // The provenance block goes to stdout in BOTH modes, because a JSON consumer reading
  // sourceStatus.totalUnits has the same right to know whether that figure was measured. The
  // CoverageReport type cannot carry it without a change that belongs to the ledger's own bead, so
  // under --json it rides as a `provenance` field of the printed object. It used to follow the JSON
  // as a bare line, which made --json output unparseable.
  const missing = EVIDENCE_FED_DIMENSIONS.filter((d) =>
    d === "Numerical Validation" ? scenarioEvidence === undefined : reviewRecords === undefined,
  );
  const provenance =
    missing.length === 0
      ? "Every dimension below is measured from its declared input; the content dimensions are read from the tree at --root and each file opened is listed with its digest."
      : `MEASURED FROM THE TREE: source status, translation review, argument treatment, instrument availability and accessibility equivalence, each over the files listed above with their digests. NOT MEASURED: ${missing.join(", ")} report not-run because no evidence file was given (--scenario-evidence, --review-records); that is an absence, not a zero.`;

  if (json) {
    console.log(JSON.stringify({ ...report, provenance, shortfalls: loaded.shortfalls }, null, 2));
  } else {
    console.log(formatCoverageMarkdown(report));
    console.log(`\nArtifacts written:\n- JSON: ${jsonPath}\n- Markdown: ${mdPath}`);
    /*
      THE PER-INSTRUMENT RULE THAT FIRED, printed because this dimension is the one a reader is most
      likely to take on trust. AGENTS.md: "A loaded WASM file does not earn the FrankenSim label."
      Each line names the file the loader read to decide the state, so the state can be checked
      rather than believed, and so a mapping that drifts is visible in the output instead of only in
      a diff.
    */
    console.log("\n## Instrument provenance, with the evidence for each state\n");
    for (const inst of [...loaded.instruments.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      console.log(`- \`${inst.id}\` ${inst.provenance} -- ${inst.evidence}`);
    }
  }
  if (!json) console.log(`\n${provenance}`);

  return {
    report,
    jsonPath,
    mdPath,
    provenance,
    evidenceFedDimensions: EVIDENCE_FED_DIMENSIONS,
    shortfalls: loaded.shortfalls,
  };
}

/** The refusal text, as a function so a test can assert it without spawning a process. */
export function coverageRefusal(shortfalls: readonly string[]): string {
  if (shortfalls.length > 0) {
    return (
      `REFUSED: a content dimension found less than its floor (${shortfalls.join("; ")}). ` +
      "A dimension that reads nothing reports exactly like a dimension that is complete, so this " +
      "run establishes no coverage. Check that --root names the repository root and that content/ " +
      "is present; the floors are in src/content/coverage/loaders.ts (COVERAGE_FLOORS)."
    );
  }
  return (
    "REFUSED: this run opened no input file, so every dimension is unmeasured. No coverage is " +
    "established by this run. The content dimensions read content/source-blocks, " +
    "content/translation-units, content/experiments and content/arguments under --root; " +
    "numerical validation and editorial review read --scenario-evidence and --review-records."
  );
}

async function main() {
  const { report, provenance, shortfalls } = await runCoverageReport(process.argv.slice(2));
  // Read from argv rather than threaded out of runCoverageReport, so this stays a presentation
  // decision in main and the reporting function keeps its shape.
  const printsJson = process.argv.slice(2).includes("--json");

  /*
    THE POPULATION, IN THE CENSUS'S ONE GRAMMAR (am-rc1001-bridge-plan-pcjk.9).

    `report.inputs` records only files that were OPENED, each with its sha256, so the count is the
    honest population and not a restatement of the verdict.

    THE MINIMUM IS 1 AND STAYS 1, now that a bare run measures. The real floors are per-dimension and
    live with the loaders (COVERAGE_FLOORS), because the failure worth catching is not "no file at
    all" -- which a 1 would catch -- but one dimension going quietly empty while the others carry the
    census over the line. A single number over four populations cannot see that, so it is not asked
    to: the shortfall list below refuses on any dimension individually.

    The registry's note that "as registered, this gate cannot pass" was true from 2026-10-08 until
    2026-10-23 and is no longer: the bare command the registry runs now opens the content tree.
  */
  // Under --json the census goes to stderr: stdout is the report a caller parses, and a line
  // after it makes the output unparseable. parsePopulationLines reads a gate's combined output,
  // so the census is still read where it matters.
  reportPopulation(
    {
      gate: "coverage-report",
      examined: report.inputs.length,
      noun: "input files",
      minimum: 1,
    },
    printsJson ? "stderr" : "stdout",
  );

  if (coverageWasMeasured(report) && shortfalls.length === 0) return;

  // A run that names no inputs must not report counts as measured, and must not exit 0 while
  // required in CI. Both halves matter: the exit code is what the pipeline reads, the withheld
  // figures are what a person reads.
  console.error(`\n${coverageRefusal(shortfalls)}`);
  console.error(provenance);
  process.exit(1);
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("coverage-report.ts") ||
    resolve(process.argv[1]) === fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    console.error("Fatal error in coverage report CLI:", err);
    process.exit(1);
  });
}
