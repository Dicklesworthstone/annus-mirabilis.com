import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultScenarioDirs, loadScenarios } from "./scenario-registry/load.ts";
import { runScenariosIsolated } from "./scenario-registry/run.ts";

describe("scenario runner", () => {
  test("executes passing fixtures of all five kinds and writes JSONL", () => {
    const loaded = loadScenarios(defaultScenarioDirs());
    const { results, logRunId, logRoot, failed } = runScenariosIsolated(loaded);
    expect(failed).toBe(0);
    const byId = Object.fromEntries(results.map((r) => [r.scenarioId, r]));
    expect(byId["self-test-golden"]?.status).toBe("passed");
    expect(byId["self-test-historical-rounds-to"]?.status).toBe("passed");
    expect(byId["self-test-historical-pending"]?.status).toBe("not-available");
    expect(byId["self-test-historical-misprint"]?.status).toBe("passed");
    expect(byId["self-test-historical-misprint"]?.extra.printedReading).toBe("8 x 10^-4 cm");
    expect(byId["self-test-identity"]?.status).toBe("passed");
    expect(byId["sr-02-emf-first-order-agreement"]?.status).toBe("passed");
    expect(byId["sr-02-emf-discriminates-at-0.6c"]?.status).toBe("passed");
    expect(byId["shelf-fizeau-fresnel-versus-relativistic"]?.status).toBe("passed");
    expect(byId["diffusion-adversarial-half-diffusivity"]?.status).toBe("passed");
    expect(byId["diffusion-adversarial-1um-radius"]?.status).toBe("passed");
    expect(byId["diffusion-einstein-1905-printed"]?.status).toBe("not-available");
    const log = readFileSync(join(logRoot, "scenarios", `${logRunId}.jsonl`), "utf8");
    expect(log.includes("self-test-golden")).toBe(true);
    expect(log.includes("not-available")).toBe(true);
  });

  test("1 um adversarial value is outside the 0.8 Mikron interval", () => {
    const loaded = loadScenarios(defaultScenarioDirs()).filter(
      (item) => item.scenario.id === "diffusion-adversarial-1um-radius",
    );
    const { results } = runScenariosIsolated(loaded);
    expect(results[0]?.status).toBe("passed");
    const actuals = results[0]?.extra.actual as { rmsDisplacement1d?: number } | undefined;
    const actual = actuals?.rmsDisplacement1d ?? Number.NaN;
    expect(actual * 1e6).toBeGreaterThan(0.55);
    expect(actual * 1e6).toBeLessThan(0.57);
  });

  test("adversarial self-test demonstrates the wrong implementation failing for declared reason", () => {
    const loaded = loadScenarios(defaultScenarioDirs()).find(
      (item) => item.scenario.id === "diffusion-adversarial-half-diffusivity",
    );
    expect(loaded).toBeDefined();
    if (!loaded) return;

    // Run with wrong implementation: selfTest.halfScale (value / 2) instead of rootTwoScale
    const wrongRun = {
      ...loaded,
      scenario: {
        ...loaded.scenario,
        owner: "selfTest.halfScale",
      },
    };
    const { results, failed, logRoot, logRunId } = runScenariosIsolated([wrongRun]);
    expect(failed).toBe(1);
    expect(results[0]?.status).toBe("failed");
    expect(results[0]?.message).toContain("rmsDisplacement1d");
    expect(results[0]?.message).toContain("is outside tolerance");

    // AC 13: a deliberately failing self-test scenario writes its failure file
    const failureFilePath = join(
      logRoot,
      "scenarios",
      logRunId,
      "failures",
      `${wrongRun.scenario.id}.json`,
    );
    expect(existsSync(failureFilePath)).toBe(true);
    const failureRecord = JSON.parse(readFileSync(failureFilePath, "utf8"));
    expect(failureRecord.scenarioId).toBe(wrongRun.scenario.id);
    expect(failureRecord.reproductionCommand).toContain("run-scenarios.ts");
    expect(failureRecord.message).toContain("is outside tolerance");

    // Check that it failed for the declared intended reason:
    expect(loaded.scenario.plausibleMistake).toBe(
      "Halving diffusivity halves the RMS displacement.",
    );
    expect(loaded.scenario.intendedFailure).toBe(
      "RMS scales as sqrt(D), so the factor is 1/sqrt(2) = 0.70711, not 0.5.",
    );

    const firstResult = results[0];
    expect(firstResult).toBeDefined();
    if (!firstResult) throw new Error("Expected at least one result");
    const actualRms = (firstResult.extra.actual as { rmsDisplacement1d: number }).rmsDisplacement1d;
    const baselineRms = Number(loaded.scenario.inputs.baselineRms?.value);
    // Verifies the wrong 1/2 factor
    expect(actualRms).toBeCloseTo(baselineRms * 0.5, 12);
  });

  test("cross-owner mode compares two owners on one scenario with relativeTo: larger", () => {
    const golden = loadScenarios(defaultScenarioDirs()).find(
      (item) => item.scenario.id === "self-test-golden",
    );
    expect(golden).toBeDefined();
    if (!golden) return;

    // 1. Two agreeing owners: selfTest.timesTwoClosed and selfTest.timesTwoFromAdd
    const { runCrossOwnerScenario } = require("./scenario-registry/run.ts");
    const resAgree = runCrossOwnerScenario(
      golden.scenario,
      "selfTest.timesTwoClosed",
      "selfTest.timesTwoFromAdd",
    );
    expect(resAgree.passed).toBe(true);
    expect(resAgree.comparisonKind).toBe("tolerance");
    expect(resAgree.relativeTo).toBe("larger");
    expect(resAgree.maxDeviation).toBe(0);

    // 2. Disagreeing owners on half-diffusivity: rootTwoScale vs halfScale
    const diffScenario = loadScenarios(defaultScenarioDirs()).find(
      (item) => item.scenario.id === "diffusion-adversarial-half-diffusivity",
    );
    expect(diffScenario).toBeDefined();
    if (!diffScenario) return;

    const resDisagree = runCrossOwnerScenario(
      diffScenario.scenario,
      "selfTest.rootTwoScale",
      "selfTest.halfScale",
    );
    expect(resDisagree.passed).toBe(false);
    expect(resDisagree.comparisonKind).toBe("tolerance");
    expect(resDisagree.relativeTo).toBe("larger");
    expect(resDisagree.maxDeviation).toBeCloseTo(0.2928932, 5);
  });
});
