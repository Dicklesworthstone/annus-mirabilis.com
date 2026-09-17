import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import type { U64String } from "../identity/u64.ts";
import { decodeTapePermalink, encodeTapePermalink, extractTapeParam } from "./codec.ts";
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

const U64_TEST_SEEDS = [
  "0",
  "1",
  "1905",
  "4294967295", // 2^32 - 1
  "4294967296", // 2^32
  "9007199254740991", // 2^53 - 1 (MAX_SAFE_INTEGER)
  "9007199254740992", // 2^53
  "9007199254740993", // 2^53 + 1 (would collide in double precision float)
  "18446744073709551614", // 2^64 - 2
  "18446744073709551615", // 2^64 - 1 (U64_MAX)
];

for (const seed of U64_TEST_SEEDS) {
  test(`permalink.u64: seed "${seed}" round-trips with full 64-bit precision`, () => {
    const tape: TapeV2 = {
      ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
      seed: seed as U64String,
    };

    const encoded = encodeTapePermalink(tape);
    const decoded = decodeTapePermalink(encoded);

    assert.equal(decoded.kind, "success");
    if (decoded.kind === "success") {
      assert.equal(typeof decoded.tape.seed, "string");
      assert.equal(decoded.tape.seed, seed);
    }

    logger.log({
      testId: `permalink-u64-roundtrip-${seed}`,
      beadId: "am-inst-permalink-tape-s677",
      seed,
      outcome: "passed",
      message: `Seed ${seed} preserved with exact string representation across URL codec round-trip`,
    });
  });
}

// Criterion 1: Round trip encode, decode, and replay with seeds 0, 2^53 - 1, 2^53, 2^53 + 1, 2^64 - 1
const REPLAY_SEEDS = [
  "0",
  "9007199254740991", // 2^53 - 1 (MAX_SAFE_INTEGER)
  "9007199254740992", // 2^53
  "9007199254740993", // 2^53 + 1
  "18446744073709551615", // 2^64 - 1
];

for (const seed of REPLAY_SEEDS) {
  test(`permalink.u64: seed "${seed}" encode, decode, and replay reproduces exact checkpoint`, () => {
    const finalState = {
      temperatureK: 300,
      viscosityPaS: 0.0012,
      particleRadiusM: 0.5e-6,
      tracerCount: 200,
    };
    const expectedDigest = computeFixtureDigest(finalState, 3, seed);

    const tape: TapeV2 = {
      ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
      seed: seed as U64String,
      acceptedCheckpoint: {
        acceptedActionIndex: 3,
        acceptedInputRevision: 3,
        digest: expectedDigest,
      },
    };

    const encoded = encodeTapePermalink(tape);
    const decoded = decodeTapePermalink(encoded);

    assert.equal(decoded.kind, "success");
    if (decoded.kind !== "success") return;

    const runner = new FixtureRunner(FIXTURE_ENVIRONMENT, seed);
    const replayResult = replayTape(decoded.tape, runner);

    assert.equal(replayResult.kind, "success");
    if (replayResult.kind === "success") {
      assert.equal(replayResult.isNewRun, false);
      assert.equal(replayResult.acceptedCheckpoint.acceptedActionIndex, 3);
      assert.equal(replayResult.acceptedCheckpoint.acceptedInputRevision, 3);
      assert.equal(replayResult.acceptedCheckpoint.digest, expectedDigest);
    }

    logger.log({
      testId: `permalink-u64-replay-${seed}`,
      beadId: "am-inst-permalink-tape-s677",
      seed,
      outcome: "passed",
      message: `Replay with seed ${seed} reproduced exact accepted checkpoint`,
    });
  });
}

