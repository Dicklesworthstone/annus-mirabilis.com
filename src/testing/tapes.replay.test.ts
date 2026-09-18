import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TickScheduler } from "../experiments/scheduler/tickScheduler.ts";
import { ControlTapeRecorder } from "../experiments/tapes/recorder.ts";
import { ControlTapeReplayer, type TapeRuntimeContext } from "../experiments/tapes/replayer.ts";
import type { PredictionPromptSpec, TapeModelIdentity } from "../experiments/tapes/schema.ts";

const modelIdentity: TapeModelIdentity = {
  modelId: "brownian-motion-reference",
  modelVersion: "1.0.0",
  artifactDigest: "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

const promptSpec: PredictionPromptSpec = {
  promptId: "prompt-predict-disp",
  candidateIds: ["cand-1", "cand-2"],
  verbalChoices: { directionIds: ["dir-x", "dir-y"], shapeIds: ["gaussian", "exponential"] },
  valueTargetIds: ["viscosity", "particleRadius"],
};

describe("tapes.replay: Recording, Replaying, and Invariant Digests (am-rt-control-tapes-0gc)", () => {
  it("records classified events and reproduces identical digests on replay across multiple speeds", async () => {
    const recorder = new ControlTapeRecorder({
      tapeId: "replay-test-tape",
      experimentId: "bm-01",
      mode: "bm-01:default",
      modelIdentity,
      constantSetId: "einstein-1905-brownian-printed",
      seed: "9007199254740993",
      streamVersion: 1,
      allocationId: "brownian-tracer-0",
      initialConditions: {
        particleRadius: 5e-7,
        temperature: 290.15,
        viscosity: 1.35e-3,
      },
      quantizationPolicies: {
        particleRadius: { kind: "significant-figures", digits: 1 },
        viscosity: { kind: "significant-figures", digits: 3 },
        temperature: { kind: "step", step: 0.01 },
      },
    });

    // Checkpoint 0 at t=0
    await recorder.recordCheckpoint({
      stepIndex: 0,
      simulatedTime: 0,
      label: "Initial state",
    });

    // Event 1: setup-change
    recorder.recordControlEvent({
      commandClass: "setup-change",
      commandId: "set-viscosity",
      parameterId: "viscosity",
      value: 1.35e-3,
    });

    // Event 2: observer-change
    recorder.recordControlEvent({
      commandClass: "observer-change",
      commandId: "set-zoom",
      parameterId: "zoom",
      value: 500,
    });

    // Event 3: prediction
    recorder.recordPredictionEvent({
      instrumentId: "bm-01",
      promptId: "prompt-predict-disp",
      payload: { form: "candidate", candidateId: "cand-1" },
      promptSpec,
    });

    // Event 4: physical-intervention
    recorder.recordControlEvent({
      commandClass: "physical-intervention",
      commandId: "apply-force",
      parameterId: "externalForce",
      value: 1e-12,
      atSimulatedTime: 1.0,
    });

    // Checkpoint 1 at t=1.0s
    const recordedCp1 = await recorder.recordCheckpoint({
      stepIndex: 60,
      simulatedTime: 1.0,
      label: "After intervention",
    });

    // Event 5: presentation-change (should NOT change scientific state)
    recorder.recordControlEvent({
      commandClass: "presentation-change",
      commandId: "set-color",
      parameterId: "colorTheme",
      value: 2,
    });

    // Checkpoint 2 at t=2.0s
    const recordedCp2 = await recorder.recordCheckpoint({
      stepIndex: 120,
      simulatedTime: 2.0,
      label: "After presentation change",
    });

    const tape = recorder.getTape();
    assert.equal(tape.events.length, 5);
    assert.equal(tape.checkpoints.length, 3);

    // Build replayer
    const runtimeContext: TapeRuntimeContext = {
      experimentId: "bm-01",
      modelIdentity,
      constantSetId: "einstein-1905-brownian-printed",
      streamVersion: 1,
      allocationId: "brownian-tracer-0",
    };

    const replayer = new ControlTapeReplayer(tape, runtimeContext);
    assert.equal(replayer.refused, false);

    // Replay speed 1: direct seek to checkpoints
    const res0 = await replayer.seekToAction(0);
    assert.equal(res0.actionIndex, 0);
    assert.equal(res0.state.particleRadius, 5e-7);
    assert.equal(res0.state.viscosity, 1.35e-3);

    const resCp1 = await replayer.seekToAction(recordedCp1.actionIndex);
    assert.equal(resCp1.digest, recordedCp1.digest);
    assert.equal(resCp1.state.externalForce, 1e-12);

    const resCp2 = await replayer.seekToAction(recordedCp2.actionIndex);
    assert.equal(resCp2.digest, recordedCp2.digest);

    // Presentation change did not enter scientific state
    assert.equal((resCp2.state as Record<string, number>).colorTheme, undefined);

    // Replay speed 2: step by step from start to end
    await replayer.seekToAction(0);
    let stepCount = 0;
    while (replayer.currentAction < recordedCp2.actionIndex) {
      await replayer.stepForward();
      stepCount++;
    }
    assert.equal(stepCount, 5);

    const steppedResult = await replayer.seekToAction(recordedCp2.actionIndex);
    assert.equal(steppedResult.digest, recordedCp2.digest);
  });

  it("scrubbing backward and forward reproduces identical checkpoint digests", async () => {
    const recorder = new ControlTapeRecorder({
      tapeId: "scrub-test-tape",
      experimentId: "bm-01",
      mode: "bm-01:default",
      modelIdentity,
      constantSetId: "einstein-1905-brownian-printed",
      seed: "9007199254740993",
      streamVersion: 1,
      allocationId: "brownian-tracer-0",
      initialConditions: { viscosity: 1.35e-3, particleRadius: 5e-7 },
    });

    await recorder.recordCheckpoint({ stepIndex: 0, simulatedTime: 0 });
    recorder.recordControlEvent({
      commandClass: "setup-change",
      commandId: "set-viscosity",
      parameterId: "viscosity",
      value: 2.0e-3,
    });
    const cp1 = await recorder.recordCheckpoint({ stepIndex: 50, simulatedTime: 1.0 });
    recorder.recordControlEvent({
      commandClass: "setup-change",
      commandId: "set-radius",
      parameterId: "particleRadius",
      value: 1.0e-6,
    });
    const cp2 = await recorder.recordCheckpoint({ stepIndex: 100, simulatedTime: 2.0 });

    const tape = recorder.getTape();
    const runtimeContext: TapeRuntimeContext = {
      experimentId: "bm-01",
      modelIdentity,
      constantSetId: "einstein-1905-brownian-printed",
      streamVersion: 1,
      allocationId: "brownian-tracer-0",
    };

    const replayer = new ControlTapeReplayer(tape, runtimeContext);

    // Forward scrub
    const fwd1 = await replayer.seekToAction(cp1.actionIndex);
    assert.equal(fwd1.digest, cp1.digest);
    const fwd2 = await replayer.seekToAction(cp2.actionIndex);
    assert.equal(fwd2.digest, cp2.digest);

    // Backward scrub step-by-step
    await replayer.stepBackward();
    assert.equal(replayer.currentAction, cp1.actionIndex);
    const back1 = await replayer.seekToAction(cp1.actionIndex);
    assert.equal(back1.digest, cp1.digest);

    await replayer.stepBackward();
    assert.equal(replayer.currentAction, 0);
    const back0 = await replayer.seekToAction(0);
    assert.equal(back0.state.viscosity, 1.35e-3);
    assert.equal(back0.state.particleRadius, 5e-7);

    // Forward scrub again
    await replayer.stepForward();
    await replayer.stepForward();
    const fwdAgain = await replayer.seekToAction(cp2.actionIndex);
    assert.equal(fwdAgain.digest, cp2.digest);
    assert.equal(fwdAgain.state.viscosity, 2.0e-3);
    assert.equal(fwdAgain.state.particleRadius, 1.0e-6);
  });

  it("host-fed time through TickScheduler at 1x vs 4x playback rates yields identical scientific states and digests", async () => {
    const recorder = new ControlTapeRecorder({
      tapeId: "scheduler-test-tape",
      experimentId: "bm-01",
      mode: "bm-01:default",
      modelIdentity,
      constantSetId: "einstein-1905-brownian-printed",
      seed: "9007199254740993",
      streamVersion: 1,
      allocationId: "brownian-tracer-0",
      initialConditions: { viscosity: 1.35e-3 },
    });

    recorder.recordControlEvent({
      commandClass: "setup-change",
      commandId: "step-1",
      parameterId: "viscosity",
      value: 1.5e-3,
    });
    const cp1 = await recorder.recordCheckpoint({ stepIndex: 10, simulatedTime: 0.5 });
    recorder.recordControlEvent({
      commandClass: "setup-change",
      commandId: "step-2",
      parameterId: "viscosity",
      value: 2.0e-3,
    });
    const cp2 = await recorder.recordCheckpoint({ stepIndex: 20, simulatedTime: 1.0 });

    const tape = recorder.getTape();
    const runtimeContext: TapeRuntimeContext = {
      experimentId: "bm-01",
      modelIdentity,
      constantSetId: "einstein-1905-brownian-printed",
      streamVersion: 1,
      allocationId: "brownian-tracer-0",
    };

    // Run A: 1x speed (tickS = 1/60s)
    const replayerA = new ControlTapeReplayer(tape, runtimeContext);
    const schedulerA = new TickScheduler(1 / 60, 0);
    let timeA = 0;
    while (replayerA.currentAction < cp2.actionIndex && timeA < 2.0) {
      timeA += 1 / 60;
      schedulerA.pump(timeA, () => {
        void replayerA.stepForward();
      });
    }
    const resA1 = await replayerA.seekToAction(cp1.actionIndex);
    const resA2 = await replayerA.seekToAction(cp2.actionIndex);

    // Run B: 4x speed (tickS = 4/60s)
    const replayerB = new ControlTapeReplayer(tape, runtimeContext);
    const schedulerB = new TickScheduler(4 / 60, 0);
    let timeB = 0;
    while (replayerB.currentAction < cp2.actionIndex && timeB < 2.0) {
      timeB += 4 / 60;
      schedulerB.pump(timeB, () => {
        void replayerB.stepForward();
      });
    }
    const resB1 = await replayerB.seekToAction(cp1.actionIndex);
    const resB2 = await replayerB.seekToAction(cp2.actionIndex);

    // Digests and states must be bitwise identical between 1x and 4x
    assert.equal(resA1.digest, resB1.digest);
    assert.equal(resA2.digest, resB2.digest);
    assert.equal(resA1.digest, cp1.digest);
    assert.equal(resA2.digest, cp2.digest);
    assert.deepEqual(resA2.state, resB2.state);
  });
});
