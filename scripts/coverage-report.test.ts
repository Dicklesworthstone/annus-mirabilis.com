import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { validateReportSchema } from "../src/content/coverage/reportSchema.test.ts";
import { runCoverageReport } from "./coverage-report.ts";

describe("Coverage Report CLI Contract (scripts/coverage-report.ts)", () => {
  const rootDir = process.cwd();
  const testOutDir = join(rootDir, "artifacts", "test-artifacts", "coverage-cli-test");

  it("CLI runs with scenario evidence, writes JSON/Markdown, and passes schema validation", async () => {
    mkdirSync(testOutDir, { recursive: true });

    // Fixture scenario evidence JSONL
    const scenarioFile = join(testOutDir, "fixture-scenarios.jsonl");
    const lines = [
      JSON.stringify({ scenarioId: "sc-bm-01-stokes", status: "passed" }),
      JSON.stringify({ scenarioId: "sc-bm-05-ftcs", status: "passed" }),
      JSON.stringify({
        scenarioId: "sc-bm-06-avogadro",
        status: "failed",
        failureMessage: "Tolerance 1e-12 exceeded",
      }),
    ];
    writeFileSync(scenarioFile, `${lines.join("\n")}\n`, "utf8");

    const { report, jsonPath, mdPath } = await runCoverageReport([
      "--scenario-evidence",
      scenarioFile,
      "--outDir",
      testOutDir,
      "--json",
    ]);

    assert.ok(report.logRunId, "Expected report to have logRunId");
    assert.equal(report.numericalValidation.totalScenarios, 3);
    assert.equal(report.numericalValidation.byStatus.passing, 2);
    assert.equal(report.numericalValidation.byStatus.failing, 1);

    // Validate no-aggregate schema
    const schemaCheck = validateReportSchema(report);
    assert.equal(
      schemaCheck.valid,
      true,
      `Schema validation failed: ${schemaCheck.errors.join(", ")}`,
    );

    // Verify written files
    assert.ok(existsSync(jsonPath), "Expected JSON file on disk");
    assert.ok(existsSync(mdPath), "Expected Markdown file on disk");

    const mdContent = readFileSync(mdPath, "utf8");
    assert.ok(mdContent.includes("Annus Mirabilis Multi-Dimensional Coverage Ledger"));
    assert.ok(mdContent.includes("Total scenarios: 3"));
    assert.ok(mdContent.includes("- passing: 2"));
    assert.ok(mdContent.includes("- failing: 1"));
  });

  it("CLI runs without scenario evidence and reports numerical validation as not-run", async () => {
    mkdirSync(testOutDir, { recursive: true });

    const { report } = await runCoverageReport(["--outDir", testOutDir, "--json"]);

    assert.ok(report.logRunId);
    assert.equal(report.numericalValidation.totalScenarios, 0);
    assert.equal(report.numericalValidation.byStatus["not-run"], 1);
    assert.equal(report.numericalValidation.scenarios._all_?.status, "not-run");

    // Validate no-aggregate schema
    const schemaCheck = validateReportSchema(report);
    assert.equal(
      schemaCheck.valid,
      true,
      `Schema validation failed: ${schemaCheck.errors.join(", ")}`,
    );
  });
});
