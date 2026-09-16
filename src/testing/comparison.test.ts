/**
 * Baseline and variant comparison contract test (am-rt-command-classes-dzp requirement 9).
 */
import { describe, expect, it } from "bun:test";
import { compareBaselineAndVariant } from "../experiments/commands/comparison.ts";
import type { ExecutionStateSnapshot } from "../experiments/commands/invariants.ts";
import type { TypedCommand } from "../experiments/commands/types.ts";

describe("Baseline and Variant Comparison (am-rt-command-classes-dzp requirement 9)", () => {
  const baselineState: ExecutionStateSnapshot = Object.freeze({
    instanceId: "inst-comp",
    runId: "inst-comp/run/1",
    parentRunId: null,
    actionIndex: 1,
    stepIndex: 100,
    simulatedTime: 10.0,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    digests: {
      latentPathDigest: "host:sha256:latent_data_fixed",
      eventSetDigest: "host:sha256:events_fixed",
    },
    drawCounters: { latent: 200, measurement: 0 },
    modelId: "exact-propagator",
  });

  it("description-class variant shares baseline runId, latent data, and reports re-described-same-world", () => {
    const observerCmd: TypedCommand = {
      commandId: "cmd-obs",
      instanceId: "inst-comp",
      actionIndex: 2,
      class: "observer-change",
      payload: {
        velocityRatio: 0.8,
      },
    };

    const variantState: ExecutionStateSnapshot = {
      ...baselineState,
      actionIndex: 2,
      revisions: { ...baselineState.revisions, observer: 1 },
    };

    const report = compareBaselineAndVariant(baselineState, variantState, observerCmd);

    expect(report.isDescriptionClass).toBe(true);
    expect(report.sharesLatentData).toBe(true);
    expect(report.trialRelation).toBe("re-described-same-world");
    expect(report.randomnessLabel).toBe("same world, re-described");
    expect(report.whatRemainedFixed).toContain("latentTrajectory");
    expect(report.whatRemainedFixed).toContain("runId");
    expect(report.whatWasRedescribed).toContain("coordinateFrame");
    expect(report.whatChangedPhysically).toHaveLength(0);
  });

  it("physical-class variant with same seed reports common-random-numbers label, never independent-trials", () => {
    const setupCmd: TypedCommand = {
      commandId: "cmd-setup-diffusivity",
      instanceId: "inst-comp",
      actionIndex: 2,
      class: "setup-change",
      payload: {
        parameters: { diffusionCoefficient: 1.0e-12 },
      },
    };

    const variantState: ExecutionStateSnapshot = {
      ...baselineState,
      runId: "inst-comp/run/2",
      parentRunId: "inst-comp/run/1",
      actionIndex: 2,
      stepIndex: 0,
      simulatedTime: 0.0,
      revisions: { ...baselineState.revisions, input: 2 },
    };

    const report = compareBaselineAndVariant(baselineState, variantState, setupCmd, {
      baselineSeed: "42",
      variantSeed: "42",
    });

    expect(report.isDescriptionClass).toBe(false);
    expect(report.sharesLatentData).toBe(false);
    expect(report.trialRelation).toBe("common-random-numbers");
    expect(report.randomnessLabel).toBe("same random numbers, different setup");
    expect(report.whatChangedPhysically).toContain("initialConditions");
    expect(report.whatWasRedescribed).toHaveLength(0);
  });

  it("physical-class variant with different seed reports independent-trials", () => {
    const setupCmd: TypedCommand = {
      commandId: "cmd-setup-diffusivity",
      instanceId: "inst-comp",
      actionIndex: 2,
      class: "setup-change",
      payload: {
        parameters: { diffusionCoefficient: 1.0e-12 },
      },
    };

    const variantState: ExecutionStateSnapshot = {
      ...baselineState,
      runId: "inst-comp/run/2",
      parentRunId: "inst-comp/run/1",
      actionIndex: 2,
      stepIndex: 0,
      simulatedTime: 0.0,
      revisions: { ...baselineState.revisions, input: 2 },
    };

    const report = compareBaselineAndVariant(baselineState, variantState, setupCmd, {
      baselineSeed: "42",
      variantSeed: "99999",
    });

    expect(report.trialRelation).toBe("independent-trials");
    expect(report.randomnessLabel).toBe("independent trials");
  });
});
