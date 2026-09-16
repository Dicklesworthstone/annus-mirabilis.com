/**
 * Coverage Ledger Unit and Integration Tests.
 *
 * Spec: AGENTS.md §10.4 and am-cm-coverage-ledger-0ip
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { generateCoverageReport, validateCoverageLedger } from "./ledger.ts";
import type { ArgumentNodeCoverage } from "./types.ts";

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

describe("Coverage Ledger Validation and Computation Suite", () => {
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

  it("planted negative: derivation node lacking treatment (omitted) fails central-inference-missing-treatment", () => {
    const nodes: ArgumentNodeCoverage[] = [
      {
        id: "arg-deriv-01",
        paper: "brownian-motion",
        section: "s2",
        logicalRole: "derivation",
        readingsPresent: ["R0", "R1"],
        treatment: {
          kind: "omitted",
          reason: "Too complex to visualize",
        },
      },
    ];

    const diags = validateCoverageLedger({ argumentNodes: nodes });
    const missingTreatment = diags.find((d) => d.rule === "central-inference-missing-treatment");
    assert.ok(missingTreatment, "Expected central-inference-missing-treatment diagnostic");
    assert.equal(missingTreatment.argumentId, "arg-deriv-01");
    logTest(
      "planted-central-inference-missing-treatment",
      "passed",
      "Derivation node with omitted treatment rejected",
    );
  });

  it("planted negative: omitted treatment without written reason fails omitted-treatment-missing-reason", () => {
    const nodes: ArgumentNodeCoverage[] = [
      {
        id: "arg-premise-01",
        paper: "brownian-motion",
        section: "s1",
        logicalRole: "premise",
        readingsPresent: ["R0"],
        treatment: {
          kind: "omitted",
          reason: "", // Empty reason
        },
      },
    ];

    const diags = validateCoverageLedger({ argumentNodes: nodes });
    const missingReason = diags.find((d) => d.rule === "omitted-treatment-missing-reason");
    assert.ok(missingReason, "Expected omitted-treatment-missing-reason diagnostic");
    logTest(
      "planted-omitted-missing-reason",
      "passed",
      "Omitted treatment without written reason rejected",
    );
  });

  it("verifies omitted treatment with a valid written reason passes for non-central nodes", () => {
    const nodes: ArgumentNodeCoverage[] = [
      {
        id: "arg-historical-note",
        paper: "brownian-motion",
        section: "s1",
        logicalRole: "foundation",
        readingsPresent: ["R0", "R1"],
        treatment: {
          kind: "omitted",
          reason:
            "Historical context note; static prose in margin suffices without interactive simulation.",
        },
      },
    ];

    const diags = validateCoverageLedger({ argumentNodes: nodes });
    assert.equal(diags.length, 0, "Valid omitted treatment with reason must pass");
    logTest("omitted-with-reason-passes", "passed", "Omitted treatment with written reason passes");
  });

  it("verifies two nodes sharing BM-06 fail without correspondence notes and pass with them", () => {
    // 1. Without correspondence notes -> fails
    const nodesWithoutNotes: ArgumentNodeCoverage[] = [
      {
        id: "arg-bm-node-a",
        paper: "brownian-motion",
        section: "s3",
        logicalRole: "conclusion",
        readingsPresent: ["R0", "R1", "R2", "R3"],
        treatment: {
          kind: "instrument",
          experimentIds: ["bm-06"],
          // Missing correspondenceNote
        },
      },
      {
        id: "arg-bm-node-b",
        paper: "brownian-motion",
        section: "s3",
        logicalRole: "conclusion",
        readingsPresent: ["R0", "R1", "R2", "R3"],
        treatment: {
          kind: "instrument",
          experimentIds: ["bm-06"],
          // Missing correspondenceNote
        },
      },
    ];

    const diagsFail = validateCoverageLedger({
      argumentNodes: nodesWithoutNotes,
      knownExperiments: new Set(["bm-06"]),
    });
    const sharedDiags = diagsFail.filter(
      (d) => d.rule === "shared-instrument-missing-correspondence-note",
    );
    assert.equal(
      sharedDiags.length,
      2,
      "Expected 2 shared-instrument-missing-correspondence-note diagnostics",
    );

    // 2. With correspondence notes -> passes
    const nodesWithNotes: ArgumentNodeCoverage[] = [
      {
        id: "arg-bm-node-a",
        paper: "brownian-motion",
        section: "s3",
        logicalRole: "conclusion",
        readingsPresent: ["R0", "R1", "R2", "R3"],
        treatment: {
          kind: "instrument",
          experimentIds: ["bm-06"],
          correspondenceNote: "Shows parameter sensitivity on Avogadro number determination.",
        },
      },
      {
        id: "arg-bm-node-b",
        paper: "brownian-motion",
        section: "s3",
        logicalRole: "conclusion",
        readingsPresent: ["R0", "R1", "R2", "R3"],
        treatment: {
          kind: "instrument",
          experimentIds: ["bm-06"],
          correspondenceNote: "Visualizes molecular radius bounds derived from displacement.",
        },
      },
    ];

    const diagsPass = validateCoverageLedger({
      argumentNodes: nodesWithNotes,
      knownExperiments: new Set(["bm-06"]),
    });
    assert.equal(
      diagsPass.filter((d) => d.rule === "shared-instrument-missing-correspondence-note").length,
      0,
      "Shared instrument with correspondence notes must pass",
    );
    logTest(
      "shared-instrument-correspondence-notes",
      "passed",
      "Shared instrument correspondence notes enforced",
    );
  });

  it("verifies numerical validation reflects scenario evidence (passing, failing, not-run)", () => {
    const nodes: ArgumentNodeCoverage[] = [
      {
        id: "arg-bm-01",
        paper: "brownian-motion",
        section: "s1",
        readingsPresent: ["R0", "R1"],
        treatment: { kind: "static" },
      },
    ];

    // 1. With failing scenario in evidence
    const failingEvidence = [
      {
        scenarioId: "sc-bm-01",
        status: "failed" as const,
        failureMessage: "Root mean square deviation exceeded tolerance",
      },
    ];
    const reportFailing = generateCoverageReport({
      argumentNodes: nodes,
      scenarioEvidence: failingEvidence,
    });

    assert.equal(reportFailing.numericalValidation.totalScenarios, 1);
    assert.equal(reportFailing.numericalValidation.byStatus.failing, 1);
    assert.equal(reportFailing.numericalValidation.scenarios["sc-bm-01"]?.status, "failing");
    assert.equal(
      reportFailing.numericalValidation.scenarios["sc-bm-01"]?.reason,
      "Root mean square deviation exceeded tolerance",
    );

    // Other dimensions are unaffected
    assert.equal(reportFailing.argumentTreatment.totalNodes, 1);
    assert.equal(reportFailing.argumentTreatment.byKind.static, 1);

    // 2. Without scenario evidence -> reports not-run
    const reportNotRun = generateCoverageReport({
      argumentNodes: nodes,
    });
    assert.equal(reportNotRun.numericalValidation.byStatus["not-run"], 1);
    assert.equal(reportNotRun.numericalValidation.scenarios._all_?.status, "not-run");
    assert.ok(
      reportNotRun.numericalValidation.scenarios._all_?.reason?.includes("No scenario evidence"),
    );

    logTest(
      "numerical-validation-evidence",
      "passed",
      "Numerical validation reports failing and not-run states honestly",
    );
  });

  it("verifies German source review accepted and physics review not-reviewed reported in separate cells", () => {
    const reviewRecords = [
      {
        paper: "brownian-motion",
        section: "s1",
        physicsReview: "not-reviewed" as const,
        r2Readability: "accepted" as const,
        germanSourceReview: "accepted" as const,
      },
    ];

    const report = generateCoverageReport({
      argumentNodes: [],
      reviewRecords,
    });

    assert.equal(report.editorialReview.totalReviews, 1);
    const review = report.editorialReview.reviews["brownian-motion#s1"];
    assert.ok(review);
    assert.equal(review.germanSourceReview, "accepted");
    assert.equal(review.physicsReview, "not-reviewed");
    assert.equal(review.r2Readability, "accepted");

    logTest(
      "editorial-review-cells",
      "passed",
      "German source review accepted and physics review not-reviewed kept in separate cells",
    );
  });

  it("verifies artifact-loaded is distinct from accepted-frankensim-result-demonstrated", () => {
    const instruments = new Map([
      ["inst-loaded", { id: "inst-loaded", provenance: "artifact-loaded" as const }],
      [
        "inst-demonstrated",
        { id: "inst-demonstrated", provenance: "accepted-frankensim-result-demonstrated" as const },
      ],
    ]);

    const report = generateCoverageReport({
      argumentNodes: [],
      instruments,
    });

    assert.equal(report.instrumentAvailability.totalInstruments, 2);
    assert.equal(report.instrumentAvailability.byProvenance["artifact-loaded"], 1);
    assert.equal(
      report.instrumentAvailability.byProvenance["accepted-frankensim-result-demonstrated"],
      1,
    );
    assert.equal(
      report.instrumentAvailability.instruments["inst-loaded"]?.provenance,
      "artifact-loaded",
    );
    assert.equal(
      report.instrumentAvailability.instruments["inst-demonstrated"]?.provenance,
      "accepted-frankensim-result-demonstrated",
    );

    logTest(
      "instrument-provenance-distinction",
      "passed",
      "artifact-loaded and accepted-frankensim-result-demonstrated are distinct",
    );
  });

  it("registers coverage check plugin with family 'coverage' and runs in compiler check pass", async () => {
    const { listRegisteredChecks } = await import("../compiler/checks/registry.ts");
    const { COVERAGE_CHECK_ID, registerCoverageCheck } = await import("./check.ts");

    registerCoverageCheck();
    const checks = listRegisteredChecks();
    const coverageCheck = checks.find((c) => c.id === COVERAGE_CHECK_ID);
    assert.ok(coverageCheck, "Expected coverage check to be registered");
    assert.equal(coverageCheck.family, "coverage");
    assert.equal(coverageCheck.beadId, "am-cm-coverage-ledger-0ip");

    const reports: unknown[] = [];
    const validNode: ArgumentNodeCoverage = {
      id: "arg-01",
      paper: "brownian-motion",
      section: "s1",
      readingsPresent: ["R0", "R1"],
      treatment: { kind: "static" },
    };

    coverageCheck.run({
      records: new Map([["arg-01", validNode]]),
      files: [],
      indexes: {},
      report: (diag) => reports.push(diag),
    });

    assert.equal(reports.length, 0, "Valid argument node produces zero check reports");
    logTest(
      "check-plugin-registration",
      "passed",
      "Coverage ledger compiler check plugin verified",
    );
  });

  it("CLI scripts/coverage-report.ts executes and writes valid JSON and Markdown artifacts", async () => {
    const { execSync } = await import("node:child_process");
    const { existsSync, readFileSync } = await import("node:fs");

    const fixtureDir = join(rootDir, "artifacts", "test-fixtures", "coverage-cli");
    mkdirSync(fixtureDir, { recursive: true });

    // Create scenario evidence fixture JSONL
    const scenarioEvidenceFile = join(fixtureDir, "scenario-evidence.jsonl");
    const scenarioLines = [
      JSON.stringify({ scenarioId: "sc-bm-01", status: "passed" }),
      JSON.stringify({ scenarioId: "sc-bm-05", status: "passed" }),
      JSON.stringify({
        scenarioId: "sc-bm-06",
        status: "failed",
        failureMessage: "Tolerance failure",
      }),
    ].join("\n");
    writeFileSync(scenarioEvidenceFile, `${scenarioLines}\n`, "utf8");

    // Execute CLI with --json and --scenario-evidence
    const outDir = join(fixtureDir, "out");
    const jsonOutput = execSync(
      `bun scripts/coverage-report.ts --scenario-evidence "${scenarioEvidenceFile}" --outDir "${outDir}" --json`,
      { cwd: rootDir, encoding: "utf8" },
    );

    const parsed = JSON.parse(jsonOutput);
    assert.ok(parsed.logRunId);
    assert.equal(parsed.numericalValidation.totalScenarios, 3);
    assert.equal(parsed.numericalValidation.byStatus.passing, 2);
    assert.equal(parsed.numericalValidation.byStatus.failing, 1);
    assert.equal(parsed.inputs.length, 1);
    assert.equal(parsed.inputs[0]?.kind, "scenario-evidence");

    // Verify written artifacts
    const jsonArtifact = join(outDir, `${parsed.logRunId}.json`);
    const mdArtifact = join(outDir, `${parsed.logRunId}.md`);
    assert.ok(existsSync(jsonArtifact), "Expected JSON artifact to exist");
    assert.ok(existsSync(mdArtifact), "Expected Markdown artifact to exist");

    const mdContent = readFileSync(mdArtifact, "utf8");
    assert.ok(mdContent.includes("Annus Mirabilis Multi-Dimensional Coverage Ledger"));
    assert.ok(mdContent.includes("Numerical Validation"));

    logTest(
      "cli-coverage-report-execution",
      "passed",
      "CLI successfully runs with evidence and emits valid JSON/Markdown artifacts",
    );
  });
});
