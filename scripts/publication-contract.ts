#!/usr/bin/env bun
/**
 * Publication Contract Verification for annus-mirabilis.com
 * Quality gate step: 'publication-contract'
 * Owner: am-rel-verified-deploy-qndt
 *
 * Requirements:
 * - Executes the core subset of publication contract tests (architecture, deployment targets,
 *   edition pipeline, and determinism) before a release candidate is published or promoted.
 * - Enforces pre-flight architecture invariants and test-file completeness.
 * - Emits structured JSONL logs to artifacts/test-logs/publication-contract/<log-run-id>.jsonl
 * - Fails closed on any contract violation or test failure.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  checkArchitecture,
  generateLogRunId,
  loadAllowlist,
  scanRepository,
} from "./app-router-architecture.ts";
import { isVacuous, type PopulationReport, reportPopulation } from "./gate-census/population.ts";
import { type ObservedSubprocess, spawnObserved } from "./spawnObserved.ts";

export const PUBLICATION_CONTRACT_TESTS: readonly string[] = [
  "scripts/app-router-architecture.test.ts",
  "scripts/deployment-target.test.ts",
  "scripts/deployment-verification.test.ts",
  "scripts/e2e-edition-pipeline.test.ts",
  "src/testing/controlTape.test.ts",
  "src/testing/genericWasm.test.ts",
  "src/testing/tickScheduler.test.ts",
];

export interface ContractVerificationOptions {
  readonly rootDir?: string;
  readonly tests?: readonly string[];
  readonly spawnFn?: (cmd: string, args: readonly string[]) => ObservedSubprocess;
  readonly logRunId?: string;
  readonly logsDir?: string;
  readonly silent?: boolean;
  /**
   * The smallest number of executed steps that is not vacuous. Defaults to 6 for the default
   * corpus and 1 for an injected `tests` list, which is the only claim true of a population this
   * function did not choose. See the note beside the census line below.
   */
  readonly populationFloor?: number;
}

export interface ContractStepResult {
  readonly testId: string;
  readonly target: string;
  readonly outcome: "passed" | "failed" | "refused";
  readonly durationMs: number;
  readonly message?: string;
  readonly stdout?: string;
  readonly stderr?: string;
}

export interface ContractVerificationSummary {
  readonly logRunId: string;
  readonly success: boolean;
  readonly exitCode: number;
  readonly totalSteps: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly refusedCount: number;
  readonly durationMs: number;
  readonly results: readonly ContractStepResult[];
  readonly logPath: string;
}

