import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { generateLogRunId } from "./app-router-architecture.ts";
import {
  type GateCadence,
  type GateFamily,
  type GateProfile,
  type GateStep,
  QUALITY_GATE_STEPS,
  validateRegistry,
} from "./quality-gates/registry.ts";
import { classifyTestFile, partitionTestFiles } from "./quality-gates/test-runner.ts";
import { parseCliArgs, runQualityGates } from "./quality-gates.ts";

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      assert.equal(actual, expected);
    },
    toEqual(expected: unknown) {
      assert.deepEqual(actual, expected);
    },
    toBeDefined() {
      assert.ok(actual !== undefined && actual !== null);
    },
    toContain(substr: string) {
      assert.ok(String(actual).includes(substr), `Expected ${String(actual)} to contain ${substr}`);
    },
  };
}

describe("Quality Gates Registry & Validator", () => {
  it("validates the production quality gate registry successfully", () => {
    const result = validateRegistry(QUALITY_GATE_STEPS);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("rejects duplicate step IDs", () => {
    const duplicateSteps: GateStep[] = [
      {
        id: "step-1",
        title: "First step",
        command: ["bun", "-e", "process.exit(0)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "bead-1",
      },
      {
        id: "step-1",
        title: "Duplicate step",
        command: ["bun", "-e", "process.exit(0)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "bead-2",
      },
    ];

    const result = validateRegistry(duplicateSteps);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate step id 'step-1'"))).toBe(true);
  });

  it("rejects unknown family names", () => {
    const invalidStep: GateStep = {
      id: "invalid-family-step",
      title: "Step with bad family",
      command: ["bun", "-e", "process.exit(0)"],
      family: "quantum" as unknown as GateFamily,
      cadence: "every-run",
      requiredInCi: true,
      requiredInProfiles: ["scaffold"],
      availability: {},
      owner: "bead-1",
    };

    const result = validateRegistry([invalidStep]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unknown family 'quantum'"))).toBe(true);
  });

  it("rejects unknown cadence names", () => {
    const invalidStep: GateStep = {
      id: "invalid-cadence-step",
      title: "Step with bad cadence",
      command: ["bun", "-e", "process.exit(0)"],
      family: "fast",
      cadence: "weekly" as unknown as GateCadence,
      requiredInCi: true,
      requiredInProfiles: ["scaffold"],
      availability: {},
      owner: "bead-1",
    };

    const result = validateRegistry([invalidStep]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unknown cadence 'weekly'"))).toBe(true);
  });

  it("rejects unknown release profile names", () => {
    const invalidStep: GateStep = {
      id: "invalid-profile-step",
      title: "Step with bad profile",
      command: ["bun", "-e", "process.exit(0)"],
      family: "fast",
      cadence: "every-run",
      requiredInCi: true,
      requiredInProfiles: ["staging" as unknown as GateProfile],
      availability: {},
      owner: "bead-1",
    };

    const result = validateRegistry([invalidStep]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unknown profile 'staging'"))).toBe(true);
  });

  it("rejects steps missing an owner bead id", () => {
    const invalidStep: GateStep = {
      id: "no-owner-step",
      title: "Step without owner",
      command: ["bun", "-e", "process.exit(0)"],
      family: "fast",
      cadence: "every-run",
      requiredInCi: true,
      requiredInProfiles: ["scaffold"],
      availability: {},
      owner: "",
    };

    const result = validateRegistry([invalidStep]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("must have a non-empty owner bead id"))).toBe(true);
  });
});

describe("Quality Gates Runner Engine", () => {
  const testLogsDir = join(process.cwd(), "artifacts", "test-logs", "quality-gates");

  it("passes when all steps exit 0", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "pass-1",
        title: "Passing step 1",
        command: ["bun", "-e", "process.exit(0)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "test-owner",
      },
      {
        id: "pass-2",
        title: "Passing step 2",
        command: ["bun", "-e", "process.exit(0)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "test-owner",
      },
    ];

    const summary = runQualityGates({
      steps: fixtureSteps,
      mode: "fail-fast",
      silent: true,
    });

    expect(summary.outcome).toBe("passed");
    expect(summary.exitCode).toBe(0);
    expect(summary.passedCount).toBe(2);
    expect(summary.failedCount).toBe(0);
  });

  it("stops at first failure in fail-fast mode", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "fail-step",
        title: "Failing step",
        command: ["bun", "-e", "process.exit(3)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "test-owner",
      },
      {
        id: "never-run-step",
        title: "Should not run",
        command: ["bun", "-e", "process.exit(0)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "test-owner",
      },
    ];

    const summary = runQualityGates({
      steps: fixtureSteps,
      mode: "fail-fast",
      silent: true,
    });

    expect(summary.outcome).toBe("failed");
    expect(summary.exitCode).toBe(1);
    expect(summary.passedCount).toBe(0);
    expect(summary.failedCount).toBe(1);
    expect(summary.results.length).toBe(1);
    expect(summary.results[0]?.exitCode).toBe(3);
  });

  it("runs all steps in --all mode even after a failure and exits with code 1", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "fail-step",
        title: "Failing step",
        command: ["bun", "-e", "process.exit(3)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "test-owner",
      },
      {
        id: "pass-step-after",
        title: "Passing step after failure",
        command: ["bun", "-e", "process.exit(0)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "test-owner",
      },
    ];

    const summary = runQualityGates({
      steps: fixtureSteps,
      mode: "all",
      silent: true,
    });

    expect(summary.outcome).toBe("failed");
    expect(summary.exitCode).toBe(1);
    expect(summary.passedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.results.length).toBe(2);
  });

  it("reports not-available when a step script does not exist and does not count it as passing", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "missing-script-step",
        title: "Missing script step",
        command: ["bun", "scripts/non-existent-script-xyz.ts"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: false,
        requiredInProfiles: [],
        availability: {
          scriptPath: "scripts/non-existent-script-xyz.ts",
        },
        owner: "test-owner",
      },
    ];

    const summary = runQualityGates({
      steps: fixtureSteps,
      mode: "all",
      silent: true,
    });

    expect(summary.outcome).toBe("passed"); // no hard failures and not required in CI, but not-available is recorded
    expect(summary.notAvailableCount).toBe(1);
    expect(summary.passedCount).toBe(0);
    expect(summary.results[0]?.outcome).toBe("not-available");
  });

  it("fails with exit code 1 in --all mode when a requiredInCi step is not available (no silent downgrade in CI)", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "missing-required-script-step",
        title: "Missing required script step",
        command: ["bun", "scripts/non-existent-required.ts"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: [],
        availability: {
          scriptPath: "scripts/non-existent-required.ts",
        },
        owner: "test-owner",
      },
    ];

    const summary = runQualityGates({
      steps: fixtureSteps,
      mode: "all",
      silent: true,
    });

    expect(summary.outcome).toBe("failed");
    expect(summary.exitCode).toBe(1);
    expect(summary.notAvailableCount).toBe(1);
    expect(summary.passedCount).toBe(0);
    expect(summary.results[0]?.outcome).toBe("not-available");
  });

  it("stops at first failure in profile mode (fail-fast)", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "failing-step",
        title: "Failing step",
        command: ["bun", "-e", "process.exit(1)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "test-owner",
      },
      {
        id: "subsequent-step",
        title: "Should not execute",
        command: ["bun", "-e", "process.exit(0)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "test-owner",
      },
    ];

    const summary = runQualityGates({
      steps: fixtureSteps,
      profile: "scaffold",
      silent: true,
    });

    expect(summary.outcome).toBe("failed");
    expect(summary.exitCode).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.results.length).toBe(1); // stopped after first failure
  });

  it("refuses with exit code 2 in profile mode when a required step is missing or unavailable", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "required-missing-step",
        title: "Required step missing",
        command: ["bun", "scripts/unimplemented-future-script.ts"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["preview", "launch"],
        availability: {
          scriptPath: "scripts/unimplemented-future-script.ts",
        },
        owner: "test-owner",
      },
    ];

    const summary = runQualityGates({
      steps: fixtureSteps,
      profile: "preview",
      silent: true,
    });

    expect(summary.outcome).toBe("refused");
    expect(summary.exitCode).toBe(2);
    expect(summary.refusedCount).toBe(1);
    expect(summary.passedCount).toBe(0);
    expect(summary.results[0]?.outcome).toBe("refused");
    expect(summary.results[0]?.reason).toBe("script-missing");
    expect(summary.results[0]?.message).toContain("unimplemented-future-script.ts");
  });

  it("planted negative: refuses with exit code 2 and names the missing tool in profile mode (e.g. ubs under --profile scaffold)", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "ubs-diff",
        title: "Ultimate Bug Scanner (diff)",
        command: ["non_existent_ubs_scanner", "--diff"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: false,
        requiredInProfiles: ["scaffold", "preview", "launch"],
        availability: {
          tool: "non_existent_ubs_scanner",
        },
        owner: "am-scaf-quality-gates-ci-4xx",
      },
      {
        id: "subsequent-step",
        title: "Should not execute after refusal",
        command: ["bun", "-e", "process.exit(0)"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "test-owner",
      },
    ];

    const summary = runQualityGates({
      steps: fixtureSteps,
      profile: "scaffold",
      silent: true,
    });

    expect(summary.outcome).toBe("refused");
    expect(summary.exitCode).toBe(2);
    expect(summary.refusedCount).toBe(1);
    expect(summary.passedCount).toBe(0);
    expect(summary.results.length).toBe(1); // preflight halts before executing any step
    expect(summary.results[0]?.outcome).toBe("refused");
    expect(summary.results[0]?.reason).toBe("tool-unavailable");
    expect(summary.results[0]?.message).toContain("non_existent_ubs_scanner");
  });

  it("skips steps when tool is unavailable on PATH in non-profile mode without counting as passing", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "rare-tool-step",
        title: "Rare tool step",
        command: ["non_existent_tool_12345", "--check"],
        family: "fast",
        cadence: "every-run",
        requiredInCi: false,
        requiredInProfiles: ["preview"],
        availability: {
          tool: "non_existent_tool_12345",
        },
        owner: "test-owner",
      },
    ];

    const summary = runQualityGates({
      steps: fixtureSteps,
      mode: "all",
      silent: true,
    });

    expect(summary.skippedCount).toBe(1);
    expect(summary.passedCount).toBe(0);
    expect(summary.results[0]?.outcome).toBe("skipped");
    expect(summary.results[0]?.reason).toBe("tool-unavailable");
    expect(summary.results[0]?.message).toContain("non_existent_tool_12345");
  });

  it("skips nightly cadence steps under --cadence every-run and runs them under --cadence nightly", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "nightly-step",
        title: "Nightly step",
        command: ["bun", "-e", "process.exit(0)"],
        family: "perf",
        cadence: "nightly",
        requiredInCi: false,
        requiredInProfiles: ["launch"],
        availability: {},
        owner: "test-owner",
      },
    ];

    // 1. every-run cadence skips nightly step
    const everyRunSummary = runQualityGates({
      steps: fixtureSteps,
      cadence: "every-run",
      silent: true,
    });
    expect(everyRunSummary.skippedCount).toBe(1);
    expect(everyRunSummary.passedCount).toBe(0);
    expect(everyRunSummary.results[0]?.outcome).toBe("skipped");
    expect(everyRunSummary.results[0]?.reason).toBe("cadence");

    // 2. nightly cadence runs nightly step
    const nightlySummary = runQualityGates({
      steps: fixtureSteps,
      cadence: "nightly",
      silent: true,
    });
    expect(nightlySummary.passedCount).toBe(1);
    expect(nightlySummary.skippedCount).toBe(0);
    expect(nightlySummary.results[0]?.outcome).toBe("passed");
  });

  it("never selects apple family steps with --family fast|browser|perf", () => {
    const fixtureSteps: GateStep[] = [
      {
        id: "apple-step",
        title: "Apple SwiftUI validation",
        command: ["echo", "apple"],
        family: "apple",
        cadence: "every-run",
        requiredInCi: false,
        requiredInProfiles: [],
        availability: {},
        owner: "am-app-apple-quality-gate-q6gs",
      },
    ];

    for (const fam of ["fast", "browser", "perf"] as const) {
      const summary = runQualityGates({
        steps: fixtureSteps,
        family: fam,
        silent: true,
      });
      expect(summary.totalSteps).toBe(0);
      expect(summary.results.length).toBe(0);
    }
  });

  it("writes valid structured JSONL logs and summary lines with evidence retention on failure", () => {
    const logRunId = generateLogRunId();
    const fixtureSteps: GateStep[] = [
      {
        id: "fixture-failing-step",
        title: "Deliberately failing step for evidence",
        command: [
          "bun",
          "-e",
          "console.log('stdout output'); console.error('stderr output'); process.exit(1)",
        ],
        family: "fast",
        cadence: "every-run",
        requiredInCi: true,
        requiredInProfiles: ["scaffold"],
        availability: {},
        owner: "test-owner",
      },
    ];

    const summary = runQualityGates({
      steps: fixtureSteps,
      mode: "all",
      logRunId,
      silent: true,
    });

    expect(summary.outcome).toBe("failed");
    expect(summary.logPath).toBeDefined();
    const logPath = summary.logPath ?? "";
    expect(existsSync(logPath)).toBe(true);

    const logContent = readFileSync(logPath, "utf8").trim().split("\n");
    expect(logContent.length).toBe(2); // 1 step line + 1 summary line

    const stepLine = JSON.parse(logContent[0] ?? "{}");
    expect(stepLine.suite).toBe("quality-gates");
    expect(stepLine.logRunId).toBe(logRunId);
    expect(stepLine.stepId).toBe("fixture-failing-step");
    expect(stepLine.outcome).toBe("failed");
    expect(stepLine.exitCode).toBe(1);

    const summaryLine = JSON.parse(logContent[1] ?? "{}");
    expect(summaryLine.suite).toBe("quality-gates");
    expect(summaryLine.logRunId).toBe(logRunId);
    expect(summaryLine.outcome).toBe("failed");
    expect(summaryLine.failedCount).toBe(1);

    // Verify evidence directory was created
    const evidenceDir = join(testLogsDir, logRunId, "evidence");
    expect(existsSync(evidenceDir)).toBe(true);
    expect(existsSync(join(evidenceDir, "fixture-failing-step.stdout.txt"))).toBe(true);
    expect(existsSync(join(evidenceDir, "fixture-failing-step.stderr.txt"))).toBe(true);
    expect(existsSync(join(evidenceDir, "fixture-failing-step.meta.json"))).toBe(true);

    const stdoutEvidence = readFileSync(
      join(evidenceDir, "fixture-failing-step.stdout.txt"),
      "utf8",
    );
    const stderrEvidence = readFileSync(
      join(evidenceDir, "fixture-failing-step.stderr.txt"),
      "utf8",
    );
    expect(stdoutEvidence).toContain("stdout output");
    expect(stderrEvidence).toContain("stderr output");
  });

  it("parses CLI arguments accurately", () => {
    const args1 = parseCliArgs(["--fail-fast", "--family", "fast", "--cadence", "every-run"]);
    expect(args1.mode).toBe("fail-fast");
    expect(args1.family).toBe("fast");
    expect(args1.cadence).toBe("every-run");

    const args2 = parseCliArgs(["--all", "--family", "perf", "--cadence", "nightly"]);
    expect(args2.mode).toBe("all");
    expect(args2.family).toBe("perf");
    expect(args2.cadence).toBe("nightly");

    const args3 = parseCliArgs(["--profile", "preview", "--only", "architecture,typecheck"]);
    expect(args3.profile).toBe("preview");
    expect(args3.only).toEqual(["architecture", "typecheck"]);
  });
});

