import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getLogger, newRunIdentity } from "./logger.ts";
import { createJourneyLoggingFixture, logPlaywrightStep, TestLogReporter } from "./playwright.ts";
import { LogSchemaError, parseLogLine } from "./schema.ts";

const SUITE = "test-logging";

function eventsFor(suite: string, logRunId: string) {
  const logger = getLogger(suite, logRunId);
  return readFileSync(logger.filePath, "utf8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map(parseLogLine);
}

test("logPlaywrightStep records the journey lane fields on a passing step", async () => {
  const logRunId = newRunIdentity();
  const logger = getLogger(SUITE, logRunId);
  logPlaywrightStep(
    {
      suite: SUITE,
      logRunId,
      testId: "brownian-slice-enter",
      browser: "chromium",
      viewport: "1280x800",
      reducedMotion: false,
      jsEnabled: true,
      lane: "desktop",
      journey: "brownian-slice",
      step: "enter-deep-passage",
    },
    "passed",
    { durationMs: 42 },
  );
  await logger.flush();
  const [event] = eventsFor(SUITE, logRunId);
  assert.ok(event);
  assert.equal(event.browser, "chromium");
  assert.equal(event.lane, "desktop");
  assert.equal(event.journey, "brownian-slice");
  assert.equal(event.step, "enter-deep-passage");
  assert.equal(event.outcome, "passed");
});

test("THE FAILURE-REPORTING PATH IS ITSELF TESTED: a failing browser step without evidence is rejected", () => {
  const logRunId = newRunIdentity();
  assert.throws(
    () =>
      logPlaywrightStep(
        {
          suite: SUITE,
          logRunId,
          testId: "missing-evidence",
          browser: "chromium",
          viewport: "1280x800",
          reducedMotion: false,
          jsEnabled: true,
        },
        "failed",
      ),
    LogSchemaError,
  );
});

test("THE FAILURE-REPORTING PATH IS ITSELF TESTED: a failing browser step with evidence retains screenshot, trace, dom, and console paths", async () => {
  const logRunId = newRunIdentity();
  const logger = getLogger(SUITE, logRunId);
  logPlaywrightStep(
    {
      suite: SUITE,
      logRunId,
      testId: "operate-instrument-fails",
      browser: "webkit",
      viewport: "320x568",
      reducedMotion: true,
      jsEnabled: true,
      lane: "touch-320",
      journey: "brownian-slice",
      step: "operate-instrument",
    },
    "failed",
    {
      message: "instrument did not respond to the drag gesture",
      evidence: {
        screenshot: "artifacts/test-logs/test-logging/evidence/operate-instrument-fails.png",
        trace: "artifacts/test-logs/test-logging/evidence/operate-instrument-fails.trace.zip",
        dom: "artifacts/test-logs/test-logging/evidence/operate-instrument-fails.dom.html",
        console: "artifacts/test-logs/test-logging/evidence/operate-instrument-fails.console.log",
      },
    },
  );
  await logger.flush();
  const [event] = eventsFor(SUITE, logRunId);
  assert.ok(event);
  assert.equal(event.outcome, "failed");
  assert.ok(event.evidence?.screenshot);
  assert.ok(event.evidence?.trace);
  assert.ok(event.evidence?.dom);
  assert.ok(event.evidence?.console);
  assert.equal(event.message, "instrument did not respond to the drag gesture");
});

test("createJourneyLoggingFixture logs through a fixed suite/log-run id and flushes", async () => {
  const logRunId = newRunIdentity();
  const fixture = createJourneyLoggingFixture({ suite: SUITE, logRunId });
  fixture.logStep(
    {
      testId: "fixture-step",
      browser: "chromium",
      viewport: "1280x800",
      reducedMotion: false,
      jsEnabled: true,
    },
    "passed",
  );
  await fixture.flush();
  const [event] = eventsFor(SUITE, logRunId);
  assert.ok(event);
  assert.equal(event.testId, "fixture-step");
  assert.equal(event.outcome, "passed");
});

test("TestLogReporter.onTestEnd maps a passing Playwright result including project viewport/reducedMotion/jsEnabled", async () => {
  const logRunId = newRunIdentity();
  const reporter = new TestLogReporter({ suite: SUITE, logRunId });
  reporter.onTestEnd(
    {
      title: "enters through a deep source passage",
      parent: {
        project: () => ({
          name: "webkit-mobile",
          use: {
            viewport: { width: 375, height: 667 },
            reducedMotion: "reduce",
            javaScriptEnabled: true,
          },
        }),
      },
    },
    { status: "passed", duration: 123.4, attachments: [] },
  );
  await getLogger(SUITE, logRunId).flush();
  const [event] = eventsFor(SUITE, logRunId);
  assert.ok(event);
  assert.equal(event.browser, "webkit-mobile");
  assert.equal(event.viewport, "375x667");
  assert.equal(event.reducedMotion, true);
  assert.equal(event.jsEnabled, true);
  assert.equal(event.durationMs, 123);
});

test("TestLogReporter.onTestEnd on a failing result attaches screenshot/trace/dom/console evidence paths", async () => {
  const logRunId = newRunIdentity();
  const reporter = new TestLogReporter({ suite: SUITE, logRunId });
  reporter.onTestEnd(
    {
      title: "operates an instrument",
      parent: {
        project: () => ({
          name: "chromium",
          use: { viewport: { width: 1280, height: 800 }, javaScriptEnabled: true },
        }),
      },
    },
    {
      status: "failed",
      duration: 987,
      error: { message: "locator not found" },
      attachments: [
        { name: "screenshot", path: "artifacts/test-logs/test-logging/evidence/e.png" },
        { name: "trace", path: "artifacts/test-logs/test-logging/evidence/e.trace.zip" },
        { name: "dom-snapshot", path: "artifacts/test-logs/test-logging/evidence/e.dom.html" },
        { name: "console-log", path: "artifacts/test-logs/test-logging/evidence/e.console.log" },
      ],
    },
  );
  await getLogger(SUITE, logRunId).flush();
  const [event] = eventsFor(SUITE, logRunId);
  assert.ok(event);
  assert.equal(event.outcome, "failed");
  assert.equal(event.message, "locator not found");
  assert.equal(event.evidence?.screenshot, "artifacts/test-logs/test-logging/evidence/e.png");
  assert.equal(event.evidence?.dom, "artifacts/test-logs/test-logging/evidence/e.dom.html");
});

test("TestLogReporter.onTestEnd on a failing result WITHOUT evidence attachments surfaces the schema rejection rather than silently dropping the failure", async () => {
  const logRunId = newRunIdentity();
  const reporter = new TestLogReporter({ suite: SUITE, logRunId });
  assert.throws(
    () =>
      reporter.onTestEnd(
        {
          title: "operates an instrument without captured evidence",
          parent: { project: () => ({ name: "chromium" }) },
        },
        { status: "failed", duration: 10, error: { message: "boom" }, attachments: [] },
      ),
    LogSchemaError,
  );
});
