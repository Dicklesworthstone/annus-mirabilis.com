/**
 * Test suite for publication contract verification.
 * Owner: am-rel-verified-deploy-qndt
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { PUBLICATION_CONTRACT_TESTS, verifyPublicationContract } from "./publication-contract.ts";
import type { ObservedSubprocess } from "./spawnObserved.ts";

describe("Publication Contract Verification Suite", () => {
  /**
   * WHY THESE TESTS FAIL ON A DIRTY TREE, and why the failure used to say nothing useful.
   *
   * verifyPublicationContract runs an ARCHITECTURE PREFLIGHT over the live working tree before it
   * executes anything (publication-contract.ts:95). A violation there sets hasFailure, which lands
   * in summary.failedCount and summary.exitCode - so an injected spawnFn's result is no longer the
   * only thing those numbers describe.
   *
   * On 2026-09-22 this suite went red in the fast lane with `Expected: 1`, and a second pane could
   * not reproduce it. Reproduced by planting one rogue file in the repository root:
   *
   *     clean tree                     5 pass 0 fail
   *     one rogue root .mjs present    3 pass 2 fail - exactly these two, by name
   *
   * A probe script left in the root for the seconds it takes to run is enough, which is precisely
   * what AGENTS.md RULE 2 point 3 forbids and precisely what had been happening. The suite was
   * right, the tree was dirty, and the assertion could not say so.
   *
   * This helper makes the precondition explicit. It does not relax what the tests expect - the
   * exit codes and counts below are unchanged - it fails earlier and names the cause, so the next
   * reader is told "the tree has an architecture violation" instead of "Expected: 1".
   */
  function assertPreflightClean(summary: {
    results: readonly { testId: string; outcome: string; message?: string | undefined }[];
  }) {
    const preflight = summary.results.find((r) => r.testId === "preflight-architecture");
    expect(
      preflight?.outcome,
      `The architecture preflight did not pass, so summary.failedCount and summary.exitCode below describe the WORKING TREE rather than the injected runner. This is almost always a rogue file in the repository root or under src/ - AGENTS.md RULE 2 point 3. Preflight said: ${preflight?.message ?? "(no preflight result at all)"}`,
    ).toBe("passed");
  }
  test("all declared PUBLICATION_CONTRACT_TESTS exist on disk", () => {
    expect(PUBLICATION_CONTRACT_TESTS.length).toBeGreaterThanOrEqual(4);
    for (const testPath of PUBLICATION_CONTRACT_TESTS) {
      expect(existsSync(testPath)).toBe(true);
    }
  });

  test("runs successfully with an injected mock runner returning exit code 0", () => {
    const mockSpawn = (_cmd: string, _args: readonly string[]): ObservedSubprocess => {
      return {
        kind: "subprocess",
        exitCode: 0,
        stdout: "bun test: 10 pass, 0 fail",
        stderr: "",
      };
    };

    const summary = verifyPublicationContract({
      rootDir: process.cwd(),
      tests: ["scripts/deployment-target.test.ts"],
      spawnFn: mockSpawn,
      silent: true,
    });

    assertPreflightClean(summary);
    expect(summary.success).toBe(true);
    expect(summary.exitCode).toBe(0);
    expect(summary.failedCount).toBe(0);
    expect(summary.refusedCount).toBe(0);
    expect(existsSync(summary.logPath)).toBe(true);

    const logContent = readFileSync(summary.logPath, "utf8");
    expect(logContent).toContain("publication-contract");
    expect(logContent).toContain("preflight-architecture");
  });

  test("refuses with exit code 2 if a required test file does not exist on disk", () => {
    const summary = verifyPublicationContract({
      rootDir: process.cwd(),
      tests: ["scripts/non-existent-rogue-test.test.ts"],
      silent: true,
    });

    expect(summary.success).toBe(false);
    expect(summary.exitCode).toBe(2);
    expect(summary.refusedCount).toBe(1);
    expect(summary.results.some((r) => r.outcome === "refused")).toBe(true);
  });

  test("fails with exit code 1 if an executed contract test returns non-zero", () => {
    const failingSpawn = (_cmd: string, _args: readonly string[]): ObservedSubprocess => {
      return {
        kind: "subprocess",
        exitCode: 1,
        stdout: "bun test: 5 pass, 1 fail",
        stderr: "AssertionError: expected true but got false",
      };
    };

    const summary = verifyPublicationContract({
      rootDir: process.cwd(),
      tests: ["scripts/deployment-target.test.ts"],
      spawnFn: failingSpawn,
      silent: true,
    });

    assertPreflightClean(summary);
    expect(summary.success).toBe(false);
    expect(summary.exitCode).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.results.some((r) => r.outcome === "failed")).toBe(true);
  });

  test("PLANTED NEGATIVE: fails when contract test throws an execution error", () => {
    const throwingSpawn = (): ObservedSubprocess => {
      throw new Error("Simulated subprocess launch failure");
    };

    const summary = verifyPublicationContract({
      rootDir: process.cwd(),
      tests: ["scripts/deployment-target.test.ts"],
      spawnFn: throwingSpawn,
      silent: true,
    });

    expect(summary.success).toBe(false);
    expect(summary.exitCode).toBe(1);
    expect(
      summary.results.some((r) => r.message?.includes("Simulated subprocess launch failure")),
    ).toBe(true);
  });
});