describe("Orphan Test Gate & Runner Partitioning", () => {
  it("classifies files with bun:test as bun runner", () => {
    const res = classifyTestFile(
      "src/sample.test.ts",
      () => 'import { test } from "' + "bun:" + 'test";',
    );
    expect(res.runner).toBe("bun");
  });

  it("classifies files with node:test or .test.mjs as node runner", () => {
    const res1 = classifyTestFile(
      "src/sample.test.ts",
      () => 'import test from "' + "node:" + 'test";',
    );
    expect(res1.runner).toBe("node");

    const res2 = classifyTestFile("src/sample.test.mjs", () => "export const a = 1;");
    expect(res2.runner).toBe("node");
  });

  it("detects and flags orphaned test files matching neither runner pattern", () => {
    const orphanRes = classifyTestFile("src/orphaned.test.ts", () => "const x = 42;");
    expect(orphanRes.runner).toBe("orphan");
    expect(orphanRes.reason).toContain("does not import 'bun:test', 'node:test', 'node:assert'");
  });

  it("fails runAllTests and reports failure when an orphaned test file is present", () => {
    const partition = partitionTestFiles(["src/good.test.ts", "src/orphan.test.ts"], (p) =>
      p.includes("good") ? 'import { test } from "' + "bun:" + 'test";' : "const x = 1;",
    );

    expect(partition.bunFiles.length).toBe(1);
    expect(partition.nodeFiles.length).toBe(0);
    expect(partition.orphanFiles.length).toBe(1);
    expect(partition.orphanFiles[0]).toBe("src/orphan.test.ts");
  });
});
