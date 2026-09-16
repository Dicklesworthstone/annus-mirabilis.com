import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function spawnSummarizer(workDir: string): { exitCode: number; stdout: string; stderr: string } {
  if (typeof Bun !== "undefined" && typeof Bun.spawnSync === "function") {
    const proc = Bun.spawnSync(["bun", "scripts/summarize-test-logs.ts", "--root", workDir], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      exitCode: proc.exitCode,
      stdout: proc.stdout.toString("utf8"),
      stderr: proc.stderr.toString("utf8"),
    };
  }
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const proc = spawnSync(
      "node",
      ["--experimental-strip-types", "scripts/summarize-test-logs.ts", "--root", workDir],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (!proc.error) {
      return {
        exitCode: proc.status ?? (proc.signal ? 1 : 0),
        stdout: proc.stdout || "",
        stderr: proc.stderr || "",
      };
    }
    lastError = proc.error;
    if (isNodeError(proc.error) && proc.error.code === "EBADF" && attempt < maxAttempts) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * attempt);
      continue;
    }
    throw new Error(
      `Failed to spawn scripts/summarize-test-logs.ts (attempt ${attempt}/${maxAttempts}): ${proc.error.message}`,
      { cause: proc.error },
    );
  }
  throw new Error(`Failed to spawn scripts/summarize-test-logs.ts after ${maxAttempts} attempts`, {
    cause: lastError,
  });
}

test("scripts/summarize-test-logs.ts runs end to end over a committed fixture log directory", () => {
  const workDir = copyFixtureTree();
  const { exitCode, stdout, stderr } = spawnSummarizer(workDir);
  assert.equal(stderr, "");
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
  const summaryFile = summaryFiles[0];
  assert.ok(summaryFile !== undefined);
  const summary = JSON.parse(readFileSync(path.join(summaryDir, summaryFile), "utf8"));
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
