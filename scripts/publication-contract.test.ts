/**
 * Test suite for publication contract verification.
 * Owner: am-rel-verified-deploy-qndt
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import {
  PUBLICATION_CONTRACT_TESTS,
  verifyPublicationContract,
} from "./publication-contract.ts";
import type { ObservedSubprocess } from "./spawnObserved.ts";

describe("Publication Contract Verification Suite", () => {
  test("all declared PUBLICATION_CONTRACT_TESTS exist on disk", () => {
    expect(PUBLICATION_CONTRACT_TESTS.length).toBeGreaterThanOrEqual(4);
    for (const testPath of PUBLICATION_CONTRACT_TESTS) {
      expect(existsSync(testPath)).toBe(true);
    }
  });

  test("runs successfully with an injected mock runner returning exit code 0", () => {
    const mockSpawn = (cmd: string, args: readonly string[]): ObservedSubprocess => {
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
    const failingSpawn = (cmd: string, args: readonly string[]): ObservedSubprocess => {
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
    expect(summary.results.some((r) => r.message?.includes("Simulated subprocess launch failure"))).toBe(true);
  });
});
