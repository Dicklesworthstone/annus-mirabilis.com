import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LOG_RUN_ID_PATTERN,
  appendLogLine,
  evidenceDirFor,
  formatLogLine,
  logPathFor,
  newLogRunId,
  writeEvidenceFile,
} from "./logLine.ts";

test("newLogRunId matches the standard YYYYMMDDTHHMMSSZ-<8 hex> format", () => {
  for (let i = 0; i < 20; i++) {
    const id = newLogRunId();
    assert.match(id, LOG_RUN_ID_PATTERN);
  }
});

test("newLogRunId draws its hex suffix from a cryptographic source, not Math.random", () => {
  const ids = new Set(Array.from({ length: 50 }, () => newLogRunId()));
  assert.equal(ids.size, 50, "50 draws should not collide");
});

test("formatLogLine embeds a caller-supplied timestamp and every standard field", () => {
  const line = formatLogLine(
    {
      suite: "scaffold-static-output",
      logRunId: "20260101T000000Z-deadbeef",
      testId: "home-page-200",
      beadId: "am-scaf-nextjs-app-bu2",
      outcome: "pass",
      message: "home page returned 200",
    },
    "2026-01-01T00:00:00.000Z",
  );
  const parsed = JSON.parse(line);
  assert.equal(parsed.timestamp, "2026-01-01T00:00:00.000Z");
  assert.equal(parsed.suite, "scaffold-static-output");
  assert.equal(parsed.logRunId, "20260101T000000Z-deadbeef");
  assert.equal(parsed.testId, "home-page-200");
  assert.equal(parsed.beadId, "am-scaf-nextjs-app-bu2");
  assert.equal(parsed.outcome, "pass");
  assert.equal(parsed.message, "home page returned 200");
});

test("appendLogLine writes one JSON line per call under artifacts/test-logs/<suite>/<log-run-id>.jsonl", () => {
  const root = mkdtempSync(join(tmpdir(), "logline-test-"));
  try {
    const logRunId = "20260101T000000Z-cafef00d";
    const path = logPathFor("initial-route-graph", logRunId, root);
    appendLogLine(
      path,
      {
        suite: "initial-route-graph",
        logRunId,
        testId: "route-clean",
        beadId: "am-scaf-nextjs-app-bu2",
        outcome: "pass",
        message: "no forbidden signatures",
        extra: { route: "/" },
      },
      "2026-01-01T00:00:00.000Z",
    );
    appendLogLine(
      path,
      {
        suite: "initial-route-graph",
        logRunId,
        testId: "route-webgl",
        beadId: "am-scaf-nextjs-app-bu2",
        outcome: "fail",
        message: "found WebGLRenderer",
      },
      "2026-01-01T00:00:01.000Z",
    );
    const lines = readFileSync(path, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    const first = JSON.parse(lines[0] ?? "");
    assert.equal(first.testId, "route-clean");
    assert.equal(first.extra.route, "/");
    const second = JSON.parse(lines[1] ?? "");
    assert.equal(second.outcome, "fail");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("evidenceDirFor and writeEvidenceFile retain failure evidence under a run-scoped evidence directory", () => {
  const root = mkdtempSync(join(tmpdir(), "logline-evidence-"));
  try {
    const logRunId = "20260101T000000Z-0badc0de";
    const dir = evidenceDirFor("scaffold-static-output", logRunId, root);
    const written = writeEvidenceFile(dir, "home-page-body.txt", "first 4096 bytes here");
    assert.equal(written, join(dir, "home-page-body.txt"));
    assert.equal(readFileSync(written, "utf8"), "first 4096 bytes here");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
