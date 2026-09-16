import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { artifactsRoot, newRunIdentity, suiteLogPath, TestLogger } from "./logger.ts";
import { LogSchemaError, parseLogLine } from "./schema.ts";

const SUITE = "test-logging";

function freshLogger(): TestLogger {
  return new TestLogger(SUITE, newRunIdentity());
}

function readLines(logger: TestLogger): string[] {
  return readFileSync(logger.filePath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0);
}

test("writes three events and reads them back as valid JSON lines in order", async () => {
  const logger = freshLogger();
  assert.equal(logger.filePath, suiteLogPath(SUITE, logger.logRunId));
  logger.log({ testId: "a", outcome: "passed" });
  logger.log({ testId: "b", outcome: "failed", message: "boom" });
  logger.log({ testId: "c", outcome: "skipped" });
  await logger.flush();

  const lines = readLines(logger);
  assert.equal(lines.length, 3);
  const events = lines.map(parseLogLine);
  assert.deepEqual(
    events.map((e) => e.testId),
    ["a", "b", "c"],
  );
  assert.equal(events[0]!.suite, SUITE);
  assert.equal(events[0]!.logRunId, logger.logRunId);
  assert.equal(events[1]!.message, "boom");
});

test("seed must be a canonical decimal string, never a JSON number", () => {
  const logger = freshLogger();
  assert.throws(
    () => logger.log({ testId: "seed-numeric", seed: 42 as unknown as string }),
    LogSchemaError,
  );
});

test("seed at 2^64 is rejected and 2^53+1 is accepted and read back unchanged", async () => {
  const logger = freshLogger();
  assert.throws(
    () => logger.log({ testId: "seed-too-big", seed: "18446744073709551616" }),
    LogSchemaError,
  );
  logger.log({ testId: "seed-2^53+1", seed: "9007199254740993" });
  await logger.flush();
  const [event] = readLines(logger).map(parseLogLine);
  assert.equal(event!.seed, "9007199254740993");
});

test("seed boundary neighbourhood: 0, 2^53 neighbours, and 2^64-1 all accepted", async () => {
  const logger = freshLogger();
  const seeds = [
    "0",
    "9007199254740991",
    "9007199254740992",
    "9007199254740993",
    "18446744073709551615",
  ];
  for (const seed of seeds) logger.log({ testId: `seed-${seed}`, seed });
  await logger.flush();
  const events = readLines(logger).map(parseLogLine);
  assert.deepEqual(
    events.map((e) => e.seed),
    seeds,
  );
});

test("seed rejects invalid sign, whitespace, leading zeros, and overlong input", () => {
  const logger = freshLogger();
  for (const seed of ["-1", " 5", "5 ", "01", "007", "1".repeat(21), "9".repeat(30)]) {
    assert.throws(
      () => logger.log({ testId: `seed-bad-${seed}`, seed }),
      LogSchemaError,
      `expected rejection for ${JSON.stringify(seed)}`,
    );
  }
});

test("a runId shaped like a log/tool run id is rejected with the identity-confusion message", () => {
  const logger = freshLogger();
  assert.throws(
    () =>
      logger.log({
        testId: "run-id-confusion",
        runId: "20260914T120000Z-0a1b2c3d",
        instanceId: "bm01-instance-1",
      }),
    (error: unknown) =>
      error instanceof LogSchemaError && error.message.includes("experiment realization"),
  );
});

test("an experiment runId without instanceId or instrumentId is rejected", () => {
  const logger = freshLogger();
  assert.throws(
    () => logger.log({ testId: "run-id-no-instance", runId: "bm01-instance-1/run/3" }),
    (error: unknown) =>
      error instanceof LogSchemaError &&
      error.message.includes("instanceId") &&
      error.message.includes("instrumentId"),
  );
});

test("logRunId and an experiment runId coexist and both read back unchanged", async () => {
  const logger = new TestLogger(SUITE, "20260914T120000Z-0a1b2c3d");
  logger.log({
    testId: "run-id-and-log-run-id",
    runId: "bm01-instance-1/run/3",
    instanceId: "bm01-instance-1",
  });
  await logger.flush();
  const [event] = readLines(logger).map(parseLogLine);
  assert.equal(event!.logRunId, "20260914T120000Z-0a1b2c3d");
  assert.equal(event!.runId, "bm01-instance-1/run/3");
});

