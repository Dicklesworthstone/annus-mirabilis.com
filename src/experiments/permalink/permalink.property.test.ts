import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { deflateRawSync } from "node:zlib";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import type { U64String } from "../identity/u64.ts";
import { decodeTapePermalink, encodeTapePermalink, MAX_PERMALINK_URL_LENGTH } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
import type {
  PredictionCandidatePayload,
  PredictionSketchPayload,
  PredictionValuesPayload,
  PredictionVerbalPayload,
  TapeControlEvent,
  TapePredictionEvent,
  TapeV2,
} from "./types.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

/** Simple deterministic pseudo-random generator for property testing. */
function createSeededPrng(initialSeed: number) {
  let s = initialSeed;
  return {
    next(): number {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    nextBigInt(min: bigint, max: bigint): bigint {
      const range = max - min;
      const bits = range.toString(2).length;
      let rand = 0n;
      for (let i = 0; i < bits; i += 32) {
        rand = (rand << 32n) | BigInt(this.nextInt(0, 0xffffffff));
      }
      return min + (rand % (range + 1n));
    },
  };
}

const PRNG = createSeededPrng(0x1905_1905);

const BOUNDARY_SEEDS: readonly string[] = [
  "0",
  "1",
  "1905",
  "4294967295", // 2^32 - 1
  "4294967296", // 2^32
  "9007199254740991", // 2^53 - 1 (MAX_SAFE_INTEGER)
  "9007199254740992", // 2^53
  "9007199254740993", // 2^53 + 1 (adversarial: collides with 2^53 in double float)
  "9007199254740994",
  "18446744073709551614", // 2^64 - 2
  "18446744073709551615", // 2^64 - 1 (U64_MAX)
];

function generateRandomTape(index: number): TapeV2 {
  const seed =
    index < BOUNDARY_SEEDS.length
      ? (BOUNDARY_SEEDS[index] as U64String)
      : (PRNG.nextBigInt(0n, 18446744073709551615n).toString() as U64String);

  const experimentIds = ["bm-01", "bm-05", "bm-06", "lq-01", "lq-07", "lq-08", "me-01", "sr-02"];
  const expId = experimentIds[PRNG.nextInt(0, experimentIds.length - 1)] ?? "bm-01";
  const mode = `${expId}:default`;

  const eventCount = PRNG.nextInt(0, 8);
  const events: TapeControlEvent[] = [];
  for (let i = 0; i < eventCount; i++) {
    events.push({
      actionIndex: i + 1,
      commandClass: "physical-intervention",
      paramId: `param_${i}`,
      value: PRNG.next() > 0.5 ? PRNG.nextInt(100, 1000) : `mode_${i}`,
    });
  }

  const predictionCount = PRNG.nextInt(0, 2);
  const predictions: TapePredictionEvent[] = [];
  for (let p = 0; p < predictionCount; p++) {
    const formType = PRNG.nextInt(0, 3);
    if (formType === 0) {
      const payload: PredictionCandidatePayload = {
        candidateId: `cand_${PRNG.nextInt(1, 3)}`,
      };
      predictions.push({
        promptId: `prompt_${p}`,
        form: "candidate",
        payload,
      });
    } else if (formType === 1) {
      const payload: PredictionSketchPayload = {
        points: [
          [0, 0],
          [0.5, 1.2],
          [1.0, 2.5],
        ],
      };
      predictions.push({
        promptId: `sketch_${p}`,
        form: "sketch",
        payload,
      });
    } else if (formType === 2) {
      const payload: PredictionVerbalPayload = {
        choiceIndex: 1,
        choiceText: "Option description text without free-text leak",
      };
      predictions.push({
        promptId: `verbal_${p}`,
        form: "verbal",
        payload,
      });
    } else {
      const payload: PredictionValuesPayload = {
        values: [
          [0, 1.25],
          [1, 0.8],
        ],
      };
      predictions.push({
        promptId: `values_${p}`,
        form: "values",
        payload,
      });
    }
  }

  return {
    tapeVersion: 2,
    experimentId: expId,
    mode,
    modelIdentity: {
      modelId: `${expId}-model-v1`,
      modelVersion: 1,
    },
    constantSetId: "modern-si-2019",
    seed,
    streamVersion: 1,
    allocationId: `${expId}.stream.v1`,
    initialConditions: {
      temperatureK: PRNG.nextInt(200, 400),
      volumeM3: PRNG.nextInt(1, 100),
      label: "preset-reference",
    },
    events,
    ...(predictions.length > 0 ? { predictions } : {}),
    acceptedCheckpoint: {
      acceptedActionIndex: eventCount,
      acceptedInputRevision: 1,
      digest: "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  };
}

describe("am-inst-permalink-tape-s677: property-based permalink tests", () => {
  test("property: 50 randomized valid tapes round-trip with exact field preservation", () => {
    for (let i = 0; i < 50; i++) {
      const tape = generateRandomTape(i);
      const encoded = encodeTapePermalink(tape);

      // Verify length bounded
      assert.ok(
        encoded.length <= MAX_PERMALINK_URL_LENGTH,
        `Encoded tape length ${encoded.length} exceeds max ${MAX_PERMALINK_URL_LENGTH}`,
      );

      // Decode
      const decoded = decodeTapePermalink(encoded);
      assert.equal(decoded.kind, "success", `Failed to decode valid tape at iteration ${i}`);
      if (decoded.kind !== "success") continue;

      const restored = decoded.tape;

      // Assert complete structural equality
      assert.equal(restored.tapeVersion, 2);
      assert.equal(restored.experimentId, tape.experimentId);
      assert.equal(restored.mode, tape.mode);
      assert.equal(restored.modelIdentity.modelId, tape.modelIdentity.modelId);
      assert.equal(restored.modelIdentity.modelVersion, tape.modelIdentity.modelVersion);
      assert.equal(restored.constantSetId, tape.constantSetId);
      assert.equal(restored.seed, tape.seed);
      assert.equal(typeof restored.seed, "string");
      assert.equal(restored.streamVersion, tape.streamVersion);
      assert.equal(restored.allocationId, tape.allocationId);
      assert.deepEqual(restored.initialConditions, tape.initialConditions);
      assert.deepEqual(restored.events, tape.events);
      assert.deepEqual(restored.acceptedCheckpoint, tape.acceptedCheckpoint);

      if (tape.predictions) {
        assert.deepEqual(restored.predictions, tape.predictions);
      }
    }

    logger.log({
      testId: "permalink-property-randomized-roundtrip",
      beadId: "am-inst-permalink-tape-s677",
      outcome: "passed",
      message: "50 randomized valid tapes round-tripped with exact field preservation",
    });
  });

  test("property: large seeds round-trip with zero precision loss and are never coerced to Number", () => {
    for (const seed of BOUNDARY_SEEDS) {
      const tape: TapeV2 = {
        ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
        seed: seed as U64String,
      };

      const encoded = encodeTapePermalink(tape);
      const decoded = decodeTapePermalink(encoded);

      assert.equal(decoded.kind, "success");
      if (decoded.kind === "success") {
        assert.equal(decoded.tape.seed, seed);
        // Explicitly assert string type
        assert.equal(typeof decoded.tape.seed, "string");
      }
    }
  });

  test("adversarial fixture: JSON number seed > 2^53 is rejected to prevent silent sequence corruption", () => {
    // Construct raw JSON string with a JSON number seed
    const rawObj = {
      ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    };
    const jsonStr = JSON.stringify(rawObj).replace(
      `"seed":"${FIXTURE_TEACHING_TAPE_EINSTEIN_08.seed}"`,
      '"seed":9007199254740993',
    );
    const compressed = Buffer.from(deflateRawSync(Buffer.from(jsonStr))).toString("base64url");

    const decoded = decodeTapePermalink(compressed);
    assert.equal(decoded.kind, "invalid");
    if (decoded.kind === "invalid") {
      assert.equal(decoded.reason, "u64-not-string");
      assert.ok(decoded.notice.includes("string"));
    }
  });

  test("adversarial fixture: oversized permalink > 2048 chars yields typed refusal tape-oversize", () => {
    const hugeString = "A".repeat(2049);
    const result = decodeTapePermalink(`https://annus-mirabilis.com/lab/bm-01?tape=${hugeString}`);
    assert.equal(result.kind, "invalid");
    if (result.kind === "invalid") {
      assert.equal(result.reason, "tape-oversize");
      assert.ok(result.notice.includes("size limit"));
    }
  });

  test("adversarial fixture: corrupt deflate and invalid base64 return safe invalid notices", () => {
    const badBase64 = "not-valid-base64-!@#$%^&*()";
    const res1 = decodeTapePermalink(badBase64);
    assert.equal(res1.kind, "invalid");
    if (res1.kind === "invalid") {
      assert.equal(res1.reason, "tape-malformed-encoding");
    }

    const randomBinary = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66]).toString(
      "base64url",
    );
    const res2 = decodeTapePermalink(randomBinary);
    assert.equal(res2.kind, "invalid");
  });
});
