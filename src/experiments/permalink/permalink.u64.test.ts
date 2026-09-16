import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import type { U64String } from "../identity/u64.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
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

test("permalink.u64: seed 2^64 (18446744073709551616) is rejected as overflow", () => {
  const rawOverflow = {
    ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
    seed: "18446744073709551616", // 2^64
  };
  const json = JSON.stringify(rawOverflow);
  const base64url = Buffer.from(json).toString("base64url");

  const result = decodeTapePermalink(base64url);
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.equal(result.reason, "u64-overflow");
    assert.ok(result.notice.includes("2^64 - 1"));
  }

  logger.log({
    testId: "permalink-u64-overflow-rejected",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Out-of-range seed 2^64 rejected with u64-overflow",
  });
});