// Rejection of invalid signs
const INVALID_SIGN_SEEDS = ["-1", "-0", "+1", "+42", "-9007199254740992"];
for (const seed of INVALID_SIGN_SEEDS) {
  test(`permalink.u64: seed with sign "${seed}" is rejected`, () => {
    const raw = {
      ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
      seed,
    };
    const base64url = Buffer.from(JSON.stringify(raw)).toString("base64url");
    const result = decodeTapePermalink(base64url);

    assert.equal(result.kind, "invalid");
    if (result.kind === "invalid") {
      assert.equal(result.reason, "u64-invalid-format");
    }
  });
}

// Rejection of whitespace
const WHITESPACE_SEEDS = [" 0", "0 ", " 42 ", "42\n", "\t100", "12 34"];
for (const seed of WHITESPACE_SEEDS) {
  test(`permalink.u64: seed with whitespace ${JSON.stringify(seed)} is rejected`, () => {
    const raw = {
      ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
      seed,
    };
    const base64url = Buffer.from(JSON.stringify(raw)).toString("base64url");
    const result = decodeTapePermalink(base64url);

    assert.equal(result.kind, "invalid");
    if (result.kind === "invalid") {
      assert.equal(result.reason, "u64-invalid-format");
    }
  });
}

// Rejection of overlong input (leading zeros, > 2^64-1, or absurd digit counts)
const OVERLONG_SEEDS = [
  "00",
  "01",
  "007",
  "000000000000000000001",
  "18446744073709551616", // 2^64
  "184467440737095516160",
  "999999999999999999999999999999999999",
];
for (const seed of OVERLONG_SEEDS) {
  test(`permalink.u64: overlong or leading-zero seed "${seed.slice(0, 15)}..." is rejected`, () => {
    const raw = {
      ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
      seed,
    };
    const base64url = Buffer.from(JSON.stringify(raw)).toString("base64url");
    const result = decodeTapePermalink(base64url);

    assert.equal(result.kind, "invalid");
    if (result.kind === "invalid") {
      assert.ok(
        result.reason === "u64-invalid-format" || result.reason === "u64-overflow",
        `Expected u64-invalid-format or u64-overflow, got ${result.reason}`,
      );
    }
  });
}

test("permalink.u64: seed 2^64 (18446744073709551616) is rejected with u64-overflow", () => {
  const raw = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    seed: "18446744073709551616",
  };
  const base64url = Buffer.from(JSON.stringify(raw)).toString("base64url");
  const result = decodeTapePermalink(base64url);

  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.equal(result.reason, "u64-overflow");
    assert.ok(result.notice.includes("exceeds 2^64 - 1"));
  }
});

// Full URL round trip
test("permalink.u64: full URL round-trip with seed 2^53 + 1 preserves seed and checkpoint", () => {
  const seed = "9007199254740993" as U64String;
  const finalState = {
    temperatureK: 300,
    viscosityPaS: 0.0012,
    particleRadiusM: 0.5e-6,
    tracerCount: 200,
  };
  const expectedDigest = computeFixtureDigest(finalState, 3, seed);

  const tape: TapeV2 = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    seed,
    acceptedCheckpoint: {
      acceptedActionIndex: 3,
      acceptedInputRevision: 3,
      digest: expectedDigest,
    },
  };

  const encoded = encodeTapePermalink(tape);
  const fullUrl = `https://annus-mirabilis.com/lab/bm-01?tape=${encoded}&view=parallel#s3-p2`;

  const extracted = extractTapeParam(fullUrl);
  assert.equal(extracted, encoded);

  const decoded = decodeTapePermalink(fullUrl);
  assert.equal(decoded.kind, "success");
  if (decoded.kind === "success") {
    assert.equal(decoded.tape.seed, seed);

    const runner = new FixtureRunner(FIXTURE_ENVIRONMENT, seed);
    const replayResult = replayTape(decoded.tape, runner);

    assert.equal(replayResult.kind, "success");
    if (replayResult.kind === "success") {
      assert.equal(replayResult.acceptedCheckpoint.digest, expectedDigest);
    }
  }
});
