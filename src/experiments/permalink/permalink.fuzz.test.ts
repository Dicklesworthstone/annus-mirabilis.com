import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

const FUZZ_CORPUS: readonly string[] = [
  "",
  "?",
  "?tape=",
  "tape=",
  "null",
  "undefined",
  "NaN",
  "{}",
  "[]",
  "a",
  "==",
  "====",
  "---___",
  "///+++",
  encodeTapePermalink(FIXTURE_TEACHING_TAPE_EINSTEIN_08),
  encodeTapePermalink(FIXTURE_TEACHING_TAPE_EINSTEIN_08).slice(0, 10),
  encodeTapePermalink(FIXTURE_TEACHING_TAPE_EINSTEIN_08).slice(0, 50),
  `${encodeTapePermalink(FIXTURE_TEACHING_TAPE_EINSTEIN_08)}===`,
  `${encodeTapePermalink(FIXTURE_TEACHING_TAPE_EINSTEIN_08)}!@#$%`,
  "A".repeat(100),
  "A".repeat(2048),
  "A".repeat(2049), // oversize
  "A".repeat(4096),
  Buffer.from('{"tapeVersion":1}').toString("base64url"),
  Buffer.from('{"tapeVersion":3}').toString("base64url"),
  Buffer.from('{"tapeVersion":2,"__proto__":{"polluted":true}}').toString("base64url"),
  Buffer.from('{"tapeVersion":2,"seed":9007199254740993}').toString("base64url"),
  Buffer.from('{"tapeVersion":2,"seed":"-1"}').toString("base64url"),
  Buffer.from('{"tapeVersion":2,"seed":"01"}').toString("base64url"),
  Buffer.from('{"tapeVersion":2,"seed":"18446744073709551616"}').toString("base64url"),
  Buffer.from('{"tapeVersion":2,"events":"not-array"}').toString("base64url"),
  Buffer.from('{"tapeVersion":2,"events":[]}').toString("base64url"),
  Buffer.from('{"tapeVersion":2,"predictions":[{"form":"invalid"}]}').toString("base64url"),
  Buffer.from("\x00\x01\x02\x03\xff\xfe").toString("base64url"),
  Buffer.from("<script>alert(1)</script>").toString("base64url"),
  Buffer.from("SELECT * FROM users;").toString("base64url"),
  "%20%20%20",
  "   ",
  "\n\r\t",
];

test("permalink.fuzz: fixed corpus decodes safely within 5ms per input with zero unhandled exceptions", () => {
  // Warm up JIT
  decodeTapePermalink(FUZZ_CORPUS[0] ?? "");

  let maxDuration = 0;
  let totalDuration = 0;

  for (let i = 0; i < FUZZ_CORPUS.length; i++) {
    const input = FUZZ_CORPUS[i] ?? "";
    const start = performance.now();

    // Call decodeTapePermalink - must NEVER throw
    let result: ReturnType<typeof decodeTapePermalink>;
    try {
      result = decodeTapePermalink(input);
    } catch (err: unknown) {
      assert.fail(`Fuzz input ${i} threw an unhandled exception: ${String(err)}`);
    }

    const duration = performance.now() - start;
    totalDuration += duration;
    if (duration > maxDuration) {
      maxDuration = duration;
    }

    assert.ok(result.kind === "success" || result.kind === "invalid" || result.kind === "absent");
    assert.ok(
      duration < 5.0,
      `Fuzz input ${i} exceeded 5ms execution bound (${duration.toFixed(3)}ms)`,
    );
  }

  const avgDuration = totalDuration / FUZZ_CORPUS.length;

  logger.log({
    testId: "permalink-fuzz-fixed-corpus-bounded-execution",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    durationMs: totalDuration,
    message: `Fuzz corpus (${FUZZ_CORPUS.length} cases) executed safely. Max: ${maxDuration.toFixed(3)}ms, Avg: ${avgDuration.toFixed(3)}ms (bound: 5ms)`,
    extra: {
      corpusSize: FUZZ_CORPUS.length,
      maxDurationMs: maxDuration,
      avgDurationMs: avgDuration,
    },
  });
});
