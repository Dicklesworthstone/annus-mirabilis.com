#!/usr/bin/env bun
/**
 * Multi-Dimensional Coverage Report CLI.
 *
 * Usage:
 *   bun scripts/coverage-report.ts [--scenario-evidence <path>] [--review-records <path>] [--outDir <dir>] [--json]
 *
 * Spec: AGENTS.md §10.4 and am-cm-coverage-ledger-0ip
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
import type { ArgumentNodeCoverage, CoverageReport } from "../src/content/coverage/types.ts";

function parseArgs(args: string[]): {
  scenarioEvidencePath?: string;
  reviewRecordsPath?: string;
  outDir: string;
  json: boolean;
  demonstration: boolean;
} {
  let scenarioEvidencePath: string | undefined;
  let reviewRecordsPath: string | undefined;
  let outDir = join(process.cwd(), "artifacts", "coverage");
  let json = false;
  let demonstration = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--scenario-evidence" && i + 1 < args.length) {
      const val = args[++i];
      if (val) scenarioEvidencePath = val;
    } else if (arg === "--review-records" && i + 1 < args.length) {
      const val = args[++i];
      if (val) reviewRecordsPath = val;
    } else if (arg === "--outDir" && i + 1 < args.length) {
      const val = args[++i];
      if (val) outDir = val;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--demonstration") {
      demonstration = true;
    }
  }

  const result: {
    scenarioEvidencePath?: string;
    reviewRecordsPath?: string;
    outDir: string;
    json: boolean;
    demonstration: boolean;
  } = { outDir, json, demonstration };
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
 * `report.inputs` records only files that were opened, each with its sha256, so an empty
 * inputs list is the report saying in its own data that it read nothing. That is the honest
 * detector here, and it is the same field the markdown renders as "Inputs: None".
 *
 * The bead reported this gate emitting "Total source units: 158 / reviewed: 158" beneath
 * "Inputs: None", from a literal in this file. 342d13da moved that fixture behind
 * --demonstration, which cleared the default path and left two things standing: the flag still
 * printed the forbidden pair, and the DEFAULT run measured nothing and exited 0 while being
 * requiredInCi. A required gate that passes having opened no file certifies nothing and reads
 * as conformance, which is the shape this sweep opened with.
 */
export function coverageWasMeasured(report: CoverageReport): boolean {
  return report.inputs.length > 0;
}

