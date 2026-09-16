import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseU64 } from "../experiments/identity/u64.ts";
import {
  ControlTapeReplayer,
  type TapeRuntimeContext,
  validateTapeCompatibility,
} from "../experiments/tapes/replayer.ts";
import type { ControlTapeV2, TapeModelIdentity } from "../experiments/tapes/schema.ts";

const validModelIdentity: TapeModelIdentity = {
  modelId: "brownian-motion-reference",
  modelVersion: "1.0.0",
  artifactDigest: "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

const baseTape: ControlTapeV2 = {
  tapeVersion: 2,
  tapeId: "compat-test-tape",
  experimentId: "bm-01",
  mode: "bm-01:default",
  modelIdentity: validModelIdentity,
  constantSetId: "einstein-1905-brownian-printed",
  seed: parseU64("9007199254740993"),
  streamVersion: 1,
  allocationId: "tracer-alloc-0",
  initialConditions: {
    viscosity: 1.35e-3,
  },
  events: [],
  checkpoints: [],
};

const baseContext: TapeRuntimeContext = {
  experimentId: "bm-01",
  modelIdentity: validModelIdentity,
  constantSetId: "einstein-1905-brownian-printed",
  streamVersion: 1,
  allocationId: "tracer-alloc-0",
};

describe("tapes.compatibility: Compatibility Validation and Typed Input Refusals (am-rt-control-tapes-0gc)", () => {
  it("passes when tape matches current runtime context exactly", () => {
    const check = validateTapeCompatibility(baseTape, baseContext);
    assert.equal(check.compatible, true);

    const replayer = new ControlTapeReplayer(baseTape, baseContext);
    assert.equal(replayer.refused, false);
    assert.equal(replayer.activeRefusalCode, undefined);
  });

  it("refuses tape-version-unsupported when version is not 2", () => {
    const tape = { ...baseTape, tapeVersion: 1 as unknown as 2 };
    const check = validateTapeCompatibility(tape, baseContext);
    assert.equal(check.compatible, false);
    if (!check.compatible) {
      assert.equal(check.refusalCode, "tape-version-unsupported");
    }
  });

  it("refuses tape-model-mismatch on experimentId or modelId or modelVersion mismatch", () => {
    // Experiment ID mismatch
    const ctx1 = { ...baseContext, experimentId: "bm-07" };
    const check1 = validateTapeCompatibility(baseTape, ctx1);
    assert.equal(check1.compatible, false);
    if (!check1.compatible) assert.equal(check1.refusalCode, "tape-model-mismatch");

    // Model ID mismatch
    const ctx2 = {
      ...baseContext,
      modelIdentity: { ...validModelIdentity, modelId: "brownian-motion-different" },
    };
    const check2 = validateTapeCompatibility(baseTape, ctx2);
    assert.equal(check2.compatible, false);
    if (!check2.compatible) assert.equal(check2.refusalCode, "tape-model-mismatch");

    // Model Version mismatch
    const ctx3 = {
      ...baseContext,
      modelIdentity: { ...validModelIdentity, modelVersion: "2.0.0" },
    };
    const check3 = validateTapeCompatibility(baseTape, ctx3);
    assert.equal(check3.compatible, false);
    if (!check3.compatible) assert.equal(check3.refusalCode, "tape-model-mismatch");
  });

  it("refuses tape-artifact-mismatch when computational artifact digest differs", () => {
    const ctx = {
      ...baseContext,
      modelIdentity: {
        ...validModelIdentity,
        artifactDigest:
          "host:sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      },
    };
    const check = validateTapeCompatibility(baseTape, ctx);
    assert.equal(check.compatible, false);
    if (!check.compatible) assert.equal(check.refusalCode, "tape-artifact-mismatch");
  });

  it("refuses tape-constant-set-mismatch when constant sets differ", () => {
    const ctx = { ...baseContext, constantSetId: "modern-si-2019" };
    const check = validateTapeCompatibility(baseTape, ctx);
    assert.equal(check.compatible, false);
    if (!check.compatible) assert.equal(check.refusalCode, "tape-constant-set-mismatch");
  });

  it("refuses tape-stream-version-mismatch when pseudorandom stream generator versions differ", () => {
    const ctx = { ...baseContext, streamVersion: 2 };
    const check = validateTapeCompatibility(baseTape, ctx);
    assert.equal(check.compatible, false);
    if (!check.compatible) assert.equal(check.refusalCode, "tape-stream-version-mismatch");
  });

  it("refuses tape-allocation-mismatch when random stream allocations differ", () => {
    const ctx = { ...baseContext, allocationId: "tracer-alloc-1" };
    const check = validateTapeCompatibility(baseTape, ctx);
    assert.equal(check.compatible, false);
    if (!check.compatible) assert.equal(check.refusalCode, "tape-allocation-mismatch");
  });

  it("refuses tape-grid-mismatch when stochastic replay grids differ", () => {
    const tapeWithGrid = { ...baseTape, replayGrid: { baseSpacing: 0.1, horizon: 100 } };
    const ctxWithDiffGrid = {
      ...baseContext,
      replayGrid: { baseSpacing: 0.2, horizon: 100 },
    };
    const check = validateTapeCompatibility(tapeWithGrid, ctxWithDiffGrid);
    assert.equal(check.compatible, false);
    if (!check.compatible) assert.equal(check.refusalCode, "tape-grid-mismatch");
  });

  it("adversarial fixture: tape recorded at one grid must REFUSE against a different grid, not interpolate", async () => {
    // Tape recorded on a 0.02s grid for 60s
    const recordedGrid = { baseSpacing: 0.02, horizon: 60 };
    const tape = { ...baseTape, replayGrid: recordedGrid };

    // Case 1: Runtime context has coarser spacing (0.05s) - must refuse, not interpolate
    const coarseContext: TapeRuntimeContext = {
      ...baseContext,
      replayGrid: { baseSpacing: 0.05, horizon: 60 },
    };
    const coarseCheck = validateTapeCompatibility(tape, coarseContext);
    assert.equal(coarseCheck.compatible, false);
    if (!coarseCheck.compatible) {
      assert.equal(coarseCheck.refusalCode, "tape-grid-mismatch");
    }

    const coarseReplayer = new ControlTapeReplayer(tape, coarseContext);
    assert.equal(coarseReplayer.refused, true);
    assert.equal(coarseReplayer.activeRefusalCode, "tape-grid-mismatch");
    const coarseSeek = await coarseReplayer.seekToAction(1);
    assert.equal(coarseSeek.isRefused, true);
    assert.equal(coarseSeek.refusalCode, "tape-grid-mismatch");

    // Case 2: Runtime context has mismatched horizon (120s vs 60s)
    const horizonContext: TapeRuntimeContext = {
      ...baseContext,
      replayGrid: { baseSpacing: 0.02, horizon: 120 },
    };
    const horizonCheck = validateTapeCompatibility(tape, horizonContext);
    assert.equal(horizonCheck.compatible, false);
    if (!horizonCheck.compatible) {
      assert.equal(horizonCheck.refusalCode, "tape-grid-mismatch");
    }

    // Case 3: Tape has grid but runtime context has undefined grid
    const noGridContext: TapeRuntimeContext = {
      ...baseContext,
      replayGrid: undefined,
    };
    const noGridCheck = validateTapeCompatibility(tape, noGridContext);
    assert.equal(noGridCheck.compatible, false);
    if (!noGridCheck.compatible) {
      assert.equal(noGridCheck.refusalCode, "tape-grid-mismatch");
    }

    // Case 4: Tape has no grid but runtime context requires a grid
    const contextWithGrid: TapeRuntimeContext = {
      ...baseContext,
      replayGrid: { baseSpacing: 0.02, horizon: 60 },
    };
    const tapeNoGrid = { ...baseTape, replayGrid: undefined };
    const missingGridCheck = validateTapeCompatibility(tapeNoGrid, contextWithGrid);
    assert.equal(missingGridCheck.compatible, false);
    if (!missingGridCheck.compatible) {
      assert.equal(missingGridCheck.refusalCode, "tape-grid-mismatch");
    }
  });

  it("replayer refuses by name on checkpoint digest divergence instead of masking it", async () => {
    // Construct tape with a checkpoint whose digest does not match the actual state
    const tapeWithForgedCheckpoint: ControlTapeV2 = {
      ...baseTape,
      events: [
        {
          kind: "control",
          actionIndex: 1,
          commandClass: "physical-intervention",
          commandId: "set-viscosity",
          parameterId: "viscosity",
          value: 2.5e-3,
          atSimulatedTime: 0.5,
        },
      ],
      checkpoints: [
        {
          actionIndex: 1,
          stepIndex: 10,
          simulatedTime: 0.5,
          digest: "host:sha256:0000000000000000000000000000000000000000000000000000000000000000",
          digestKind: "host",
          checkpointVersion: 1,
          streamSemanticsVersion: 1,
          seed: baseTape.seed,
          streamPositions: [],
        },
      ],
    };

    const replayer = new ControlTapeReplayer(tapeWithForgedCheckpoint, baseContext);
    assert.equal(replayer.refused, false); // Compatible context

    // Seeking to actionIndex 1 where checkpoint digest diverges
    const seekResult = await replayer.seekToAction(1);
    assert.equal(seekResult.isRefused, true);
    assert.equal(seekResult.refusalCode, "tape-model-mismatch");
    assert.ok(seekResult.refusal);
  });

  it("replayer preserves initial conditions and returns structured refusal object on incompatibility", async () => {
    const replayer = new ControlTapeReplayer(baseTape, {
      ...baseContext,
      constantSetId: "modern-si-2019",
    });
    assert.equal(replayer.refused, true);
    assert.equal(replayer.activeRefusalCode, "tape-constant-set-mismatch");

    const refusal = replayer.activeRefusal;
    assert.ok(refusal);
    assert.equal(refusal?.code, "tape-constant-set-mismatch");
    assert.equal(refusal?.domainKind, "input");
    assert.ok(refusal?.rankedRepairs.length > 0);

    const seekRes = await replayer.seekToAction(5);
    assert.equal(seekRes.isRefused, true);
    assert.equal(seekRes.refusalCode, "tape-constant-set-mismatch");
    assert.equal(seekRes.state.viscosity, 1.35e-3);
  });
});
