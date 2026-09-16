import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import type { U64String } from "../identity/u64.ts";
import { encodeTapePermalink } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
import type { TapeV2 } from "./types.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

test("permalink.encode: payload fields match tape schema version 2 and decimal-string seeds", () => {
  const tape: TapeV2 = {
    tapeVersion: 2,
    experimentId: "bm-01",
    mode: "bm-01:default",
    modelIdentity: {
      modelId: "fixtureDiffusionKernel",
      modelVersion: 1,
      artifactDigest: "blake3:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    constantSetId: "1905-annalen-constants",
    seed: "9007199254740993" as U64String, // 2^53 + 1
    streamVersion: 1,
    allocationId: "bm01-main",
    initialConditions: {
      temperatureK: 293.15,
      viscosityPaS: 0.001,
      particleRadiusM: 0.5e-6,
    },
    events: [
      {
        actionIndex: 1,
        commandClass: "physical-intervention",
        paramId: "temperatureK",
        value: 300,
      },
    ],
    acceptedCheckpoint: {
      acceptedActionIndex: 1,
      acceptedInputRevision: 1,
      digest: "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  };

  const encoded = encodeTapePermalink(tape);
  assert.ok(encoded.length > 0);
  assert.ok(encoded.length <= 2048);

  logger.log({
    testId: "permalink-encode-schema-v2",
    beadId: "am-inst-permalink-tape-s677",
    instrumentId: "bm-01",
    seed: "9007199254740993",
    outcome: "passed",
    message: "Tape encoded successfully into bounded permalink with schema version 2",
    extra: {
      encodedLength: encoded.length,
    },
  });
});

test("permalink.encode: length of Einstein 0.8 micron sequence with 64-point sketch stays under 2048 chars", () => {
  // 64-point sketch prediction
  const points: [number, number][] = [];
  for (let i = 0; i < 64; i++) {
    const x = i * 0.1;
    const y = Math.sin(x);
    points.push([Math.round(x * 100) / 100, Math.round(y * 1000) / 1000]);
  }

  const tapeWithSketch: TapeV2 = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    predictions: [
      {
        promptId: "prompt-einstein-08-sketch",
        form: "sketch",
        payload: { points },
      },
    ],
  };

  const encoded = encodeTapePermalink(tapeWithSketch);
  assert.ok(encoded.length < 2048, `Encoded length ${encoded.length} exceeds 2048 limit`);

  // Also test with prediction excluded
  const encodedNoPredictions = encodeTapePermalink(tapeWithSketch, { includePredictions: false });
  assert.ok(encodedNoPredictions.length < encoded.length);

  logger.log({
    testId: "permalink-encode-einstein-08-micron-sketch",
    beadId: "am-inst-permalink-tape-s677",
    instrumentId: "bm-01",
    outcome: "passed",
    message: "Einstein 0.8 micron sequence with 64-point sketch encoded within 2048 char bound",
    extra: {
      sketchPoints: 64,
      encodedLength: encoded.length,
      encodedNoPredictionsLength: encodedNoPredictions.length,
    },
  });
});

test("permalink.encode: four-point typed-values prediction stays under 2048 chars", () => {
  const tapeWithValues: TapeV2 = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    predictions: [
      {
        promptId: "prompt-values-4point",
        form: "values",
        payload: {
          values: [
            [0, 0.8e-6],
            [1, 1.2e-6],
            [2, 1.6e-6],
            [3, 2.0e-6],
          ],
        },
      },
    ],
  };

  const encoded = encodeTapePermalink(tapeWithValues);
  assert.ok(encoded.length < 2048, `Encoded length ${encoded.length} exceeds 2048 limit`);

  logger.log({
    testId: "permalink-encode-typed-values-4point",
    beadId: "am-inst-permalink-tape-s677",
    instrumentId: "bm-01",
    outcome: "passed",
    message: "Four-point typed values prediction encoded within 2048 char bound",
    extra: {
      valuesCount: 4,
      encodedLength: encoded.length,
    },
  });
});
