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
} {
  let scenarioEvidencePath: string | undefined;
  let reviewRecordsPath: string | undefined;
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
    outDir: string;
    json: boolean;
  } = { outDir, json };
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
}> {
  const { scenarioEvidencePath, reviewRecordsPath, outDir, json } = parseArgs(args);

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

  // Base sample / loaded argument nodes for standard report
  const sampleNodes: ArgumentNodeCoverage[] = [
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

  const instrumentsMap = new Map([
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

  const sourceManifestsMap = new Map([
    [
      "brownian-motion",
      {
        paper: "brownian-motion",
        totalUnits: 158,
        byStatus: { reviewed: 158 },
      },
    ],
  ]);

  const context: LedgerContext = {
    argumentNodes: sampleNodes,
    instruments: instrumentsMap,
    sourceManifests: sourceManifestsMap,
    knownExperiments: new Set(["bm-01", "bm-05", "bm-06"]),
    scenarioEvidence,
    scenarioEvidencePath,
    reviewRecords,
    reviewRecordsPath,
  };

  const toolRunId = generateToolRunId();
  const report = generateCoverageReport(context, toolRunId);
  const { jsonPath, mdPath } = writeCoverageReportArtifacts(report, outDir);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatCoverageMarkdown(report));
    console.log(`\nArtifacts written:\n- JSON: ${jsonPath}\n- Markdown: ${mdPath}`);
  }

  return { report, jsonPath, mdPath };
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
