/**
 * am-read-return-stack-oxa. decideLabRestore against the REAL instance registry
 * (am-rt-snapshot-store-aft) and the REAL control-tape validator (am-rt-control-tapes-0gc), with
 * a fixture experiment. See restoreLab.ts's module docblock for the one real gap: this proves the
 * eligibility DECISION (reuse / restore / new-run), not that a restored instance's live view
 * shows mid-run output -- createInstanceStore has no checkpoint-seeding hook yet.
 */
import { describe, expect, test } from "bun:test";
import { createInstanceRegistry } from "../experiments/store/registry.ts";
import { type ControlTape, computeTapeDigest } from "../experiments/tape/controlTape.ts";
import { decideLabRestore } from "../reader/stack/restoreLab.ts";

const FIXTURE_EXPERIMENT_ID = "fixture-restore-lab";
const FIXTURE_MODEL_IDENTITY = "fixture-restore-lab@v1";
const FIXTURE_SEED = 42;

function fixtureBuildOptions() {
  return {
    initialParameters: { x: 1 },
    parameterClasses: { x: "input" as const },
    outputs: {
      y: { statuses: ["value" as const], unit: "1", semanticKind: "scalar", ownerId: "fixture" },
    },
  };
}

function fixtureTape(overrides: Partial<ControlTape> = {}): ControlTape {
  const state = { position: 1.5 };
  const tick = 10;
  const { digest, digestKind } = computeTapeDigest(state, tick, FIXTURE_SEED);
  return {
    version: 1,
    tapeId: "fixture-tape-1",
    experimentId: FIXTURE_EXPERIMENT_ID,
    modelIdentity: FIXTURE_MODEL_IDENTITY,
    tickS: 0.1,
    initialConditions: { position: 0 },
    seed: FIXTURE_SEED,
    totalTicks: 100,
    events: [],
    checkpoints: [{ tick, state, digest, digestKind }],
    ...overrides,
  };
}

describe("decideLabRestore: reuse a mounted instance", () => {
  test("a still-mounted instance is reused, with no tape or checkpoint consulted", () => {
    const registry = createInstanceRegistry();
    const placementKey = "brownian-4#bm-01/0";
    registry.acquire(placementKey, "bm-01", fixtureBuildOptions);
    expect(registry.has(placementKey)).toBe(true);

    const decision = decideLabRestore({
      mounted: registry.has(placementKey),
      lab: null,
      tape: null,
      currentExperimentId: FIXTURE_EXPERIMENT_ID,
      currentModelIdentity: FIXTURE_MODEL_IDENTITY,
      expectedSeed: FIXTURE_SEED,
    });
    expect(decision).toEqual({ action: "reuse" });
  });
});

describe("decideLabRestore: an unmounted instance restores from a validated checkpoint", () => {
  test("a valid tape and a matching checkpoint digest authorize a restore", () => {
    const registry = createInstanceRegistry();
    const placementKey = "brownian-4#bm-01/0";
    registry.acquire(placementKey, "bm-01", fixtureBuildOptions);
    registry.release(placementKey);
    // The deferred release has not fired yet in this synchronous test, but decideLabRestore is
    // told explicitly that the instance is gone (this is the real contract: the caller reads
    // `registry.has(placementKey)` at the moment it actually needs to decide, not this test's
    // moment of release).
    const mounted = false;

    const tape = fixtureTape();
    const checkpoint = tape.checkpoints[0]!;
    const decision = decideLabRestore({
      mounted,
      lab: {
        instanceId: "bm-01:1",
        experimentId: FIXTURE_EXPERIMENT_ID,
        modelIdentity: FIXTURE_MODEL_IDENTITY,
        runId: "bm-01:1/run/1",
        checkpointDigest: checkpoint.digest,
        compactTape: "opaque",
      },
      tape,
      currentExperimentId: FIXTURE_EXPERIMENT_ID,
      currentModelIdentity: FIXTURE_MODEL_IDENTITY,
      expectedSeed: FIXTURE_SEED,
    });
    expect(decision.action).toBe("restore");
    if (decision.action !== "restore") throw new Error("expected restore");
    expect(decision.checkpoint).toEqual(checkpoint);
  });
});

