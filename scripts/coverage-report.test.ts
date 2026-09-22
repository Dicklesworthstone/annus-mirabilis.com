import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { validateReportSchema } from "../src/content/coverage/reportSchema.test.ts";
import { coverageRefusal, coverageWasMeasured, runCoverageReport } from "./coverage-report.ts";

describe("Coverage Report CLI Contract (scripts/coverage-report.ts)", () => {
  const rootDir = process.cwd();
  const testOutDir = join(rootDir, "artifacts", "test-artifacts", "coverage-cli-test");

  /**
   * am-9n4g. A required CI gate reported "Total source units: 158 / reviewed: 158" beneath
   * "Inputs: None", from a literal in its own script. 342d13da moved that fixture behind
   * --demonstration, and two things were left standing: the flag still printed the forbidden
   * pair, and the DEFAULT run - which is how the registry invokes it, with no arguments -
   * measured nothing and exited 0 while requiredInCi.
   *
   * A gate that passes having opened no file certifies nothing and reads as conformance. This
   * is the fabricated-population shape rather than the empty-set one: a floor on population
   * size would not have caught it, because the population was not empty, it was invented.
   */
  it("a run that opens no input file is NOT measured, whatever its figures say (am-9n4g)", async () => {
    const { report } = await runCoverageReport(["--out-dir", testOutDir]);
    assert.equal(report.inputs.length, 0, "the default run opens no file");
    assert.equal(coverageWasMeasured(report), false);
  });

  it("the --demonstration fixture is the real shape, and it is refused (am-9n4g)", async () => {
    // THE PLANTED NEGATIVE IS THE BEAD'S OWN FIXTURE, not a synthetic one: --demonstration
    // substitutes literals for derived counts, which is precisely the defect.
    const { report } = await runCoverageReport(["--demonstration", "--out-dir", testOutDir]);

    // Confirm the fixture can REACH the state being refused. Without this the assertion below
    // would pass over a run that produced no figures at all, which is a different situation.
    assert.equal(report.sourceStatus.totalUnits, 158, "the fixture must still produce 158");
    assert.equal(report.sourceStatus.byStatus.reviewed, 158);

    // And it is still not measured, because no file was opened to produce those numbers.
    assert.equal(report.inputs.length, 0);
    assert.equal(coverageWasMeasured(report), false);

    // The refusal says which case it is, so a reader is not left to infer it.
    const refusal = coverageRefusal(true);
    assert.match(refusal, /^REFUSED: --demonstration fills dimensions from a fixture/);
    assert.match(refusal, /never be cited as coverage/);
  });

  it("a real input IS measured, so the gate is satisfiable rather than merely strict (am-9n4g)", async () => {
    // The control. Without it the change could have been "always refuse", which passes both
    // assertions above and makes the gate unsatisfiable - AC 5, and the thing the bead
    // explicitly forbids as a way to close this.
    mkdirSync(testOutDir, { recursive: true });
    const evidence = join(testOutDir, "am-9n4g-evidence.jsonl");
    writeFileSync(
      evidence,
      [
        JSON.stringify({ scenarioId: "sc-bm-05-diffusion", status: "passed" }),
        JSON.stringify({ scenarioId: "sc-bm-06-inference", status: "failed", failureMessage: "t" }),
      ].join("\n"),
    );

    const { report } = await runCoverageReport([
      "--scenario-evidence",
      evidence,
      "--out-dir",
      testOutDir,
    ]);
    assert.equal(coverageWasMeasured(report), true);
    assert.equal(report.inputs.length, 1);
    assert.equal(report.inputs[0]?.kind, "scenario-evidence");
    // The input is named with a digest, which is what makes "measured" checkable later.
    assert.match(String(report.inputs[0]?.sha256), /^[a-f0-9]{64}$/);
    // And the figure is derived from the file, not declared.
    assert.equal(report.numericalValidation.totalScenarios, 2);
  });

  it("the default refusal names what it could have read (am-9n4g)", () => {
    const refusal = coverageRefusal(false);
    assert.match(refusal, /^REFUSED: this run opened no input file/);
    assert.match(refusal, /--scenario-evidence/);
    assert.match(refusal, /--review-records/);
    // Names the bead that owns the missing loaders rather than implying nobody knows.
    assert.match(refusal, /am-cm-coverage-ledger-0ip/);
  });

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

  /**
   * am-wdqy's sibling. This gate is requiredInCi with cadence every-run and required in the preview
   * and launch profiles, and with no arguments it printed
   *
   *     - **Inputs:** None
   *     ## 1. Source Status
   *     Total source units: 158
   *     - reviewed: 158
   *
   * from three literals in scripts/coverage-report.ts, exiting 0. "Inputs: None" and "158 reviewed"
   * sat two lines apart and only one was true.
   *
   * Both halves are pinned here: a default run must not present the fixture as coverage, and a
   * populated run must still report its figures - otherwise this is a gag rather than a fix.
   */
  it("a default run does not present the fixture as coverage, and says the figures are absent rather than zero", async () => {
    mkdirSync(testOutDir, { recursive: true });
    const { report, mdPath, provenance, unwiredDimensions } = await runCoverageReport([
      "--outDir",
      testOutDir,
      "--json",
    ]);

    assert.equal(report.sourceStatus.totalUnits, 0, "the fixture's 158 must not appear by default");
    assert.equal(report.argumentTreatment.totalNodes, 0);
    assert.equal(report.instrumentAvailability.totalInstruments, 0);

    assert.match(provenance, /NOT MEASURED/);
    assert.match(provenance, /absent rather than zero/);
    assert.match(provenance, /am-cm-coverage-ledger-0ip/);
    for (const dimension of unwiredDimensions) assert.match(provenance, new RegExp(dimension));

    const md = readFileSync(mdPath, "utf8");
    assert.equal(md.includes("Total source units: 158"), false);
  });

  it("THE CONTROL: a populated run still reports its figures", async () => {
    mkdirSync(testOutDir, { recursive: true });

    // (a) the fixture, when explicitly asked for, still renders - and is labelled as a fixture
    const demo = await runCoverageReport(["--outDir", testOutDir, "--json", "--demonstration"]);
    assert.equal(demo.report.sourceStatus.totalUnits, 158);
    assert.equal(demo.report.argumentTreatment.totalNodes, 3);
    assert.match(demo.provenance, /DEMONSTRATION RUN/);
    assert.match(demo.provenance, /Do not cite these figures as coverage/);

    // (b) a dimension with a REAL input is untouched by the change: measured counts still appear
    const scenarioFile = join(testOutDir, "control-scenarios.jsonl");
    writeFileSync(
      scenarioFile,
      `${JSON.stringify({ scenarioId: "sc-control-01", status: "passed" })}\n`,
      "utf8",
    );
    const measured = await runCoverageReport([
      "--scenario-evidence",
      scenarioFile,
      "--outDir",
      testOutDir,
      "--json",
    ]);
    assert.equal(measured.report.numericalValidation.totalScenarios, 1);
    assert.equal(measured.report.numericalValidation.byStatus.passing, 1);
  });
});
