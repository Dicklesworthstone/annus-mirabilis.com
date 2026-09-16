import assert from "node:assert/strict";
import test from "node:test";
import type { LogEvent } from "../src/testing/log/schema.ts";
import { summarize } from "./summarize-test-logs.ts";

function event(
  partial: Partial<LogEvent> & Pick<LogEvent, "suite" | "logRunId" | "testId">,
): LogEvent {
  return { timestamp: "2026-01-01T00:00:00Z", ...partial } as LogEvent;
}

test("summarize reports correct counts per suite and outcome for a fixture event set", () => {
  const events: LogEvent[] = [
    event({
      suite: "alpha",
      logRunId: "20260101T000000Z-aaaaaaaa",
      testId: "t1",
      outcome: "passed",
    }),
    event({
      suite: "alpha",
      logRunId: "20260101T000000Z-aaaaaaaa",
      testId: "t2",
      outcome: "failed",
      message: "boom",
    }),
    event({
      suite: "alpha",
      logRunId: "20260101T000000Z-aaaaaaaa",
      testId: "t3",
      outcome: "skipped",
    }),
    event({
      suite: "beta",
      logRunId: "20260101T000100Z-bbbbbbbb",
      testId: "t4",
      outcome: "not-available",
    }),
    event({
      suite: "beta",
      logRunId: "20260101T000100Z-bbbbbbbb",
      testId: "t5",
      outcome: "passed",
    }),
  ];

  const summary = summarize(events);

  assert.equal(summary.totalEvents, 5);
  assert.deepEqual(summary.counts.alpha, { passed: 1, failed: 1, skipped: 1, "not-available": 0 });
  assert.deepEqual(summary.counts.beta, { passed: 1, failed: 0, skipped: 0, "not-available": 1 });
  assert.equal(summary.failures.length, 1);
  assert.equal(summary.failures[0]!.testId, "t2");
  assert.equal(summary.failures[0]!.message, "boom");
});

test("failures list includes evidence paths when present", () => {
  const events: LogEvent[] = [
    event({
      suite: "browser-lane",
      logRunId: "20260101T000200Z-cccccccc",
      testId: "operate-instrument",
      outcome: "failed",
      browser: "chromium",
      message: "locator not found",
      evidence: { screenshot: "s.png", dom: "d.html" },
    }),
  ];
  const summary = summarize(events);
  assert.equal(summary.failures.length, 1);
  assert.deepEqual(summary.failures[0]!.evidence, { screenshot: "s.png", dom: "d.html" });
});

test("two script processes sharing one toolRunId are grouped under it with both logRunId values listed", () => {
  const events: LogEvent[] = [
    event({
      suite: "ocr-ledgers",
      logRunId: "20260101T000300Z-dddddddd",
      testId: "chunk-0001",
      toolRunId: "20260101T000000Z-eeeeeeee",
      outcome: "passed",
    }),
    event({
      suite: "ocr-ledgers",
      logRunId: "20260101T000400Z-ffffffff",
      testId: "chunk-0002",
      toolRunId: "20260101T000000Z-eeeeeeee",
      outcome: "passed",
    }),
    event({
      suite: "ocr-ledgers",
      logRunId: "20260101T000300Z-dddddddd",
      testId: "chunk-0003",
      toolRunId: "20260101T000000Z-eeeeeeee",
      outcome: "failed",
    }),
  ];
  const summary = summarize(events);
  assert.equal(summary.toolRuns.length, 1);
  const group = summary.toolRuns[0]!;
  assert.equal(group.toolRunId, "20260101T000000Z-eeeeeeee");
  assert.deepEqual(group.logRunIds, ["20260101T000300Z-dddddddd", "20260101T000400Z-ffffffff"]);
  assert.equal(group.eventCount, 3);
});

test("an empty event set summarizes to zero counts, no failures, no tool runs", () => {
  const summary = summarize([]);
  assert.equal(summary.totalEvents, 0);
  assert.deepEqual(summary.counts, {});
  assert.deepEqual(summary.failures, []);
  assert.deepEqual(summary.toolRuns, []);
});
