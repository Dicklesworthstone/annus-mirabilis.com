import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

/**
 * Nominal execution bound per fuzz input on an idle reference core.
 * Must NOT be raised to silence contention failures.
 */
const NOMINAL_PER_INPUT_BOUND_MS = 5.0;

/**
 * Iteration count for reference calibration workload (from perf/benchmark/cpu-calibration.mjs).
 * Calibrated so that 1,700,000 iterations takes ~5.0ms on an idle reference core (Apple M4).
 */
const CALIBRATION_ITERATIONS = 1_700_000;
const NOMINAL_CALIBRATION_MS = 5.0;

function runCalibrationWorkload(iterations: number): number {
  let acc = 1;
  for (let i = 0; i < iterations; i++) {
    acc = Math.imul(acc, 1664525) + 1013904223;
    acc ^= acc >>> 13;
    acc = Math.imul(acc, 1274126177);
    acc ^= acc >>> 16;
  }
  return acc;
}

/**
 * Measures the host load factor relative to nominal reference core.
 * Runs two samples and takes the minimum to avoid false spikes from OS context switches,
 * while accurately capturing sustained CPU contention or throttling.
 * Returns a multiplier >= 1.0.
 */
function measureLoadFactor(): { loadFactor: number; calibrationMs: number } {
  // Warm up JIT tier
  runCalibrationWorkload(200_000);

  const start1 = performance.now();
  const d1 = runCalibrationWorkload(CALIBRATION_ITERATIONS);
  const sample1 = performance.now() - start1;

  const start2 = performance.now();
  const d2 = runCalibrationWorkload(CALIBRATION_ITERATIONS);
  const sample2 = performance.now() - start2;

  if (d1 === 0 || d2 === 0) {
    throw new Error("unreachable calibration digest");
  }

  const calibrationMs = Math.min(sample1, sample2);
  const loadFactor = Math.max(1.0, calibrationMs / NOMINAL_CALIBRATION_MS);
  return { loadFactor, calibrationMs };
}

/**
 * Measures decode duration with multi-sample retry on bound exceed.
 * If the first run is below the bound (the common case, ~0.02ms), it returns immediately.
 * If the first run exceeds the bound (e.g. sporadic OS thread preemption under parallel load),
 * it re-measures up to `maxAttempts` taking the minimum duration.
 * Genuine algorithmic bottlenecks or quadratic blowups will fail every attempt.
 */
function measureDecodeDuration(
  decodeFn: (input: string) => ReturnType<typeof decodeTapePermalink>,
  input: string,
  boundMs: number,
  maxAttempts = 3,
): { durationMs: number; result: ReturnType<typeof decodeTapePermalink> } {
  let bestDurationMs = Number.POSITIVE_INFINITY;
  let lastResult: ReturnType<typeof decodeTapePermalink> | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const start = performance.now();
    const result = decodeFn(input);
    const duration = performance.now() - start;
    lastResult = result;
    if (duration < bestDurationMs) {
      bestDurationMs = duration;
    }
    if (duration < boundMs) {
      return { durationMs: duration, result };
    }
  }

  if (lastResult === null) {
    throw new Error("measureDecodeDuration executed zero attempts");
  }

  return { durationMs: bestDurationMs, result: lastResult };
}

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
  const { loadFactor, calibrationMs } = measureLoadFactor();
  const effectiveBoundMs = NOMINAL_PER_INPUT_BOUND_MS * loadFactor;

  // Warm up JIT across representative corpus entries
  for (const input of FUZZ_CORPUS) {
    try {
      decodeTapePermalink(input);
    } catch {
      // warmup
    }
  }

  let maxDuration = 0;
  let totalDuration = 0;

  for (let i = 0; i < FUZZ_CORPUS.length; i++) {
    const input = FUZZ_CORPUS[i] ?? "";

    // Call decodeTapePermalink - must NEVER throw
    let measured: { durationMs: number; result: ReturnType<typeof decodeTapePermalink> };
    try {
      measured = measureDecodeDuration(decodeTapePermalink, input, effectiveBoundMs);
    } catch (err: unknown) {
      assert.fail(`Fuzz input ${i} threw an unhandled exception: ${String(err)}`);
    }

    const { durationMs, result } = measured;
    totalDuration += durationMs;
    if (durationMs > maxDuration) {
      maxDuration = durationMs;
    }

    assert.ok(result.kind === "success" || result.kind === "invalid" || result.kind === "absent");
    assert.ok(
      durationMs < effectiveBoundMs,
      `Fuzz input ${i} exceeded execution bound: ${durationMs.toFixed(3)}ms >= ${effectiveBoundMs.toFixed(3)}ms (nominal: ${NOMINAL_PER_INPUT_BOUND_MS}ms, loadFactor: ${loadFactor.toFixed(2)})`,
    );
  }

  const avgDuration = totalDuration / FUZZ_CORPUS.length;

  logger.log({
    testId: "permalink-fuzz-fixed-corpus-bounded-execution",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    durationMs: totalDuration,
    message: `Fuzz corpus (${FUZZ_CORPUS.length} cases) executed safely. Max: ${maxDuration.toFixed(3)}ms, Avg: ${avgDuration.toFixed(3)}ms (nominal: ${NOMINAL_PER_INPUT_BOUND_MS}ms, effective: ${effectiveBoundMs.toFixed(3)}ms, loadFactor: ${loadFactor.toFixed(2)})`,
    extra: {
      corpusSize: FUZZ_CORPUS.length,
      maxDurationMs: maxDuration,
      avgDurationMs: avgDuration,
      nominalBoundMs: NOMINAL_PER_INPUT_BOUND_MS,
      effectiveBoundMs,
      loadFactor,
      calibrationMs,
    },
  });
});

test("permalink.fuzz: planted negative proves execution bound bites on artificially slowed decode path", () => {
  const { loadFactor } = measureLoadFactor();
  const effectiveBoundMs = NOMINAL_PER_INPUT_BOUND_MS * loadFactor;

  // Deliberately burn CPU for 2.5x the effective bound to simulate a quadratic or heavy decode path
  const artificiallySlowDecoder = (input: string): ReturnType<typeof decodeTapePermalink> => {
    const start = performance.now();
    let acc = 1;
    const targetBurnMs = effectiveBoundMs * 2.5;
    while (performance.now() - start < targetBurnMs) {
      acc = Math.imul(acc, 1664525) + 1013904223;
    }
    if (acc === 0) {
      throw new Error("unreachable");
    }
    return decodeTapePermalink(input);
  };

  const testInput = FUZZ_CORPUS[14] ?? "";
  const { durationMs } = measureDecodeDuration(
    artificiallySlowDecoder,
    testInput,
    effectiveBoundMs,
  );

  // The measured duration across all attempts must exceed effectiveBoundMs
  assert.ok(
    durationMs >= effectiveBoundMs,
    `Planted slow decoder must exceed effective bound: measured ${durationMs.toFixed(3)}ms was not >= ${effectiveBoundMs.toFixed(3)}ms`,
  );

  // Verify that the bound assertion throws an AssertionError when violated
  assert.throws(
    () => {
      assert.ok(
        durationMs < effectiveBoundMs,
        `Fuzz input exceeded execution bound (${durationMs.toFixed(3)}ms >= ${effectiveBoundMs.toFixed(3)}ms)`,
      );
    },
    {
      name: "AssertionError",
    },
  );
});
