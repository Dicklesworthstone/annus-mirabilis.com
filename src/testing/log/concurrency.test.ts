import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TestLogger, newRunIdentity } from "./logger.ts";
import { parseLogLine } from "./schema.ts";

/**
 * Two loggers for different suites, writing concurrently, must each produce
 * one intact file: every line parses, nothing from one suite's buffer bleeds
 * into the other suite's file, and no line is split by an interleaved write.
 */
test("two suites logging concurrently produce two intact files, never interleaved", async () => {
  const alpha = new TestLogger("concurrency-alpha", newRunIdentity());
  const beta = new TestLogger("concurrency-beta", newRunIdentity());
  const eventsPerSuite = 40;

  const writers = [];
  for (let i = 0; i < eventsPerSuite; i++) {
    writers.push(
      Promise.resolve().then(() => {
        alpha.log({ testId: `alpha-${i}`, outcome: "passed", extra: { index: i } });
        return alpha.flush();
      }),
      Promise.resolve().then(() => {
        beta.log({ testId: `beta-${i}`, outcome: "passed", extra: { index: i } });
        return beta.flush();
      }),
    );
  }
  await Promise.all(writers);
  await Promise.all([alpha.flush(), beta.flush()]);

  const alphaLines = readFileSync(alpha.filePath, "utf8").split("\n").filter((l) => l.length > 0);
  const betaLines = readFileSync(beta.filePath, "utf8").split("\n").filter((l) => l.length > 0);

  assert.equal(alphaLines.length, eventsPerSuite);
  assert.equal(betaLines.length, eventsPerSuite);

  const alphaEvents = alphaLines.map(parseLogLine);
  const betaEvents = betaLines.map(parseLogLine);

  assert.ok(alphaEvents.every((e) => e.suite === "concurrency-alpha"));
  assert.ok(betaEvents.every((e) => e.suite === "concurrency-beta"));
  assert.deepEqual(
    alphaEvents.map((e) => (e.extra as { index: number }).index).sort((a, b) => a - b),
    Array.from({ length: eventsPerSuite }, (_, i) => i),
  );
  assert.deepEqual(
    betaEvents.map((e) => (e.extra as { index: number }).index).sort((a, b) => a - b),
    Array.from({ length: eventsPerSuite }, (_, i) => i),
  );
});

test("many events buffered on one logger and flushed concurrently never interleave within the file", async () => {
  const logger = new TestLogger("concurrency-single", newRunIdentity());
  const total = 100;
  const flushes: Promise<void>[] = [];
  for (let i = 0; i < total; i++) {
    logger.log({ testId: `event-${i}`, outcome: "passed" });
    if (i % 7 === 0) flushes.push(logger.flush());
  }
  flushes.push(logger.flush());
  await Promise.all(flushes);

  const lines = readFileSync(logger.filePath, "utf8").split("\n").filter((l) => l.length > 0);
  assert.equal(lines.length, total);
  const events = lines.map(parseLogLine);
  assert.deepEqual(events.map((e) => e.testId), Array.from({ length: total }, (_, i) => `event-${i}`));
});