describe("decideLabRestore: an invalid checkpoint produces a visibly new run", () => {
  test("a changed seed invalidates the checkpoint", () => {
    const tape = fixtureTape();
    const checkpoint = tape.checkpoints[0]!;
    const decision = decideLabRestore({
      mounted: false,
      lab: {
        instanceId: "bm-01:1",
        experimentId: FIXTURE_EXPERIMENT_ID,
        modelIdentity: FIXTURE_MODEL_IDENTITY,
        runId: "bm-01:1/run/1",
        checkpointDigest: checkpoint.digest,
        compactTape: "opaque",
      },
      tape,
      currentExperimentId: FIXTURE_EXPERIMENT_ID,
      currentModelIdentity: FIXTURE_MODEL_IDENTITY,
      expectedSeed: FIXTURE_SEED + 1,
    });
    expect(decision.action).toBe("new-run");
    if (decision.action !== "new-run") throw new Error("expected new-run");
    expect(decision.reason).toContain("seed");
  });

  test("an incompatible model identity (a changed 'stream version') invalidates the checkpoint", () => {
    const tape = fixtureTape();
    const checkpoint = tape.checkpoints[0]!;
    const decision = decideLabRestore({
      mounted: false,
      lab: {
        instanceId: "bm-01:1",
        experimentId: FIXTURE_EXPERIMENT_ID,
        modelIdentity: FIXTURE_MODEL_IDENTITY,
        runId: "bm-01:1/run/1",
        checkpointDigest: checkpoint.digest,
        compactTape: "opaque",
      },
      tape,
      currentExperimentId: FIXTURE_EXPERIMENT_ID,
      currentModelIdentity: `${FIXTURE_MODEL_IDENTITY}-v2`,
      expectedSeed: FIXTURE_SEED,
    });
    expect(decision.action).toBe("new-run");
  });

  test("a checkpoint digest that is not on the tape at all invalidates the restore", () => {
    const tape = fixtureTape();
    const decision = decideLabRestore({
      mounted: false,
      lab: {
        instanceId: "bm-01:1",
        experimentId: FIXTURE_EXPERIMENT_ID,
        modelIdentity: FIXTURE_MODEL_IDENTITY,
        runId: "bm-01:1/run/1",
        checkpointDigest: "host:doesnotexist",
        compactTape: "opaque",
      },
      tape,
      currentExperimentId: FIXTURE_EXPERIMENT_ID,
      currentModelIdentity: FIXTURE_MODEL_IDENTITY,
      expectedSeed: FIXTURE_SEED,
    });
    expect(decision.action).toBe("new-run");
    if (decision.action !== "new-run") throw new Error("expected new-run");
    expect(decision.reason).toContain("host:doesnotexist");
  });

  test("no recorded lab reference at all is a new run, not a throw", () => {
    expect(
      decideLabRestore({
        mounted: false,
        lab: null,
        tape: null,
        currentExperimentId: FIXTURE_EXPERIMENT_ID,
        currentModelIdentity: FIXTURE_MODEL_IDENTITY,
        expectedSeed: FIXTURE_SEED,
      }),
    ).toEqual({ action: "new-run", reason: "no laboratory was recorded for this frame" });
  });

  test("a lab reference whose tape could not be parsed is a new run, not a throw", () => {
    const decision = decideLabRestore({
      mounted: false,
      lab: {
        instanceId: "bm-01:1",
        experimentId: FIXTURE_EXPERIMENT_ID,
        modelIdentity: FIXTURE_MODEL_IDENTITY,
        runId: "bm-01:1/run/1",
        checkpointDigest: "host:whatever",
        compactTape: "corrupted-bytes",
      },
      tape: null,
      currentExperimentId: FIXTURE_EXPERIMENT_ID,
      currentModelIdentity: FIXTURE_MODEL_IDENTITY,
      expectedSeed: FIXTURE_SEED,
    });
    expect(decision).toEqual({
      action: "new-run",
      reason: "the recorded checkpoint tape could not be read",
    });
  });
});
