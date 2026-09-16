/**
 * Table-driven invariant test suite across all six command classes (am-rt-command-classes-dzp).
 */
import { describe, expect, it } from "bun:test";
import {
  checkCommandInvariants,
  type ExecutionStateSnapshot,
  InvariantViolationError,
} from "../experiments/commands/invariants.ts";
import type { TypedCommand } from "../experiments/commands/types.ts";

describe("Command Classes Invariants (am-rt-command-classes-dzp)", () => {
  const baseState: ExecutionStateSnapshot = Object.freeze({
    instanceId: "inst-test",
    runId: "inst-test/run/1",
    parentRunId: null,
    actionIndex: 1,
    stepIndex: 10,
    simulatedTime: 1.0,
    revisions: Object.freeze({
      input: 1,
      observer: 0,
      measurement: 0,
      estimator: 0,
    }),
    digests: Object.freeze({
      latentPathDigest: "host:sha256:latent_base",
      eventSetDigest: "host:sha256:events_base",
      worldlineDigest: "host:sha256:worldlines_base",
      observationDataDigest: "host:sha256:obs_base",
      estimateDigest: "host:sha256:est_base",
    }),
    drawCounters: Object.freeze({
      latent: 100,
      measurement: 20,
    }),
    modelId: "exact-propagator",
  });

  // 1. setup-change
  it("setup-change: validates new runId, parentRunId, stepIndex 0, and inputRevision increment", () => {
    const cmd: TypedCommand = {
      commandId: "cmd-setup",
      instanceId: "inst-test",
      actionIndex: 2,
      class: "setup-change",
      payload: {
        parameters: { diffusionCoefficient: 5.0e-13 },
      },
    };

    const postValid: ExecutionStateSnapshot = {
      ...baseState,
      runId: "inst-test/run/2",
      parentRunId: "inst-test/run/1",
      actionIndex: 2,
      stepIndex: 0,
      simulatedTime: 0.0,
      revisions: { ...baseState.revisions, input: 2 },
    };

    expect(checkCommandInvariants(baseState, postValid, cmd)).toEqual({ ok: true });

    // Invariant violation: keeping old runId
    const postInvalidRunId: ExecutionStateSnapshot = {
      ...postValid,
      runId: "inst-test/run/1",
    };
    expect(() => checkCommandInvariants(baseState, postInvalidRunId, cmd)).toThrow(
      InvariantViolationError,
    );

    // Invariant violation: stepIndex not reset to 0
    const postInvalidStepIndex: ExecutionStateSnapshot = {
      ...postValid,
      stepIndex: 5,
    };
    expect(() => checkCommandInvariants(baseState, postInvalidStepIndex, cmd)).toThrow(
      InvariantViolationError,
    );
  });

  // 2. physical-intervention (forward and backdated)
  it("physical-intervention: forward keeps runId; backdated forks new runId", () => {
    // Forward intervention at simulatedTime 1.5 >= 1.0
    const cmdForward: TypedCommand = {
      commandId: "cmd-intervene-fwd",
      instanceId: "inst-test",
      actionIndex: 2,
      class: "physical-intervention",
      payload: {
        atSimulatedTime: 1.5,
        parameters: { barrierPotential: 2.0 },
      },
    };

    const postForward: ExecutionStateSnapshot = {
      ...baseState,
      actionIndex: 2,
      revisions: { ...baseState.revisions, input: 2 },
    };
    expect(checkCommandInvariants(baseState, postForward, cmdForward)).toEqual({ ok: true });

    // Forward intervention should NOT fork runId
    const postForwardWrongFork: ExecutionStateSnapshot = {
      ...postForward,
      runId: "inst-test/run/2",
    };
    expect(() => checkCommandInvariants(baseState, postForwardWrongFork, cmdForward)).toThrow(
      InvariantViolationError,
    );

    // Backdated intervention at simulatedTime 0.5 < 1.0
    const cmdBackdated: TypedCommand = {
      commandId: "cmd-intervene-back",
      instanceId: "inst-test",
      actionIndex: 2,
      class: "physical-intervention",
      payload: {
        atSimulatedTime: 0.5,
        parameters: { barrierPotential: 2.0 },
      },
    };

    const postBackdated: ExecutionStateSnapshot = {
      ...baseState,
      runId: "inst-test/run/2",
      parentRunId: "inst-test/run/1",
      actionIndex: 2,
      revisions: { ...baseState.revisions, input: 2 },
    };
    expect(checkCommandInvariants(baseState, postBackdated, cmdBackdated)).toEqual({ ok: true });

    // Backdated intervention MUST fork runId
    const postBackdatedWrongKeep: ExecutionStateSnapshot = {
      ...postBackdated,
      runId: "inst-test/run/1",
    };
    expect(() => checkCommandInvariants(baseState, postBackdatedWrongKeep, cmdBackdated)).toThrow(
      InvariantViolationError,
    );
  });

  // 3. observer-change
  it("observer-change: keeps runId, stepIndex, eventSetDigest, worldlineDigest, zero draws; increments observerRevision", () => {
    const cmd: TypedCommand = {
      commandId: "cmd-obs-boost",
      instanceId: "inst-test",
      actionIndex: 2,
      class: "observer-change",
      payload: {
        velocityRatio: 0.6,
      },
    };

    const postValid: ExecutionStateSnapshot = {
      ...baseState,
      actionIndex: 2,
      revisions: { ...baseState.revisions, observer: 1 },
    };
    expect(checkCommandInvariants(baseState, postValid, cmd)).toEqual({ ok: true });

    // Invariant violation: forking runId on observer change
    const postInvalidRunId: ExecutionStateSnapshot = {
      ...postValid,
      runId: "inst-test/run/2",
    };
    expect(() => checkCommandInvariants(baseState, postInvalidRunId, cmd)).toThrow(
      InvariantViolationError,
    );

    // Invariant violation: modifying eventSetDigest on observer change
    const postInvalidDigest: ExecutionStateSnapshot = {
      ...postValid,
      digests: { ...baseState.digests, eventSetDigest: "host:sha256:corrupted" },
    };
    expect(() => checkCommandInvariants(baseState, postInvalidDigest, cmd)).toThrow(
      InvariantViolationError,
    );

    // Invariant violation: consuming random draws on observer change
    const postInvalidDraws: ExecutionStateSnapshot = {
      ...postValid,
      drawCounters: { ...baseState.drawCounters, latent: 101 },
    };
    expect(() => checkCommandInvariants(baseState, postInvalidDraws, cmd)).toThrow(
      InvariantViolationError,
    );
  });

  // 4. measurement-change
  it("measurement-change: keeps runId, latentPathDigest, latent draw counter; increments measurementRevision", () => {
    const cmd: TypedCommand = {
      commandId: "cmd-meas-cadence",
      instanceId: "inst-test",
      actionIndex: 2,
      class: "measurement-change",
      payload: {
        observationInterval: 0.2,
      },
    };

    const postValid: ExecutionStateSnapshot = {
      ...baseState,
      actionIndex: 2,
      revisions: { ...baseState.revisions, measurement: 1 },
      drawCounters: { ...baseState.drawCounters, measurement: 40 }, // Noise draws advance
    };
    expect(checkCommandInvariants(baseState, postValid, cmd)).toEqual({ ok: true });

    // Invariant violation: modifying latentPathDigest
    const postInvalidLatentDigest: ExecutionStateSnapshot = {
      ...postValid,
      digests: { ...baseState.digests, latentPathDigest: "host:sha256:latent_resampled_bad" },
    };
    expect(() => checkCommandInvariants(baseState, postInvalidLatentDigest, cmd)).toThrow(
      InvariantViolationError,
    );

    // Invariant violation: modifying latent stream draw counter
    const postInvalidLatentDraws: ExecutionStateSnapshot = {
      ...postValid,
      drawCounters: { ...baseState.drawCounters, latent: 120 },
    };
    expect(() => checkCommandInvariants(baseState, postInvalidLatentDraws, cmd)).toThrow(
      InvariantViolationError,
    );
  });

  // 5. estimator-change
  it("estimator-change: keeps runId, observationDataDigest; increments estimatorRevision", () => {
    const cmd: TypedCommand = {
      commandId: "cmd-estimator-ols",
      instanceId: "inst-test",
      actionIndex: 2,
      class: "estimator-change",
      payload: {
        estimatorId: "ols-diffusivity",
      },
    };

    const postValid: ExecutionStateSnapshot = {
      ...baseState,
      actionIndex: 2,
      revisions: { ...baseState.revisions, estimator: 1 },
      digests: { ...baseState.digests, estimateDigest: "host:sha256:est_new" },
    };
    expect(checkCommandInvariants(baseState, postValid, cmd)).toEqual({ ok: true });

    // Invariant violation: modifying observationDataDigest on estimator change
    const postInvalidObsData: ExecutionStateSnapshot = {
      ...postValid,
      digests: { ...baseState.digests, observationDataDigest: "host:sha256:obs_swapped" },
    };
    expect(() => checkCommandInvariants(baseState, postInvalidObsData, cmd)).toThrow(
      InvariantViolationError,
    );
  });

  // 6. presentation-change
  it("presentation-change: keeps all digests, all revision counters, runId, stepIndex, and draw counters", () => {
    const cmd: TypedCommand = {
      commandId: "cmd-pres-camera",
      instanceId: "inst-test",
      actionIndex: 2,
      class: "presentation-change",
      payload: {
        drawnParticleCount: 500,
        viewMode: "density",
      },
    };

    const postValid: ExecutionStateSnapshot = {
      ...baseState,
      actionIndex: 2,
    };
    expect(checkCommandInvariants(baseState, postValid, cmd)).toEqual({ ok: true });

    // Invariant violation: modifying any revision counter
    const postInvalidRev: ExecutionStateSnapshot = {
      ...postValid,
      revisions: { ...baseState.revisions, observer: 1 },
    };
    expect(() => checkCommandInvariants(baseState, postInvalidRev, cmd)).toThrow(
      InvariantViolationError,
    );

    // Invariant violation: modifying any scientific digest
    const postInvalidDigest: ExecutionStateSnapshot = {
      ...postValid,
      digests: { ...baseState.digests, latentPathDigest: "host:sha256:bad" },
    };
    expect(() => checkCommandInvariants(baseState, postInvalidDigest, cmd)).toThrow(
      InvariantViolationError,
    );
  });

  it("production mode: returns execution outcome invariant-violation instead of throwing", () => {
    const cmd: TypedCommand = {
      commandId: "cmd-bad",
      instanceId: "inst-test",
      actionIndex: 2,
      class: "observer-change",
      payload: {},
    };

    const postInvalid: ExecutionStateSnapshot = {
      ...baseState,
      runId: "inst-test/run/2", // Wrong!
    };

    const result = checkCommandInvariants(baseState, postInvalid, cmd, { isProduction: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.outcome.outcome).toBe("invariant-violation");
      expect(result.violation.commandClass).toBe("observer-change");
      expect(result.violation.field).toBe("runId");
    }
  });
});