export function verifyPublicationContract(
  options: ContractVerificationOptions = {},
): ContractVerificationSummary {
  const startTime = Date.now();
  const rootDir = options.rootDir || process.cwd();
  const testsToRun = options.tests || PUBLICATION_CONTRACT_TESTS;
  const spawnFn = options.spawnFn || spawnObserved;
  const logRunId = options.logRunId || generateLogRunId();
  const silent = !!options.silent;

  const results: ContractStepResult[] = [];
  let hasFailure = false;
  let hasRefusal = false;

  if (!silent) {
    console.log("======================================================");
    console.log("📜 Annus Mirabilis Publication Contract Verification");
    console.log(`   Contract Test Suites: ${testsToRun.length}`);
    console.log("======================================================\n");
  }

  // Pre-flight 1: App Router Architecture invariants check
  const archStart = Date.now();
  try {
    const allowlistPath = join(rootDir, "scripts", "architecture-allowlist.json");
    const allowlist = existsSync(allowlistPath) ? loadAllowlist(allowlistPath) : {};
    const { entries, isIgnored } = scanRepository(rootDir);
    const violations = checkArchitecture(entries, isIgnored, allowlist);

    if (violations.length > 0) {
      hasFailure = true;
      const errMsg = `Architecture contract violated: ${violations.map((v) => v.message).join("; ")}`;
      results.push({
        testId: "preflight-architecture",
        target: "scripts/app-router-architecture.ts",
        outcome: "failed",
        durationMs: Date.now() - archStart,
        message: errMsg,
      });
      if (!silent) {
        console.error(`✖ Preflight architecture check FAILED: ${errMsg}`);
      }
    } else {
      results.push({
        testId: "preflight-architecture",
        target: "scripts/app-router-architecture.ts",
        outcome: "passed",
        durationMs: Date.now() - archStart,
        message:
          "Architecture contract verified (App Router purity, root allowlist, no legacy files).",
      });
      if (!silent) {
        console.log("✔ Preflight architecture check PASSED");
      }
    }
  } catch (err: unknown) {
    hasFailure = true;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({
      testId: "preflight-architecture",
      target: "scripts/app-router-architecture.ts",
      outcome: "failed",
      durationMs: Date.now() - archStart,
      message: `Error during architecture preflight: ${msg}`,
    });
  }

  // Pre-flight 2: Test file presence check
  for (const testFile of testsToRun) {
    const fullPath = join(rootDir, testFile);
    if (!existsSync(fullPath)) {
      hasRefusal = true;
      results.push({
        testId: `check-presence-${testFile}`,
        target: testFile,
        outcome: "refused",
        durationMs: 0,
        message: `Contract test file '${testFile}' does not exist on disk.`,
      });
      if (!silent) {
        console.error(`🚨 Required contract test '${testFile}' is missing on disk.`);
      }
    }
  }

  // If pre-flight refused, skip running tests and fail immediately
  if (!hasRefusal) {
    // Run contract test suites
    for (let i = 0; i < testsToRun.length; i++) {
      const testFile = testsToRun[i];
      if (testFile === undefined) continue;
      const stepHeader = `[${i + 1}/${testsToRun.length}] ${testFile}`;
      const stepStart = Date.now();

      try {
        const proc = spawnFn("bun", ["test", "--isolate", "--timeout", "60000", testFile]);
        const duration = Date.now() - stepStart;

        if (proc.exitCode === 0) {
          results.push({
            testId: `contract-${testFile}`,
            target: testFile,
            outcome: "passed",
            durationMs: duration,
            stdout: proc.stdout,
            stderr: proc.stderr,
          });
          if (!silent) {
            console.log(`✔ ${stepHeader} PASSED in ${duration}ms`);
          }
        } else {
          hasFailure = true;
          results.push({
            testId: `contract-${testFile}`,
            target: testFile,
            outcome: "failed",
            durationMs: duration,
            message: `Test exited with code ${proc.exitCode}`,
            stdout: proc.stdout,
            stderr: proc.stderr,
          });
          if (!silent) {
            console.error(`✖ ${stepHeader} FAILED with code ${proc.exitCode} in ${duration}ms`);
            if (proc.stderr.trim().length > 0) {
              console.error(proc.stderr);
            }
          }
        }
      } catch (err: unknown) {
        hasFailure = true;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          testId: `contract-${testFile}`,
          target: testFile,
          outcome: "failed",
          durationMs: Date.now() - stepStart,
          message: `Failed to execute: ${msg}`,
        });
        if (!silent) {
          console.error(`✖ ${stepHeader} EXECUTION ERROR: ${msg}`);
        }
      }
    }
  }

  const passedCount = results.filter((r) => r.outcome === "passed").length;
  const failedCount = results.filter((r) => r.outcome === "failed").length;
  const refusedCount = results.filter((r) => r.outcome === "refused").length;

  /*
   * THE POPULATION, DECIDED HERE AND PRINTED BELOW, and the split is the whole repair.
   *
   * 600f18faa read `reportPopulation`'s return and set `process.exitCode = 1` on it, inside the
   * `if (!silent)` reporting branch. Both halves of that were wrong and the gate stayed green:
   * the CLI ends with `process.exit(result.exitCode)`, which DISCARDS `process.exitCode`, and the
   * returned `exitCode` was computed here, before the check, so no caller ever saw the verdict.
   * A library caller running silent never reached the check at all.
   *
   * Measured by the plant: `bun scripts/gate-census.ts --plants --gate publication-contract` with
   * the floor raised out of reach reported `plant-stayed-green` -- "the gate exited 0 with the
   * violation present". The commit that introduced the bug cited the predicate being right at both
   * ends, which it was; the predicate was never the thing in doubt.
   *
   * So the decision uses `isVacuous`, which is pure, and the printing uses `reportPopulation` in
   * the branch where the rest of the summary lives. The population is the contract STEPS executed:
   * a run that executed one would print "Failed: 0" and read as a passing contract. Measured
   * 2026-10-21: 8 steps. The floor is 6, below the current set and above a partial load.
   */
  /*
   * THE FLOOR BELONGS TO THE CORPUS IT DESCRIBES. 6 is a statement about
   * PUBLICATION_CONTRACT_TESTS, the set the CLI runs; it is not true of a caller that injects its
   * own `tests`. Folding the verdict into `exitCode` without this distinction turned the unit test
   * "runs successfully with an injected mock runner" red, because one injected test plus the
   * preflights is fewer than 6 steps -- a correct refusal of the wrong population.
   *
   * So an injected population names its own floor and otherwise gets 1: it must not be EMPTY,
   * which is the whole claim, and nothing stronger is true of a list this function did not choose.
   * The CLI passes no `tests`, so the path that actually had the hole keeps the floor of 6.
   */
  const population: PopulationReport = {
    gate: "publication-contract",
    examined: results.length,
    noun: "publication contract steps",
    minimum: options.populationFloor ?? (options.tests === undefined ? 6 : 1),
  };
  const vacuous = isVacuous(population);

  const success = !hasFailure && !hasRefusal && !vacuous;
  const exitCode = hasRefusal ? 2 : hasFailure || vacuous ? 1 : 0;

  // Write structured JSONL logs
  const baseLogsDir =
    options.logsDir || join(rootDir, "artifacts", "test-logs", "publication-contract");
  if (!existsSync(baseLogsDir)) {
    mkdirSync(baseLogsDir, { recursive: true });
  }

  const logPath = join(baseLogsDir, `${logRunId}.jsonl`);
  const now = new Date().toISOString();
  const logLines: string[] = [];

  for (const res of results) {
    const event = {
      timestamp: now,
      suite: "publication-contract",
      logRunId,
      testId: res.testId,
      beadId: "am-rel-verified-deploy-qndt",
      target: res.target,
      outcome: res.outcome,
      durationMs: res.durationMs,
      message: res.message || `${res.target} verified`,
    };
    logLines.push(JSON.stringify(event));
  }

  const summaryEvent = {
    timestamp: now,
    suite: "publication-contract",
    logRunId,
    testId: "publication-contract-summary",
    beadId: "am-rel-verified-deploy-qndt",
    outcome: success ? "passed" : hasRefusal ? "refused" : "failed",
    durationMs: Date.now() - startTime,
    message: success
      ? "All publication contracts satisfied."
      : "Publication contract check failed.",
    extra: {
      total: results.length,
      passed: passedCount,
      failed: failedCount,
      refused: refusedCount,
      exitCode,
    },
  };
  logLines.push(JSON.stringify(summaryEvent));
  writeFileSync(logPath, `${logLines.join("\n")}\n`, "utf8");

  if (!silent) {
    console.log("\n======================================================");
    console.log(
      `📊 Publication Contract Summary: ${success ? "PASSED" : "FAILED"} (exit: ${exitCode})`,
    );
    console.log(`   Passed: ${passedCount} | Failed: ${failedCount} | Refused: ${refusedCount}`);
    // The census line (am-rc1001-bridge-plan-pcjk.9). The population is the contract STEPS executed: a
    // run that executed one would print "Failed: 0" and read as a passing contract. Measured 2026-10-06:
    // 8 steps, 8 passed. The floor is 6, below the current set and above a partial load.
    //
    // Printed inside the non-silent branch, where the rest of the summary is, because the silent
    // branch is the library caller's and the census reads a CLI run's output. The VERDICT is not
    // taken from this call: it was decided above, so that `exitCode` carries it for every caller.
    reportPopulation(population);
    if (vacuous) {
      console.error(
        "   Refusing: fewer contract steps ran than the floor, so this summary is about nothing.",
      );
    }
    console.log(`   Structured log: ${logPath}`);
    console.log("======================================================\n");
  }

  return {
    logRunId,
    success,
    exitCode,
    totalSteps: results.length,
    passedCount,
    failedCount,
    refusedCount,
    durationMs: Date.now() - startTime,
    results,
    logPath,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = verifyPublicationContract({
    rootDir: process.cwd(),
  });
  process.exit(result.exitCode);
}
