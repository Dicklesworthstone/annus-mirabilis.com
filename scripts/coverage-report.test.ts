/**
 * THE COVERAGE-REPORT CLI CONTRACT.
 *
 * This file was written for am-9n4g, which found a required CI gate printing
 *
 *     - **Inputs:** None
 *     ## 1. Source Status
 *     Total source units: 158
 *     - reviewed: 158
 *
 * from three literals in its own script, and exiting 0. Its assertions therefore pinned the state
 * that answered that defect: the default run opens no file, produces no figure, and refuses.
 *
 * am-igdv wired the loaders, so the default run now opens about 900 files and measures five of the
 * seven dimensions. The old assertions were pinning the ABSENCE as the contract, and absence was
 * only ever the honest interim. What am-9n4g actually established is narrower and permanent, and it
 * is what this file keeps:
 *
 *   1. No figure appears without a file behind it. Tested the hard way, with an empty root: every
 *      content dimension reads 0 AND the run is refused, so the two cannot come apart again.
 *   2. The forbidden pair -- "Inputs: None" above a populated Source Status -- is unproducible.
 *   3. THE CONTROL, which the bead named explicitly as the thing that must not be sacrificed: a
 *      populated run still reports its figures. Without it, "always refuse" would satisfy 1 and 2.
 *
 * And it adds the proposition the wiring is responsible for: a bare run measures the tree, and one
 * dimension going quiet is refused even while the others are full.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { COVERAGE_FLOORS } from "../src/content/coverage/loaders.ts";
import { validateReportSchema } from "../src/content/coverage/reportSchema.test.ts";
import { coverageRefusal, coverageWasMeasured, runCoverageReport } from "./coverage-report.ts";

describe("Coverage Report CLI Contract (scripts/coverage-report.ts)", () => {
  const rootDir = process.cwd();
  const testOutDir = join(rootDir, "artifacts", "test-artifacts", "coverage-cli-test");
  const emptyRoot = () => mkdtempSync(join(tmpdir(), "coverage-empty-root-"));

  it("a run that opens no input file is NOT measured, and every figure is 0 (am-9n4g)", async () => {
    const { report, shortfalls } = await runCoverageReport([
      "--root",
      emptyRoot(),
      "--outDir",
      testOutDir,
    ]);
    assert.equal(report.inputs.length, 0, "a root with no content/ opens no file");
    assert.equal(coverageWasMeasured(report), false);
    // The two halves together: unmeasured AND zero. The defect was that they came apart.
    assert.equal(report.sourceStatus.totalUnits, 0);
    assert.equal(report.translationReview.totalUnits, 0);
    assert.equal(report.argumentTreatment.totalNodes, 0);
    assert.equal(report.instrumentAvailability.totalInstruments, 0);
    assert.equal(shortfalls.length, 4, shortfalls.join("; "));
  });

  it("the forbidden pair is unproducible: no populated figure above an empty inputs line", async () => {
    const { report, mdPath } = await runCoverageReport([
      "--root",
      emptyRoot(),
      "--outDir",
      testOutDir,
    ]);
    const md = readFileSync(mdPath, "utf8");
    assert.match(md, /\*\*Inputs:\*\* None/);
    // Whatever the dimensions print, none of them may print a count beneath that line.
    assert.match(md, /Total source units: none measured\./);
    assert.match(md, /Total argument nodes: none measured\./);
    assert.equal(md.includes("Total source units: 158"), false, "the retired fixture's own figure");
    assert.equal(report.inputs.length, 0);
  });

  it("the refusal names the floors and the trees it reads, so a reader can repair it", () => {
    const refusal = coverageRefusal([]);
    assert.match(refusal, /^REFUSED: this run opened no input file/);
    assert.match(refusal, /content\/source-blocks/);
    assert.match(refusal, /content\/translation-units/);
    assert.match(refusal, /content\/experiments/);
    assert.match(refusal, /content\/arguments/);
    assert.match(refusal, /--scenario-evidence/);
    assert.match(refusal, /--review-records/);

    const shortfall = coverageRefusal(["argument nodes: 0 found, minimum 40"]);
    assert.match(shortfall, /a content dimension found less than its floor/);
    assert.match(shortfall, /argument nodes: 0 found, minimum 40/);
    // Names where the floors live rather than leaving the number unattributable.
    assert.match(shortfall, /COVERAGE_FLOORS/);
  });

  it("THE CONTROL: a bare run measures the tree, over files it names with digests", async () => {
    // Without this the change could have been "always refuse", which satisfies every negative
    // above and makes the gate unsatisfiable -- the thing am-9n4g forbade as a way to close it.
    const { report, shortfalls, provenance } = await runCoverageReport([
      "--outDir",
      testOutDir,
      "--json",
    ]);
    assert.equal(coverageWasMeasured(report), true);
    assert.deepEqual(shortfalls, [], "the real tree must satisfy every floor");

    const byKind = new Map<string, number>();
    for (const input of report.inputs) byKind.set(input.kind, (byKind.get(input.kind) ?? 0) + 1);
    assert.ok(
      (byKind.get("source-manifest") ?? 0) >= COVERAGE_FLOORS.sourceManifests,
      `source manifests: ${byKind.get("source-manifest") ?? 0}`,
    );
    assert.ok((byKind.get("translation-unit") ?? 0) >= COVERAGE_FLOORS.translationUnits);
    assert.ok((byKind.get("instrument-manifest") ?? 0) >= COVERAGE_FLOORS.instruments);
    assert.ok((byKind.get("argument-nodes") ?? 0) >= COVERAGE_FLOORS.argumentNodes);
    for (const input of report.inputs) {
      assert.match(input.sha256, /^[0-9a-f]{64}$/, `${input.path} carries no digest`);
    }

    // Each dimension's own figure must be populated, not merely the inputs list.
    assert.ok(report.sourceStatus.totalUnits >= 1000, `${report.sourceStatus.totalUnits} units`);
    assert.ok(report.translationReview.totalUnits >= COVERAGE_FLOORS.translationUnits);
    assert.ok(report.argumentTreatment.totalNodes >= COVERAGE_FLOORS.argumentNodes);
    assert.ok(report.instrumentAvailability.totalInstruments >= COVERAGE_FLOORS.instruments);
    // And the two evidence-fed dimensions still say absent rather than zero.
    assert.match(provenance, /NOT MEASURED: Numerical Validation, Editorial Review/);
    assert.match(provenance, /that is an absence, not a zero/);
  });

  it("one dimension going quiet is refused even while the others are full", async () => {
    // The population a single `minimum: 1` census cannot see. Built with a root that has
    // instruments and nothing else, so files ARE opened and the run would otherwise read as
    // measured.
    const root = emptyRoot();
    for (let i = 0; i < COVERAGE_FLOORS.instruments; i++) {
      const id = `zz-${String(i).padStart(2, "0")}`;
      mkdirSync(join(root, "content", "experiments"), { recursive: true });
      writeFileSync(
        join(root, "content", "experiments", `${id}.yaml`),
        `id: ${id}\nowner:\n  kind: static\n`,
        "utf8",
      );
    }
    const { report, shortfalls } = await runCoverageReport([
      "--root",
      root,
      "--outDir",
      testOutDir,
    ]);
    assert.ok(coverageWasMeasured(report), "files were opened, so the census alone would pass");
    assert.ok(
      shortfalls.some((s) => s.startsWith("argument nodes")),
      `an empty arguments tree was not refused: ${shortfalls.join("; ")}`,
    );
  });

  it("CLI runs with scenario evidence, writes JSON/Markdown, and passes schema validation", async () => {
    mkdirSync(testOutDir, { recursive: true });

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

    assert.ok(existsSync(jsonPath), "Expected JSON file on disk");
    assert.ok(existsSync(mdPath), "Expected Markdown file on disk");

    const mdContent = readFileSync(mdPath, "utf8");
    assert.ok(mdContent.includes("Annus Mirabilis Multi-Dimensional Coverage Ledger"));
    assert.ok(mdContent.includes("Total scenarios: 3"));
    assert.ok(mdContent.includes("- passing: 2"));
    assert.ok(mdContent.includes("- failing: 1"));
    // Above the threshold the inputs line is a per-kind census, not 900 paths on one line: one
    // bare run put 113 KB of absolute paths into this gate's output before formatInputsLine.
    assert.match(mdContent, /\*\*Inputs:\*\* \d+ files -- /);
  });

  it("without scenario evidence the numerical dimension is not-run, never zero", async () => {
    mkdirSync(testOutDir, { recursive: true });

    const { report } = await runCoverageReport(["--outDir", testOutDir, "--json"]);

    assert.ok(report.logRunId);
    assert.equal(report.numericalValidation.totalScenarios, 0);
    assert.equal(report.numericalValidation.byStatus["not-run"], 1);
    assert.equal(report.numericalValidation.scenarios._all_?.status, "not-run");

    const schemaCheck = validateReportSchema(report);
    assert.equal(
      schemaCheck.valid,
      true,
      `Schema validation failed: ${schemaCheck.errors.join(", ")}`,
    );
  });
});