test("a script event uses toolRunId, and a malformed toolRunId is rejected", async () => {
  const scriptLogger = new TestLogger("ocr-ledgers", newRunIdentity());
  scriptLogger.log({
    testId: "chunk-0003",
    toolRunId: "20260914T110000Z-1f2e3d4c",
    extra: { status: "completed" },
  });
  await scriptLogger.flush();
  const [event] = readLines(scriptLogger).map(parseLogLine);
  assert.equal(event!.suite, "ocr-ledgers");
  assert.equal(event!.toolRunId, "20260914T110000Z-1f2e3d4c");
  assert.equal((event!.extra as { status: string }).status, "completed");

  assert.throws(
    () => scriptLogger.log({ testId: "chunk-0004", toolRunId: "run-7" }),
    LogSchemaError,
  );
});

test("browser journey fields (lane, journey, step) are accepted", async () => {
  const logger = freshLogger();
  logger.log({
    testId: "journey-step",
    journey: "brownian-slice",
    lane: "desktop",
    step: "enter-deep-passage",
  });
  await logger.flush();
  const [event] = readLines(logger).map(parseLogLine);
  assert.equal(event!.journey, "brownian-slice");
  assert.equal(event!.lane, "desktop");
  assert.equal(event!.step, "enter-deep-passage");
});

test("a statistical sampling-band event carries no top-level expected, and is read back unchanged", async () => {
  const logger = freshLogger();
  logger.log({
    testId: "sampling-band",
    extra: {
      statistic: "chi-square",
      observedValue: 12.4,
      lowerBound: 8.1,
      upperBound: 16.9,
      alpha: 0.05,
      allocationId: "a1",
      n: 200,
    },
  });
  await logger.flush();
  const [event] = readLines(logger).map(parseLogLine);
  assert.equal(event!.expected, undefined);
  assert.deepEqual(event!.extra, {
    statistic: "chi-square",
    observedValue: 12.4,
    lowerBound: 8.1,
    upperBound: 16.9,
    alpha: 0.05,
    allocationId: "a1",
    n: 200,
  });
});

test("the same statistical event given a top-level expected without comparisonKind is rejected", () => {
  const logger = freshLogger();
  assert.throws(
    () =>
      logger.log({
        testId: "sampling-band-bad",
        expected: 12,
        extra: {
          statistic: "chi-square",
          observedValue: 12.4,
          lowerBound: 8.1,
          upperBound: 16.9,
          alpha: 0.05,
        },
      }),
    LogSchemaError,
  );
});

test("an unknown top-level field is rejected naming its extra.<field> repair; the same value under extra is accepted", async () => {
  const logger = freshLogger();
  assert.throws(
    () =>
      logger.log({ testId: "unknown-field", pdfPage: 12 } as unknown as Record<string, unknown>),
    (error: unknown) => error instanceof LogSchemaError && error.message.includes("extra.pdfPage"),
  );
  logger.log({ testId: "unknown-field-fixed", extra: { pdfPage: 12 } });
  await logger.flush();
  const [event] = readLines(logger).map(parseLogLine);
  assert.equal((event!.extra as { pdfPage: number }).pdfPage, 12);
});

test("extra.freeTextAnswer is rejected; an overlong extra string is rejected; small serializable extra is accepted", async () => {
  const logger = freshLogger();
  assert.throws(
    () => logger.log({ testId: "reject-free-text", extra: { freeTextAnswer: "hello" } }),
    LogSchemaError,
  );
  assert.throws(
    () => logger.log({ testId: "reject-overlong", extra: { digest: "x".repeat(2001) } }),
    LogSchemaError,
  );
  logger.log({
    testId: "accept-small-extra",
    extra: { key: "ok", check: "concordance-scope", nested: { count: 3 } },
  });
  await logger.flush();
  const [event] = readLines(logger).map(parseLogLine);
  assert.deepEqual(event!.extra, { key: "ok", check: "concordance-scope", nested: { count: 3 } });
});

test("a failing browser event without a screenshot and DOM snapshot is rejected", () => {
  const logger = freshLogger();
  assert.throws(
    () =>
      logger.log({ testId: "browser-fail-no-evidence", browser: "chromium", outcome: "failed" }),
    LogSchemaError,
  );
  assert.doesNotThrow(() =>
    logger.log({
      testId: "browser-fail-with-evidence",
      browser: "chromium",
      outcome: "failed",
      evidence: {
        screenshot: "artifacts/test-logs/x/evidence/e.png",
        dom: "artifacts/test-logs/x/evidence/e.html",
      },
    }),
  );
});

test("suite log files land at artifacts/test-logs/<suite>/<log-run-id>.jsonl", () => {
  const logger = freshLogger();
  const expected = path.join(artifactsRoot(), SUITE, `${logger.logRunId}.jsonl`);
  assert.equal(logger.filePath, expected);
});
