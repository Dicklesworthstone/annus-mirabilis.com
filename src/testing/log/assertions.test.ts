import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BITWISE_CASES, WITHIN_TOLERANCE_CASES } from "../../units/tolerance.cases.ts";
import { expectBitwise, expectClose, recordEvent, withTestLog } from "./assertions.ts";
import { getLogger, newRunIdentity } from "./logger.ts";
import { parseLogLine } from "./schema.ts";

const SUITE = "test-logging";

function lastEventFor(suite: string, logRunId: string, testId: string) {
  const logger = getLogger(suite, logRunId);
  const lines = readFileSync(logger.filePath, "utf8")
    .split("\n")
    .filter((l) => l.length > 0);
  const events = lines.map(parseLogLine).filter((e) => e.testId === testId);
  return events.at(-1);
}

test("recordEvent writes any schema-valid event, routed by the event's own suite/logRunId", async () => {
  const logRunId = newRunIdentity();
  recordEvent({
    suite: SUITE,
    logRunId,
    testId: "record-event-direct",
    outcome: "skipped",
    extra: { reason: "not-applicable-on-this-device" },
  });
  await getLogger(SUITE, logRunId).flush();
  const event = lastEventFor(SUITE, logRunId, "record-event-direct");
  assert.equal(event?.outcome, "skipped");
  assert.deepEqual(event?.extra, { reason: "not-applicable-on-this-device" });
});

test("expectClose rejects calls without a tolerance spec", () => {
  assert.throws(
    () =>
      expectClose(1, 1, undefined as unknown as Parameters<typeof expectClose>[2], {
        suite: SUITE,
        logRunId: newRunIdentity(),
        testId: "no-spec",
      }),
    /requires an explicit ToleranceSpec/,
  );
});

test("expectClose rejects a relative-only spec at a true zero reference", async () => {
  const logRunId = newRunIdentity();
  const testId = "relative-only-at-zero";
  await withTestLog({ suite: SUITE, logRunId, testId }, () => {
    assert.throws(
      () => expectClose(1e-8, 0, { relative: 1e-9 }, { suite: SUITE, logRunId, testId }),
      /invalid tolerance spec/,
    );
  });
  const event = lastEventFor(SUITE, logRunId, testId);
  assert.ok(event, "expected a logged event");
});

test("expectClose rejects an absolute-only spec below double precision resolution", () => {
  const logRunId = newRunIdentity();
  const testId = "absolute-below-resolution";
  assert.throws(
    () => expectClose(6.17e23, 6.17e23, { absolute: 1e-9 }, { suite: SUITE, logRunId, testId }),
    /invalid tolerance spec/,
  );
});

test("+0 versus -0 fails expectBitwise and passes expectClose with an absolute tolerance", () => {
  const logRunId = newRunIdentity();

  assert.throws(
    () => expectBitwise(-0, 0, { suite: SUITE, logRunId, testId: "signed-zero-bitwise" }),
    /expectBitwise failed/,
  );
  const bitwiseEvent = lastEventFor(SUITE, logRunId, "signed-zero-bitwise");
  assert.equal(bitwiseEvent?.outcome, "failed");
  assert.equal(bitwiseEvent?.comparisonKind, "bitwise");

  const verdict = expectClose(
    -0,
    0,
    { absolute: 1e-12 },
    { suite: SUITE, logRunId, testId: "signed-zero-tolerance" },
  );
  assert.equal(verdict.ok, true);
  const toleranceEvent = lastEventFor(SUITE, logRunId, "signed-zero-tolerance");
  assert.equal(toleranceEvent?.outcome, "passed");
  assert.equal(typeof toleranceEvent?.diff, "number");
  assert.equal(typeof toleranceEvent?.allowed, "number");
  assert.equal(typeof toleranceEvent?.verdict, "string");
});

test("a NaN actual fails expectClose with the nonfinite-actual verdict kind", () => {
  const logRunId = newRunIdentity();
  const testId = "nan-actual";
  assert.throws(
    () => expectClose(NaN, 1, { absolute: 1e-6 }, { suite: SUITE, logRunId, testId }),
    /expectClose failed/,
  );
  const event = lastEventFor(SUITE, logRunId, testId);
  assert.equal(event?.verdict, "nonfinite-actual");
});

test("identical Uint32Array Philox-style outputs pass bitwise and an off-by-one element fails naming its index", () => {
  const logRunId = newRunIdentity();
  const a = new Uint32Array([1, 2, 3, 4]);
  const b = new Uint32Array([1, 2, 3, 4]);
  const verdict = expectBitwise(a, b, { suite: SUITE, logRunId, testId: "philox-identical" });
  assert.equal(verdict.ok, true);

  const c = new Uint32Array([1, 2, 99, 4]);
  assert.throws(
    () => expectBitwise(a, c, { suite: SUITE, logRunId, testId: "philox-off-by-one" }),
    /expectBitwise failed/,
  );
  const event = lastEventFor(SUITE, logRunId, "philox-off-by-one");
  assert.ok(
    JSON.stringify(event?.extra ?? {}).includes("2"),
    "expected the first differing index (2) in the logged detail",
  );
});

// WITHIN_TOLERANCE_CASES (actual/reference/spec/expectedKind) and BITWISE_CASES
// (actual/expected/expectedKind) are the two named tables in tolerance.cases.ts
// shaped for expectClose and expectBitwise respectively; VALIDATE_SPEC_CASES,
// VALIDATE_ACROSS_CASES, and CLASSIFY_CASES exercise validateToleranceSpec and
// classifyWithTolerance directly and have no expectClose/expectBitwise call shape.
test("every WITHIN_TOLERANCE_CASES case re-runs through expectClose and logs its verdict kind", () => {
  const logRunId = newRunIdentity();
  for (const testCase of WITHIN_TOLERANCE_CASES) {
    const meta = { suite: SUITE, logRunId, testId: testCase.name };
    try {
      expectClose(testCase.actual, testCase.reference, testCase.spec, meta);
    } catch {
      // Named cases outside tolerance, or with an invalid/nonfinite input, are expected to throw;
      // only the persisted log line and its verdict kind are asserted here.
    }
    const event = lastEventFor(SUITE, logRunId, testCase.name);
    assert.ok(event, `expected a log line for case ${testCase.name}`);
    assert.equal(event!.verdict, testCase.expectedKind, `case ${testCase.name}`);
  }
});

test("every BITWISE_CASES case re-runs through expectBitwise and logs its verdict kind", () => {
  const logRunId = newRunIdentity();
  for (const testCase of BITWISE_CASES) {
    const meta = { suite: SUITE, logRunId, testId: testCase.name };
    try {
      expectBitwise(testCase.actual, testCase.expected, meta);
    } catch {
      // A mismatching named case is expected to throw; only the log line is asserted.
    }
    const event = lastEventFor(SUITE, logRunId, testCase.name);
    assert.ok(event, `expected a log line for case ${testCase.name}`);
    assert.equal(event!.verdict, testCase.expectedKind, `case ${testCase.name}`);
    assert.equal(
      event!.outcome,
      testCase.expectedOk ? "passed" : "failed",
      `case ${testCase.name}`,
    );
  }
});
