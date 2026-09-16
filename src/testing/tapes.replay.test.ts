import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
});