export async function runCoverageReport(args: string[]): Promise<{
  report: CoverageReport;
  jsonPath: string;
  mdPath: string;
  /** Says whether the unwired dimensions were measured, so a caller cannot read a 0 as a count. */
  provenance: string;
  unwiredDimensions: readonly string[];
}> {
  const { scenarioEvidencePath, reviewRecordsPath, outDir, json, demonstration } = parseArgs(args);

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

  // am-wdqy's sibling, found by the empty-set sweep: THESE THREE COLLECTIONS ARE LITERALS IN THIS
  // FILE. Nothing reads the content tree for them. Run with no arguments, this gate printed
  //
  //     - **Inputs:** None
  //     ## 1. Source Status
  //     Total source units: 158
  //     - reviewed: 158
  //
  // and exited 0, while registered requiredInCi with cadence every-run and required in the preview
  // and launch profiles. "Inputs: None" and "158 reviewed" are two lines apart and only one of them
  // is true. The numbers are not a measurement of this repository and never were.
  //
  // The model for the honest form is in this same file: the numerical-validation dimension already
  // reports `not-run` when its evidence is absent rather than a count of zero. These three now
  // behave the same way - they are supplied only under --demonstration, and a default run reports
  // them as not measured, with the reason.
  //
  // DELETION CONDITION: when am-cm-coverage-ledger-0ip wires real loaders for source manifests,
  // argument nodes and instruments, this fixture and the --demonstration flag go away and the
  // dimensions become measured. This bead is not that work; it is the gate not lying in the meantime.
  const demonstrationNodes: ArgumentNodeCoverage[] = [
    {
      id: "arg-bm-observable",
      paper: "brownian-motion",
      section: "s1",
      logicalRole: "premise",
      readingsPresent: ["R0", "R1", "R2", "R3"],
      treatment: {
        kind: "instrument",
        experimentIds: ["bm-01"],
        correspondenceNote: "Visualizes observable particle suspension.",
      },
      accessibilityEquivalent: {
        kind: "action-contract",
        details: "Nonvisual telemetry stepper.",
      },
      acceptanceScenarioIds: ["sc-bm-01-observable"],
    },
    {
      id: "arg-bm-diffusion-equation",
      paper: "brownian-motion",
      section: "s2",
      logicalRole: "derivation",
      readingsPresent: ["R0", "R1", "R2", "R3"],
      treatment: {
        kind: "instrument",
        experimentIds: ["bm-05"],
        correspondenceNote: "Demonstrates diffusion density progression.",
      },
      accessibilityEquivalent: {
        kind: "textual-equivalent",
        details: "Step-by-step mathematical ladder.",
      },
      acceptanceScenarioIds: ["sc-bm-05-diffusion"],
    },
    {
      id: "arg-bm-inference",
      paper: "brownian-motion",
      section: "s3",
      logicalRole: "conclusion",
      readingsPresent: ["R0", "R1", "R2", "R3"],
      treatment: {
        kind: "instrument",
        experimentIds: ["bm-06"],
        correspondenceNote: "Inference of molecular dimensions from displacement.",
      },
      acceptanceScenarioIds: ["sc-bm-06-inference"],
    },
  ];

  const demonstrationInstruments = new Map([
    [
      "bm-01",
      { id: "bm-01", provenance: "host-calculation-available" as const, paper: "brownian-motion" },
    ],
    [
      "bm-05",
      {
        id: "bm-05",
        provenance: "accepted-frankensim-result-demonstrated" as const,
        paper: "brownian-motion",
      },
    ],
    ["bm-06", { id: "bm-06", provenance: "artifact-loaded" as const, paper: "brownian-motion" }],
  ]);

  const demonstrationSourceManifests = new Map([
    [
      "brownian-motion",
      {
        paper: "brownian-motion",
        totalUnits: 158,
        byStatus: { reviewed: 158 },
      },
    ],
  ]);

  // The three unwired dimensions. Empty by default so no fabricated figure is presented as
  // coverage; the provenance block below says an empty figure here means "not measured", which is
  // the distinction a bare 0 cannot carry.
  const UNWIRED_DIMENSIONS = [
    "Source Status",
    "Argument Treatment",
    "Instrument Availability",
  ] as const;

  const context: LedgerContext = {
    argumentNodes: demonstration ? demonstrationNodes : [],
    instruments: demonstration ? demonstrationInstruments : new Map(),
    sourceManifests: demonstration ? demonstrationSourceManifests : new Map(),
    knownExperiments: demonstration ? new Set(["bm-01", "bm-05", "bm-06"]) : new Set<string>(),
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
  // report object itself cannot carry it without changing CoverageReport, which belongs to
  // am-cm-coverage-ledger-0ip; until then this line is the carrier and the limitation is stated.
  const provenance = demonstration
    ? `DEMONSTRATION RUN. ${UNWIRED_DIMENSIONS.join(", ")} are filled from a fixture in scripts/coverage-report.ts, not measured from this repository. Do not cite these figures as coverage.`
    : `NOT MEASURED: ${UNWIRED_DIMENSIONS.join(", ")} have no loader wired (am-cm-coverage-ledger-0ip), so their figures are absent rather than zero. Every other dimension below is measured from its declared input.`;

  // Counts are withheld when nothing was measured and no fixture was requested, so the
  // forbidden pair - "Inputs: None" above a populated Source Status - cannot be produced at all
  // on the default path. Under --demonstration the figures ARE printed, because that is what was
  // asked for, and main() still refuses so they cannot be cited as coverage.
  const withhold = report.inputs.length === 0 && !demonstration;
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (withhold) {
    console.log(
      `# Annus Mirabilis Multi-Dimensional Coverage Ledger\n\n- **Tool Run ID:** \`${toolRunId}\`\n- **Inputs:** None\n\nNo dimension was measured, so no figures are printed.`,
    );
  } else {
    console.log(formatCoverageMarkdown(report));
    console.log(`\nArtifacts written:\n- JSON: ${jsonPath}\n- Markdown: ${mdPath}`);
  }
  console.log(`\n${provenance}`);

  return { report, jsonPath, mdPath, provenance, unwiredDimensions: UNWIRED_DIMENSIONS };
}

/** The refusal text, as a function so a test can assert it without spawning a process. */
export function coverageRefusal(demonstration: boolean): string {
  const shared =
    "No coverage is established by this run. `--scenario-evidence <path>` and" +
    " `--review-records <path>` are the inputs this report can read today; the remaining" +
    " dimensions have no loader wired (am-cm-coverage-ledger-0ip).";
  return demonstration
    ? `REFUSED: --demonstration fills dimensions from a fixture in this script, not from the content tree. ${shared} The figures printed above are the fixture's and must never be cited as coverage.`
    : `REFUSED: this run opened no input file, so every dimension is unmeasured. ${shared}`;
}

async function main() {
  const { report, provenance } = await runCoverageReport(process.argv.slice(2));
  if (coverageWasMeasured(report)) return;

  // A run that names no inputs must not report counts as measured, and must not exit 0 while
  // required in CI. Both halves matter: the exit code is what the pipeline reads, the withheld
  // figures are what a person reads.
  console.error(`\n${coverageRefusal(process.argv.slice(2).includes("--demonstration"))}`);
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
