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

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatCoverageMarkdown(report));
    console.log(`\nArtifacts written:\n- JSON: ${jsonPath}\n- Markdown: ${mdPath}`);
  }
  console.log(`\n${provenance}`);

  return { report, jsonPath, mdPath, provenance, unwiredDimensions: UNWIRED_DIMENSIONS };
}

async function main() {
  await runCoverageReport(process.argv.slice(2));
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
