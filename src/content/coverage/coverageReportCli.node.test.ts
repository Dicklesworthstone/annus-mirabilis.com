/**
 * THE COVERAGE-REPORT CLI, ACTUALLY SPAWNED (the half the bun lane cannot run).
 *
 * `coverageLedger.test.ts` drives the report generator in process, because bun's runner cannot
 * reliably spawn here: its own attempt to `execSync` this script was red for six days with an
 * empty stdout reaching JSON.parse. What that lane therefore cannot tell you is whether the SCRIPT
 * still works -- whether it parses its arguments, prints the report to stdout, and writes its two
 * artifacts. This file is that half, in the lane that can spawn.
 *
 * It is listed in bunfig.toml's pathIgnorePatterns for the same reason the git-dependent files
 * are, and `bun run test:node` runs it.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("coverage-report prints its report and writes both artifacts", () => {
  const dir = mkdtempSync(join(tmpdir(), "coverage-cli-"));
  const evidence = join(dir, "scenario-evidence.jsonl");
  writeFileSync(
    evidence,
    `${[
      JSON.stringify({ scenarioId: "sc-bm-01", status: "passed" }),
      JSON.stringify({ scenarioId: "sc-bm-05", status: "passed" }),
      JSON.stringify({ scenarioId: "sc-bm-06", status: "failed", failureMessage: "Tolerance" }),
    ].join("\n")}\n`,
    "utf8",
  );
  const outDir = join(dir, "out");

  const run = spawnSync(
    "bun",
    ["scripts/coverage-report.ts", "--scenario-evidence", evidence, "--outDir", outDir, "--json"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  // Print what the run produced before reading any verdict from it: a spawn that did not happen
  // and a script that printed nothing look the same in an assertion on the parsed object.
  console.log(
    `[coverage-report cli] status ${run.status}, stdout ${run.stdout?.length ?? 0} bytes, stderr ${run.stderr?.length ?? 0} bytes`,
  );
  assert.equal(run.error, undefined, `spawn failed: ${String(run.error)}`);
  assert.equal(run.status, 0, run.stderr);
  assert.ok((run.stdout ?? "").length > 500, "expected the report on stdout");

  const parsed = JSON.parse(run.stdout);
  assert.ok(parsed.logRunId);
  assert.equal(parsed.numericalValidation.totalScenarios, 3);
  assert.equal(parsed.numericalValidation.byStatus.passing, 2);
  assert.equal(parsed.numericalValidation.byStatus.failing, 1);
  assert.equal(parsed.inputs.length, 1);
  assert.equal(parsed.inputs[0]?.kind, "scenario-evidence");

  const jsonArtifact = join(outDir, `${parsed.logRunId}.json`);
  const mdArtifact = join(outDir, `${parsed.logRunId}.md`);
  assert.ok(existsSync(jsonArtifact), "expected the JSON artifact");
  assert.ok(existsSync(mdArtifact), "expected the Markdown artifact");
  const md = readFileSync(mdArtifact, "utf8");
  assert.ok(md.includes("Annus Mirabilis Multi-Dimensional Coverage Ledger"));
  assert.ok(md.includes("Numerical Validation"));
  // The temporary directory is left in place; nothing here deletes a file.
});
