/**
 * Multi-Dimensional Coverage Ledger Bun Test Suite.
 *
 * Spec: AGENTS.md §10.4 and am-cm-coverage-ledger-0ip
 */

import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  generateCoverageReport,
  validateCoverageLedger,
} from "../content/coverage/ledger.ts";
import type { ArgumentNodeCoverage, ExecutionProvenanceState } from "../content/coverage/types.ts";

function generateLogRunId(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const hex = randomBytes(4).toString("hex");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z-${hex}`;
}

describe("Coverage Ledger Bun Verification (am-cm-coverage-ledger-0ip)", () => {
  const rootDir = process.cwd();
  const logRunId = generateLogRunId();
  const logDir = join(rootDir, "artifacts", "test-logs", "coverage-ledger-tests");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `${logRunId}.jsonl`);

  function logTest(
    testId: string,
    outcome: "passed" | "failed",
    message: string,
    extra?: Record<string, unknown>,
  ) {
    const entry = {
      timestamp: new Date().toISOString(),
      suite: "coverage-ledger-tests",
      logRunId,
      testId,
      beadId: "am-cm-coverage-ledger-0ip",
      outcome,
      message,
      extra,
    };
    writeFileSync(logPath, `${JSON.stringify(entry)}\n`, { flag: "a", encoding: "utf8" });
  }

  it("fails when a derivation or central inference node has omitted treatment", () => {
    const derivationNode: ArgumentNodeCoverage = {
      id: "node-deriv-01",
      paper: "brownian-motion",
      section: "s2",
      logicalRole: "derivation",
      readingsPresent: ["R0", "R1"],
      treatment: { kind: "omitted", reason: "Visual too complex" },
    };
    const heuristicNode: ArgumentNodeCoverage = {
      id: "node-heur-01",
      paper: "light-quanta",
      section: "s8",
      logicalRole: "heuristic-inference",
      readingsPresent: ["R0", "R1"],
      treatment: { kind: "omitted", reason: "Skipping" },
    };

    const diagsDeriv = validateCoverageLedger({ argumentNodes: [derivationNode] });
    expect(diagsDeriv.some((d) => d.rule === "central-inference-missing-treatment")).toBe(true);

    const diagsHeur = validateCoverageLedger({ argumentNodes: [heuristicNode] });
    expect(diagsHeur.some((d) => d.rule === "central-inference-missing-treatment")).toBe(true);

    logTest(
      "derivation-central-inference-omitted-refusal",
      "passed",
      "Central inference nodes with omitted treatment refused",
    );
  });

  it("passes when non-central node has omitted treatment with a valid written reason", () => {
    const validOmittedNode: ArgumentNodeCoverage = {
      id: "node-foundation-01",
      paper: "brownian-motion",
      section: "s1",
      logicalRole: "foundation",
      readingsPresent: ["R0", "R1"],
      treatment: {
        kind: "omitted",
        reason: "Historical context adequately covered by margin notes.",
      },
    };

    const diags = validateCoverageLedger({ argumentNodes: [validOmittedNode] });
    expect(diags.length).toBe(0);

    logTest(
      "omitted-treatment-with-reason-passes",
      "passed",
      "Valid omitted treatment with reason passed",
    );
  });

  it("fails when an omitted treatment lacks a written reason", () => {
    const emptyReasonNode: ArgumentNodeCoverage = {
      id: "node-empty-01",
      paper: "brownian-motion",
      section: "s1",
      logicalRole: "premise",
      readingsPresent: ["R0"],
      treatment: { kind: "omitted", reason: "   " },
    };

    const diags = validateCoverageLedger({ argumentNodes: [emptyReasonNode] });
    expect(diags.some((d) => d.rule === "omitted-treatment-missing-reason")).toBe(true);

    logTest(
      "omitted-missing-reason-refusal",
      "passed",
      "Omitted treatment without reason rejected",
    );
  });

  it("enforces correspondence notes when two nodes share the same instrument", () => {
    const nodeA: ArgumentNodeCoverage = {
      id: "node-share-a",
      paper: "brownian-motion",
      section: "s3",
      logicalRole: "conclusion",
      readingsPresent: ["R0", "R1", "R2", "R3"],
      treatment: { kind: "instrument", experimentIds: ["bm-06"] },
    };
    const nodeB: ArgumentNodeCoverage = {
      id: "node-share-b",
      paper: "brownian-motion",
      section: "s3",
      logicalRole: "conclusion",
      readingsPresent: ["R0", "R1", "R2", "R3"],
      treatment: { kind: "instrument", experimentIds: ["bm-06"] },
    };

    const diagsWithoutNotes = validateCoverageLedger({
      argumentNodes: [nodeA, nodeB],
      knownExperiments: new Set(["bm-06"]),
    });
    expect(
      diagsWithoutNotes.filter((d) => d.rule === "shared-instrument-missing-correspondence-note")
        .length,
    ).toBe(2);

    const nodeAWithNote: ArgumentNodeCoverage = {
      ...nodeA,
      treatment: {
        kind: "instrument",
        experimentIds: ["bm-06"],
        correspondenceNote: "Visualizes Avogadro determination parameter space.",
      },
    };
    const nodeBWithNote: ArgumentNodeCoverage = {
      ...nodeB,
      treatment: {
        kind: "instrument",
        experimentIds: ["bm-06"],
        correspondenceNote: "Shows molecular diameter calculation sensitivity.",
      },
    };

    const diagsWithNotes = validateCoverageLedger({
      argumentNodes: [nodeAWithNote, nodeBWithNote],
      knownExperiments: new Set(["bm-06"]),
    });
    expect(
      diagsWithNotes.filter((d) => d.rule === "shared-instrument-missing-correspondence-note")
        .length,
    ).toBe(0);

    logTest(
      "shared-instrument-correspondence-notes-enforced",
      "passed",
      "Correspondence note requirements enforced on shared instruments",
    );
  });

  it("fails when an instrument treatment references an unknown experiment id", () => {
    const node: ArgumentNodeCoverage = {
      id: "node-unknown-exp",
      paper: "brownian-motion",
      section: "s1",
      logicalRole: "conclusion",
      readingsPresent: ["R0", "R1"],
      treatment: { kind: "instrument", experimentIds: ["unknown-999"] },
    };

    const diags = validateCoverageLedger({
      argumentNodes: [node],
      knownExperiments: new Set(["bm-01", "bm-05"]),
    });
    expect(diags.some((d) => d.rule === "unknown-experiment-id")).toBe(true);

    logTest("unknown-experiment-refusal", "passed", "Unknown experiment references rejected");
  });

  it("reports numerical validation status accurately from scenario evidence and marks not-run when omitted", () => {
    const node: ArgumentNodeCoverage = {
      id: "node-test",
      paper: "brownian-motion",
      section: "s1",
      readingsPresent: ["R0", "R1"],
      treatment: { kind: "static" },
    };

    // 1. With failing evidence
    const reportFailing = generateCoverageReport({
      argumentNodes: [node],
      scenarioEvidence: [{ scenarioId: "sc-01", status: "failed", failureMessage: "RMS error" }],
    });
    expect(reportFailing.numericalValidation.totalScenarios).toBe(1);
    expect(reportFailing.numericalValidation.byStatus.failing).toBe(1);
    expect(reportFailing.numericalValidation.scenarios["sc-01"]?.status).toBe("failing");

    // 2. Without scenario evidence -> not-run
    const reportNotRun = generateCoverageReport({
      argumentNodes: [node],
    });
    expect(reportNotRun.numericalValidation.byStatus["not-run"]).toBe(1);
    expect(reportNotRun.numericalValidation.scenarios._all_?.status).toBe("not-run");

    logTest(
      "numerical-validation-states",
      "passed",
      "Numerical validation reflects scenario evidence honestly",
    );
  });

  it("reports German source review accepted and physics review not-reviewed in distinct cells", () => {
    const report = generateCoverageReport({
      argumentNodes: [],
      reviewRecords: [
        {
          paper: "brownian-motion",
          section: "s1",
          physicsReview: "not-reviewed",
          r2Readability: "accepted",
          germanSourceReview: "accepted",
        },
      ],
    });

    const rev = report.editorialReview.reviews["brownian-motion#s1"];
    expect(rev).toBeDefined();
    expect(rev?.germanSourceReview).toBe("accepted");
    expect(rev?.physicsReview).toBe("not-reviewed");
    expect(rev?.r2Readability).toBe("accepted");

    logTest(
      "review-status-cells-distinct",
      "passed",
      "Review status cells reported distinctly",
    );
  });

  it("distinguishes artifact-loaded from accepted-frankensim-result-demonstrated", () => {
    const instruments = new Map<string, { id: string; provenance: ExecutionProvenanceState }>([
      ["inst-loaded", { id: "inst-loaded", provenance: "artifact-loaded" }],
      [
        "inst-demonstrated",
        { id: "inst-demonstrated", provenance: "accepted-frankensim-result-demonstrated" },
      ],
    ]);

    const report = generateCoverageReport({
      argumentNodes: [],
      instruments,
    });

    expect(report.instrumentAvailability.byProvenance["artifact-loaded"]).toBe(1);
    expect(
      report.instrumentAvailability.byProvenance["accepted-frankensim-result-demonstrated"],
    ).toBe(1);

    logTest(
      "execution-provenance-distinction",
      "passed",
      "Artifact loaded is distinct from accepted result demonstrated",
    );
  });

  it("strictly prohibits aggregate fields (score, percent, completeness, overall, runId) in report schema", () => {
    const report = generateCoverageReport({
      argumentNodes: [],
    });

    const forbiddenRegex = /score|percent|completeness|overall/i;
    const jsonStr = JSON.stringify(report);
    expect(forbiddenRegex.test(jsonStr)).toBe(false);

    // Top-level keys must not include runId (must be logRunId)
    const topLevelKeys = Object.keys(report);
    expect(topLevelKeys.includes("runId")).toBe(false);
    expect(topLevelKeys.includes("logRunId")).toBe(true);

    logTest("no-aggregates-enforced", "passed", "No aggregate fields permitted in report schema");
  });
});
