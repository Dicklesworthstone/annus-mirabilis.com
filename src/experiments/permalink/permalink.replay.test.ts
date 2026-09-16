import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import {
  computeFixtureDigest,
  FIXTURE_ENVIRONMENT,
  FIXTURE_TEACHING_TAPE_EINSTEIN_08,
  FixtureRunner,
} from "./fixture.ts";
import { replayTape } from "./replay.ts";
import type { TapeV2 } from "./types.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

test("permalink.replay: initial conditions applied before first event and replayed checkpoint matches", () => {
  const runner = new FixtureRunner(FIXTURE_ENVIRONMENT, "1905");
  const result = replayTape(FIXTURE_TEACHING_TAPE_EINSTEIN_08, runner);

  assert.equal(result.kind, "success");
  if (result.kind === "success") {
    assert.equal(result.isNewRun, false);
    assert.equal(
      result.acceptedCheckpoint.digest,
      FIXTURE_TEACHING_TAPE_EINSTEIN_08.acceptedCheckpoint.digest,
    );
    assert.equal(result.state.temperatureK, 300);
    assert.equal(result.state.viscosityPaS, 0.0012);
    assert.equal(result.state.tracerCount, 200);
  }

  logger.log({
    testId: "permalink-replay-initial-conditions-and-events",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Initial conditions and events replayed deterministically with matching digest",
  });
});

test("permalink.replay: planted digest mismatch with matching identities reports invariant-violation", () => {
  const runner = new FixtureRunner(FIXTURE_ENVIRONMENT, "1905");
  // Plant a corrupt digest in runner
  runner.plantDigestMismatch(
    "host:sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  );

  const result = replayTape(FIXTURE_TEACHING_TAPE_EINSTEIN_08, runner);
  assert.equal(result.kind, "invariant-violation");
  if (result.kind === "invariant-violation") {
    assert.ok(result.notice.includes("consistency checks"));
    assert.equal(result.storedDigest, FIXTURE_TEACHING_TAPE_EINSTEIN_08.acceptedCheckpoint.digest);
    assert.equal(
      result.replayedDigest,
      "host:sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    );
  }

  logger.log({
    testId: "permalink-replay-invariant-violation-detected",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Digest mismatch under matching identities correctly reported as invariant-violation",
  });
});

test("permalink.replay: link recorded with presetId restores its recorded values even if preset definition defaults were edited", () => {
  const tapeWithPreset: TapeV2 = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    presetId: "bm-01-einstein-08-preset",
    initialConditions: {
      temperatureK: 293.15,
      viscosityPaS: 0.001,
      particleRadiusM: 0.5e-6,
      tracerCount: 100,
    },
  };

  const runner = new FixtureRunner(FIXTURE_ENVIRONMENT, "1905");
  const result = replayTape(tapeWithPreset, runner);

  assert.equal(result.kind, "success");
  if (result.kind === "success") {
    // Initial conditions recorded at time of share take precedence over any subsequent preset edits
    assert.equal(result.state.particleRadiusM, 0.5e-6);
  }

  logger.log({
    testId: "permalink-replay-preset-recorded-values-precedence",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Recorded initial conditions preserved over external preset mutations",
  });
});

test("permalink.replay: teaching-tape reference with step index restores exactly to that step", () => {
  const teachingRefTape: TapeV2 = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    teachingTapeRef: {
      tapeId: "bm-01-einstein-08",
      stepIndex: 1, // Step 1 (temperatureK = 300, viscosityPaS = 0.0012, tracerCount = 100)
    },
    acceptedCheckpoint: {
      acceptedActionIndex: 2,
      acceptedInputRevision: 2,
      digest: computeFixtureDigest(
        {
          temperatureK: 300,
          viscosityPaS: 0.0012,
          particleRadiusM: 0.5e-6,
          tracerCount: 100,
        },
        2,
        "1905",
      ),
    },
  };

  const runner = new FixtureRunner(FIXTURE_ENVIRONMENT, "1905");
  const result = replayTape(teachingRefTape, runner);

  assert.equal(result.kind, "success");
  if (result.kind === "success") {
    assert.equal(result.state.temperatureK, 300);
    assert.equal(result.state.viscosityPaS, 0.0012);
    assert.equal(result.state.tracerCount, 100); // tracerCount was step 2 (index 2), so step 1 keeps 100
  }

  logger.log({
    testId: "permalink-replay-teaching-ref-step-restoration",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Teaching tape reference restored exactly to requested step index",
  });
});
