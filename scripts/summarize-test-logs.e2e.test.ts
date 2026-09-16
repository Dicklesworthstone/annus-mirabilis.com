import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { artifactsRoot } from "../src/testing/log/logger.ts";

const FIXTURE_ROOT = path.join(process.cwd(), "src/testing/fixtures/test-logs");

function copyFixtureTree(): string {
  const base = path.join(artifactsRoot(), "..");
  const workDir = mkdtempSync(path.join(base, "summarize-e2e-"));
  cpSync(FIXTURE_ROOT, workDir, { recursive: true });
  return workDir;
}

test("scripts/summarize-test-logs.ts runs end to end over a committed fixture log directory via Bun.spawn", async () => {
  const workDir = copyFixtureTree();

  const proc = Bun.spawn(["bun", "scripts/summarize-test-logs.ts", "--root", workDir], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  assert.equal(stderr, "", `expected no stderr, got: ${stderr}`);
  // fixture-suite-a has exactly one failing test, so the summarizer must exit non-zero.
  assert.equal(exitCode, 1);

  assert.match(stdout, /fixture-suite-a: passed=1 failed=1 skipped=1 not-available=1/);
  assert.match(stdout, /ocr-ledgers: passed=2 failed=0 skipped=0 not-available=0/);
  assert.match(stdout, /total events: 6/);
  assert.match(stdout, /t2: boom/);
  assert.match(stdout, /20260101T000000Z-eeeeeeee: 2 events/);

  const summaryDir = path.join(workDir, "summary");
  const summaryFiles = readdirSync(summaryDir).filter((f) => f.endsWith(".json"));
  assert.equal(summaryFiles.length, 1);
  const summary = JSON.parse(readFileSync(path.join(summaryDir, summaryFiles[0]!), "utf8"));
  assert.equal(summary.totalEvents, 6);
  assert.deepEqual(summary.counts["fixture-suite-a"], {
    passed: 1,
    failed: 1,
    skipped: 1,
    "not-available": 1,
  });
  assert.equal(summary.failures.length, 1);
  assert.equal(summary.failures[0].testId, "t2");
  assert.equal(summary.toolRuns.length, 1);
  assert.deepEqual(summary.toolRuns[0].logRunIds.sort(), [
    "20260101T000300Z-dddddddd",
    "20260101T000400Z-ffffffff",
  ]);
});
