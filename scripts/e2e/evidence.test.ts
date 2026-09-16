import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { newRunIdentity } from "../../src/testing/log/logger.ts";
import { suiteLogPath } from "../../src/testing/log/logger.ts";
import { e2eEvidenceDir, retainE2EEvidence } from "./evidence.ts";

function writeFixture(path: string, contents: string): void {
  writeFileSync(path, contents, "utf8");
}

test("the evidence writer names files under artifacts/test-logs/<suite>/<log-run-id>/evidence/<testId>/<lane>/", () => {
  const dir = e2eEvidenceDir("e2e", "20260101T000000Z-deadbeef", "reader-focus-restoration", "keyboard-only");
  assert.match(dir, /artifacts\/test-logs\/e2e\/20260101T000000Z-deadbeef\/evidence\/reader-focus-restoration\/keyboard-only$/);
});

test("retainE2EEvidence copies and records all five paths", async () => {
  const staging = mkdtempSync(join(tmpdir(), "e2e-evidence-staging-"));
  const logRunId = newRunIdentity();
  try {
    const screenshot = join(staging, "screenshot.png");
    const trace = join(staging, "trace.zip");
    const dom = join(staging, "dom.html");
    const consoleLog = join(staging, "console.log");
    const network = join(staging, "network.har");
    for (const [path, contents] of [
      [screenshot, "fake-png-bytes"],
      [trace, "fake-trace-bytes"],
      [dom, "<html></html>"],
      [consoleLog, "[log] hello"],
      [network, "{}"],
    ] as const) {
      writeFixture(path, contents);
    }

    const result = await retainE2EEvidence(
      { suite: "e2e", logRunId, testId: "reader-focus-restoration", lane: "keyboard-only", outcome: "failed" },
      { screenshot, trace, dom, console: consoleLog, network },
    );

    assert.equal(result.copied.length, 5);
    assert.deepEqual(result.missing, []);
    const destDir = e2eEvidenceDir("e2e", logRunId, "reader-focus-restoration", "keyboard-only");
    for (const name of ["screenshot.png", "trace.zip", "dom.html", "console.log", "network.har"]) {
      assert.ok(existsSync(join(destDir, name)), `expected ${name} to be copied into ${destDir}`);
    }

    const logPath = suiteLogPath("e2e", logRunId);
    const lastLine = readFileSync(logPath, "utf8").trim().split("\n").at(-1) ?? "";
    const parsed = JSON.parse(lastLine);
    assert.equal(parsed.testId, "reader-focus-restoration/keyboard-only");
    assert.equal(parsed.evidence.files.length, 5);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
});

test("a missing trace is reported in the log, never dropped silently", async () => {
  const staging = mkdtempSync(join(tmpdir(), "e2e-evidence-missing-trace-"));
  const logRunId = newRunIdentity();
  try {
    const screenshot = join(staging, "screenshot.png");
    const dom = join(staging, "dom.html");
    const consoleLog = join(staging, "console.log");
    const network = join(staging, "network.har");
    const missingTrace = join(staging, "trace-that-was-never-written.zip");
    for (const [path, contents] of [
      [screenshot, "fake-png-bytes"],
      [dom, "<html></html>"],
      [consoleLog, "[log] hello"],
      [network, "{}"],
    ] as const) {
      writeFixture(path, contents);
    }

    const result = await retainE2EEvidence(
      { suite: "e2e", logRunId, testId: "print-equation-clipping", lane: "print", outcome: "failed" },
      { screenshot, trace: missingTrace, dom, console: consoleLog, network },
    );

    assert.equal(result.copied.length, 4);
    assert.deepEqual(result.missing, [missingTrace]);

    const logPath = suiteLogPath("e2e", logRunId);
    const lastLine = readFileSync(logPath, "utf8").trim().split("\n").at(-1) ?? "";
    const parsed = JSON.parse(lastLine);
    assert.match(parsed.message, /Missing evidence source/);
    assert.ok(parsed.message.includes(missingTrace));
    assert.equal(parsed.evidence.files.length, 4);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
});
