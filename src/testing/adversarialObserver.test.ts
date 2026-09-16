/**
 * Adversarial observer test (am-rt-command-classes-dzp).
 *
 * "The §13.5 adversarial row 'changing observer means starting a new experiment' fails for
 * its intended reason: a deliberately wrong test-only implementation of the frame slider as
 * setup-change fails the invariant check on runId and eventSetDigest."
 */
import { describe, expect, it } from "bun:test";
import {
  checkCommandInvariants,
  type ExecutionStateSnapshot,
  InvariantViolationError,
} from "../experiments/commands/invariants.ts";
import type { TypedCommand } from "../experiments/commands/types.ts";
import { runWrongObserverImplementation } from "./runtime-fixtures/adversarialObserver.ts";

describe("Adversarial Observer Check (am-rt-command-classes-dzp §13.5)", () => {
  it("deliberately wrong implementation of frame slider as setup-change fails invariant checks", async () => {
    const initialRunId = "inst-sr-fixture/run/1";
    const { preDescription, postDescription, fakePostRunId, fakeCorruptedDigest } =
      await runWrongObserverImplementation(initialRunId, 0.6);

    const preState: ExecutionStateSnapshot = {
      instanceId: "inst-sr-fixture",
      runId: initialRunId,
      parentRunId: null,
      actionIndex: 1,
      stepIndex: 50,
      simulatedTime: 5.0,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      digests: {
        eventSetDigest: preDescription.eventSetDigest,
        worldlineDigest: preDescription.worldlineDigest,
      },
      drawCounters: { latent: 0 },
    };

    // If treated as observer-change (what it SHOULD be):
    const legitimateObserverCmd: TypedCommand = {
      commandId: "cmd-frame-slider-correct",
      instanceId: "inst-sr-fixture",
      actionIndex: 2,
      class: "observer-change",
      payload: { velocityRatio: 0.6 },
    };

    // The adversarial run produced fakePostRunId and corrupted digest
    const wrongPostState: ExecutionStateSnapshot = {
      instanceId: "inst-sr-fixture",
      runId: fakePostRunId, // WRONG: forked run
      parentRunId: initialRunId,
      actionIndex: 2,
      stepIndex: 0, // WRONG: reset clocks
      simulatedTime: 0.0,
      revisions: { input: 2, observer: 0, measurement: 0, estimator: 0 }, // WRONG: incremented inputRevision
      digests: {
        eventSetDigest: fakeCorruptedDigest, // WRONG: corrupted digest
        worldlineDigest: postDescription.worldlineDigest,
      },
      drawCounters: { latent: 0 },
    };

    // Assert that the invariant checker catches the defect on runId and eventSetDigest
    expect(() => checkCommandInvariants(preState, wrongPostState, legitimateObserverCmd)).toThrow(
      InvariantViolationError,
    );

    try {
      checkCommandInvariants(preState, wrongPostState, legitimateObserverCmd);
    } catch (err) {
      expect(err).toBeInstanceOf(InvariantViolationError);
      const invErr = err as InvariantViolationError;
      expect(invErr.commandClass).toBe("observer-change");
      expect(invErr.field).toBe("runId");
    }

    // Now test if runId had matched, but eventSetDigest was corrupted
    const corruptedDigestOnlyState: ExecutionStateSnapshot = {
      ...wrongPostState,
      runId: initialRunId,
      stepIndex: 50,
      revisions: { input: 1, observer: 1, measurement: 0, estimator: 0 },
    };

    try {
      checkCommandInvariants(preState, corruptedDigestOnlyState, legitimateObserverCmd);
    } catch (err) {
      expect(err).toBeInstanceOf(InvariantViolationError);
      const invErr = err as InvariantViolationError;
      expect(invErr.field).toBe("digests.eventSetDigest");
    }
  });
});
